package com.antigravity.servicedashboard.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;

import org.springframework.http.ResponseEntity;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import com.antigravity.servicedashboard.constant.AppConstants;
import javax.naming.NamingException;
import org.springframework.ldap.core.AttributesMapper;
import org.springframework.ldap.core.LdapTemplate;
import org.springframework.ldap.core.support.LdapContextSource;
import com.antigravity.servicedashboard.entity.DataSource;
import com.antigravity.servicedashboard.entity.NotificationRule;
import com.antigravity.servicedashboard.util.MessageUtils;
import com.antigravity.servicedashboard.entity.SyncDefinition;
import com.antigravity.servicedashboard.entity.WidgetDefinition;
import com.antigravity.servicedashboard.exception.SyncException;
import com.antigravity.servicedashboard.repository.DataSourceRepository;
import com.antigravity.servicedashboard.repository.NotificationRuleRepository;
import com.antigravity.servicedashboard.repository.SyncDefinitionRepository;
import com.antigravity.servicedashboard.repository.WidgetDefinitionRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.azure.identity.DefaultAzureCredential;
import com.azure.identity.DefaultAzureCredentialBuilder;
import com.microsoft.sqlserver.jdbc.SQLServerDataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Statement;

@Service
public class SyncService {

    private static final Logger logger = LoggerFactory.getLogger(SyncService.class);

    private final SyncDefinitionRepository syncRepo;

    private final WidgetDefinitionRepository widgetRepo;

    private final NotificationRuleRepository notifRepo;

    private final DataSourceRepository sourceRepo;

    private final RestClientService restClient;

    private final ShellService shellService;

    private final TableManagerService tableManager;

    private final NotificationService notificationService;

    private final ObjectMapper objectMapper;

    private final FileService fileService;

    private final SyncService self;

    public SyncService(SyncDefinitionRepository syncRepo,
            WidgetDefinitionRepository widgetRepo,
            NotificationRuleRepository notifRepo,
            DataSourceRepository sourceRepo,
            RestClientService restClient,
            ShellService shellService,
            TableManagerService tableManager,
            NotificationService notificationService,
            ObjectMapper objectMapper,
            FileService fileService,
            @org.springframework.context.annotation.Lazy SyncService self) {
        this.syncRepo = syncRepo;
        this.widgetRepo = widgetRepo;
        this.notifRepo = notifRepo;
        this.sourceRepo = sourceRepo;
        this.restClient = restClient;
        this.shellService = shellService;
        this.tableManager = tableManager;
        this.notificationService = notificationService;
        this.objectMapper = objectMapper;
        this.fileService = fileService;
        this.self = self;
    }

    @Scheduled(fixedDelay = 60000)

    public void runScheduler() {
        logger.debug("Checking for pending sync jobs...");
        List<SyncDefinition> syncs = syncRepo.findAll();
        for (SyncDefinition sync : syncs) {
            boolean run = shouldRun(sync);
            logger.info("Sync Check - ID: {}, Table: {}, Mode: '{}', ShouldRun: {}",
                    sync.getId(), sync.getTargetTableName(), sync.getSyncMode(), run);
            if (run) {
                try {
                    self.runSyncJob(sync);
                } catch (Exception e) {
                    logger.error("Failed to run sync job ID: " + sync.getId(), e);
                    updateStatus(sync, "FAILED: " + e.getMessage());
                }
            }
        }
    }

    private boolean shouldRun(SyncDefinition sync) {
        if (sync.isSchemaChanged()) return false;
        String mode = sync.getSyncMode();
        return mode == null || !"MANUAL".equalsIgnoreCase(mode.trim());
    }

    @Transactional

    public void runSyncJob(SyncDefinition sync) {
        runSyncJob(sync, true);
    }

    private void runSyncJob(SyncDefinition sync, boolean retryOnSchemaMismatch) {
        logger.info("Starting Sync Job: {}", sync.getTargetTableName());
        Optional<DataSource> sourceOpt = sourceRepo.findById(sync.getSourceId());
        if (sourceOpt.isEmpty()) {
            throw new IllegalArgumentException(MessageUtils.get("error.datasource.notfound", sync.getSourceId()));
        }
        DataSource source = sourceOpt.get();
        try {
            String method = sync.getHttpMethod() != null ? sync.getHttpMethod() : "GET";
            Object body = sync.getRequestBody();
            List<Map<String, Object>> rawData = fetchData(source, sync.getFetchQuery(), method, body, sync.getRootPath(),
                    sync.getPaginationConfig());
            if (rawData.isEmpty()) {
                updateStatus(sync, "SUCCESS (No Data)");
                return;
            }
            List<Map<String, Object>> mappedData = applyFieldMapping(rawData, sync.getFieldMapping());
            mappedData = sanitizeDataKeys(mappedData);
            if (!mappedData.isEmpty()) {
                Map<String, String> schema = inferSchema(mappedData.get(0));
                String strategy = retryOnSchemaMismatch ? sync.getSyncStrategy() : "RELOAD";
                tableManager.createOrUpdateTable(sync.getTargetTableName(), schema, strategy);
                attemptDataSync(sync, mappedData, retryOnSchemaMismatch);
                notificationService.triggerEventRules(sync.getTargetTableName());
            }
            updateStatus(sync, "SUCCESS");
        } catch (Exception e) {
            logger.error("Sync Job Failed", e);
            throw new SyncException(MessageUtils.get("error.sync.jobfailed", sync.getTargetTableName()), e);
        }
    }

    private void attemptDataSync(SyncDefinition sync, List<Map<String, Object>> mappedData, boolean retry) {
        try {
            tableManager.syncData(sync.getTargetTableName(), mappedData, sync.getSyncStrategy(),
                    sync.getPrimaryKey());
        } catch (Exception e) {
            if (retry && e.getMessage() != null && e.getMessage().contains("no column named")) {
                logger.warn("Schema mismatch detected. Retrying sync for table: {}", sync.getTargetTableName());
                tableManager.dropTable(sync.getTargetTableName());
                runSyncJob(sync, false);
                return;
            }
            throw e;
        }
    }

    public List<Map<String, Object>> previewData(Long sourceId, String fetchQuery, String method, String body,
            String rootPath) {
        Optional<DataSource> sourceOpt = sourceRepo.findById(sourceId);
        if (sourceOpt.isEmpty()) {
            throw new IllegalArgumentException(MessageUtils.get("error.datasource.notfound", sourceId));
        }
        List<Map<String, Object>> data = fetchData(sourceOpt.get(), fetchQuery, method, body, rootPath, null);
        if (data.size() > 5) {
            return data.subList(0, 5);
        }
        return data;
    }

    public List<Map<String, Object>> fetchData(DataSource source, String fetchQuery) {
        return fetchData(source, fetchQuery, "GET", null, null, null);
    }

    public List<Map<String, Object>> fetchData(DataSource source, String fetchQuery, String method, Object body) {
        return fetchData(source, fetchQuery, method, body, null, null);
    }

    public List<Map<String, Object>> fetchData(DataSource source, String fetchQuery, String method, Object body,
            String rootPath, String paginationConfig) {
        try {
            List<Map<String, Object>> result = Collections.emptyList();
            if (AppConstants.DS_TYPE_REST_API.equals(source.getType())) {
                result = fetchFromRestApi(source, fetchQuery, method, body, paginationConfig, rootPath);
                rootPath = null;
            } else if (AppConstants.DS_TYPE_SQL_SERVER.equals(source.getType())) {
                result = fetchFromSql(source, fetchQuery);
            } else if (AppConstants.DS_TYPE_LDAP.equals(source.getType())) {
                result = fetchFromLdap(source, fetchQuery);
            } else if (AppConstants.DS_TYPE_LOCAL_COMMAND.equals(source.getType())) {
                result = shellService.executeCommand(fetchQuery, ".");
            } else if (AppConstants.DS_TYPE_LOCAL_FILE.equals(source.getType())) {
                result = fetchFromFile(source, fetchQuery);
            }

            if (rootPath != null && !rootPath.trim().isEmpty() && !result.isEmpty()) {
                return extractRootPath(result, rootPath);
            }
            return result;
        } catch (Exception e) {
            logger.error("Error fetching data", e);
            throw new SyncException(MessageUtils.get("error.sync.datafetch", e.getMessage()), e);
        }
    }

    private List<Map<String, Object>> fetchFromLdap(DataSource source, String fetchQuery) {
        try {
            Map<String, Object> config = objectMapper.readValue(source.getConfig(), new TypeReference<>() {
            });
            String url = (String) config.get("url");
            String baseDn = (String) config.get("baseDn");
            String userDn = (String) config.get("userDn");
            String password = (String) config.get("password");

            LdapContextSource contextSource = new LdapContextSource();
            contextSource.setUrl(url);
            contextSource.setBase(baseDn);
            contextSource.setUserDn(userDn);
            contextSource.setPassword(password);
            contextSource.afterPropertiesSet();

            LdapTemplate ldapTemplate = new LdapTemplate(contextSource);

            AttributesMapper<Map<String, Object>> mapper = (attrs) -> {
                Map<String, Object> map = new LinkedHashMap<>();
                try {
                    javax.naming.NamingEnumeration<? extends javax.naming.directory.Attribute> all = attrs.getAll();
                    while (all.hasMore()) {
                        javax.naming.directory.Attribute attr = all.next();
                        String id = attr.getID();
                        if (attr.size() > 1) {
                            List<Object> values = new ArrayList<>();
                            javax.naming.NamingEnumeration<?> vals = attr.getAll();
                            while (vals.hasMore()) {
                                values.add(vals.next());
                            }
                            map.put(id, values);
                        } else {
                            map.put(id, attr.get());
                        }
                    }
                } catch (NamingException e) {
                    throw new RuntimeException(e);
                }
                return map;
            };

            return ldapTemplate.search("", fetchQuery, mapper);

        } catch (Exception e) {
            throw new SyncException(MessageUtils.get("error.sync.ldapfetch", e.getMessage()), e);
        }
    }

    private List<Map<String, Object>> fetchFromSql(DataSource source, String fetchQuery) {
        try {
            Map<String, Object> config = objectMapper.readValue(source.getConfig(), new TypeReference<>() {
            });

            SQLServerDataSource ds = new SQLServerDataSource();
            ds.setServerName((String) config.get("server"));
            ds.setDatabaseName((String) config.get("database"));

            Object portObj = config.get("port");
            if (portObj instanceof Number) {
                ds.setPortNumber(((Number) portObj).intValue());
            } else if (portObj instanceof String) {
                try {
                    ds.setPortNumber(Integer.parseInt((String) portObj));
                } catch (NumberFormatException e) {
                    logger.warn("Invalid port number: {}", portObj);
                }
            }

            String clientId = (String) config.get("clientId");
            if (clientId != null && !clientId.isEmpty()) {
                logger.info("Connecting to SQL Server using User-Assigned Managed Identity: {}", clientId);
                DefaultAzureCredential credential = new DefaultAzureCredentialBuilder()
                        .managedIdentityClientId(clientId)
                        .build();

                com.azure.core.credential.AccessToken token = credential.getToken(
                        new com.azure.core.credential.TokenRequestContext()
                                .addScopes("https://database.windows.net/.default"))
                        .block();

                if (token != null) {
                    ds.setAccessToken(token.getToken());
                } else {
                    throw new SyncException(MessageUtils.get("error.sync.auth.mi"));
                }
            } else {
                // Fallback (though UI removed user/pass, maybe older configs exist?)
                // Or maybe system assigned MI?
                // If System Assigned MI, clientID could be null but we still use
                // DefaultAzureCredential?
                // But user explicitly asked for User Assigned Client ID.
                logger.warn("No Client ID provided for SQL Server source {}. Attempting System-Assigned MI or failure.",
                        source.getName());
                DefaultAzureCredential credential = new DefaultAzureCredentialBuilder().build();
                com.azure.core.credential.AccessToken token = credential.getToken(
                        new com.azure.core.credential.TokenRequestContext()
                                .addScopes("https://database.windows.net/.default"))
                        .block();
                if (token != null)
                    ds.setAccessToken(token.getToken());
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> options = (Map<String, Object>) config.get("options");
            if (options != null) {
                if (options.containsKey("encrypt"))
                    ds.setEncrypt(Boolean.TRUE.equals(options.get("encrypt")));
                if (options.containsKey("trustServerCertificate"))
                    ds.setTrustServerCertificate(Boolean.TRUE.equals(options.get("trustServerCertificate")));
            }

            List<Map<String, Object>> results = new ArrayList<>();
            try (Connection conn = ds.getConnection();
                    Statement stmt = conn.createStatement();
                    ResultSet rs = stmt.executeQuery(fetchQuery)) {

                ResultSetMetaData meta = rs.getMetaData();
                int colCount = meta.getColumnCount();

                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 1; i <= colCount; i++) {
                        String label = meta.getColumnLabel(i);
                        Object val = rs.getObject(i);
                        row.put(label, val);
                    }
                    results.add(row);
                }
            }
            return results;
        } catch (Exception e) {
            throw new SyncException(MessageUtils.get("error.sync.sqlfetch", e.getMessage()), e);
        }
    }

    @SuppressWarnings("unchecked")

    private List<Map<String, Object>> extractRootPath(List<Map<String, Object>> data, String rootPath) {
        if (data.size() == 1) {
            Map<String, Object> root = data.get(0);
            Object value = resolvePath(root, rootPath);
            if (value instanceof List) {
                return (List<Map<String, Object>>) value;
            } else if (value instanceof Map) {
                return Collections.singletonList((Map<String, Object>) value);
            }
        }
        return data;
    }

    private List<Map<String, Object>> fetchFromRestApi(DataSource source, String fetchQuery, String method,
            Object body, String paginationConfig, String rootPath) {
        try {
            Map<String, Object> config = objectMapper.readValue(source.getConfig(), new TypeReference<>() {
            });
            String baseUrl = (String) config.get(AppConstants.CONFIG_BASE_URL);
            String url = fetchQuery;
            if (baseUrl != null) {
                String cleanBase = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
                String cleanEndpoint = fetchQuery.startsWith("/") ? fetchQuery.substring(1) : fetchQuery;
                url = cleanBase + "/" + cleanEndpoint;
            }
            Map<String, String> headers = objectMapper.convertValue(config.get(AppConstants.CONFIG_HEADERS),
                    new TypeReference<>() {
                    });
            if (headers == null) {
                headers = new HashMap<>();
            }
            if (config.containsKey("authRequest")) {
                try {
                    Map<String, Object> authConfig = objectMapper.convertValue(config.get("authRequest"),
                            new TypeReference<>() {
                            });
                    String token = fetchDynamicToken(authConfig);
                    if (token != null) {
                        headers.put("Authorization", "Bearer " + token);
                    }
                } catch (Exception e) {
                    logger.error("Failed to fetch dynamic token", e);
                    throw new SyncException(MessageUtils.get("error.sync.auth.dynamic", e.getMessage()), e);
                }
            }

            if (method == null || method.isEmpty())
                method = "GET";

            int maxPages = 100;
            int pageCount = 0;
            boolean hasNextPage = true;
            String paginationType = "NONE";
            String nextKeyParam = null;
            String nextKeyValue = null;
            int limit = 100;
            int offset = 0;
            int pageNum = 1;

            if (paginationConfig != null && !paginationConfig.isEmpty()) {
                logger.info("Pagination Config: {}", paginationConfig);
                Map<String, String> pConfig = objectMapper.readValue(paginationConfig, new TypeReference<>() {});
                paginationType = pConfig.getOrDefault("type", "NONE");
                nextKeyParam = pConfig.get("nextKey");
                try {
                    limit = Integer.parseInt(pConfig.getOrDefault("limit", "100"));
                } catch (NumberFormatException e) {
                    limit = 100;
                }
            }

            List<Map<String, Object>> allResults = new ArrayList<>();
            String currentUrl = url;

            while (hasNextPage && pageCount < maxPages) {
                pageCount++;

                if (pageCount > 1) {
                    if ("OFFSET".equalsIgnoreCase(paginationType)) {
                        offset += limit;
                        currentUrl = updateQueryParam(currentUrl, nextKeyParam, String.valueOf(offset));
                    } else if ("PAGE".equalsIgnoreCase(paginationType)) {
                        pageNum++;
                        currentUrl = updateQueryParam(currentUrl, nextKeyParam, String.valueOf(pageNum));
                    } else if ("CURSOR".equalsIgnoreCase(paginationType)) {
                        if (nextKeyValue == null || nextKeyValue.isEmpty()) {
                            hasNextPage = false;
                            break;
                        }
                        currentUrl = updateQueryParam(currentUrl, nextKeyParam, nextKeyValue);
                    } else if ("LINK_HEADER".equalsIgnoreCase(paginationType)) {
                        if (nextKeyValue == null || nextKeyValue.isEmpty()) {
                            hasNextPage = false;
                            break;
                        }
                        currentUrl = nextKeyValue;
                    }
                } else if (!"NONE".equalsIgnoreCase(paginationType) && !"LINK_HEADER".equalsIgnoreCase(paginationType) && !"CURSOR".equalsIgnoreCase(paginationType)) {
                    if ("OFFSET".equalsIgnoreCase(paginationType)) {
                        currentUrl = updateQueryParam(currentUrl, nextKeyParam, String.valueOf(offset));
                        currentUrl = updateQueryParam(currentUrl, "limit", String.valueOf(limit));
                    } else if ("PAGE".equalsIgnoreCase(paginationType)) {
                        currentUrl = updateQueryParam(currentUrl, nextKeyParam, String.valueOf(pageNum));
                    }
                }

                logger.info("Executing REST Request Page {}: Method={}, URL={}", pageCount, method, currentUrl);
                ResponseEntity<String> response = restClient.fetchResponse(currentUrl, method, headers, body);
                String jsonBody = response.getBody();

                List<Map<String, Object>> pageResults = Collections.emptyList();
                Map<String, Object> singleObj = null;

                if (jsonBody != null && !jsonBody.isEmpty()) {
                    if (jsonBody.trim().startsWith("[")) {
                        pageResults = objectMapper.readValue(jsonBody, new TypeReference<List<Map<String, Object>>>() {});
                    } else {
                        singleObj = objectMapper.readValue(jsonBody, new TypeReference<Map<String, Object>>() {});
                        pageResults = Collections.singletonList(singleObj);
                    }
                }

                if (pageResults.isEmpty()) {
                    hasNextPage = false;
                    break;
                }

                if ("CURSOR".equalsIgnoreCase(paginationType)) {
                    if (singleObj != null && nextKeyParam != null) {
                        Object cursorObj = resolvePath(singleObj, nextKeyParam);
                        nextKeyValue = cursorObj != null ? String.valueOf(cursorObj) : null;
                    }
                } else if ("LINK_HEADER".equalsIgnoreCase(paginationType)) {
                    List<String> linkHeaders = response.getHeaders().get("Link");
                    nextKeyValue = extractNextLink(linkHeaders);
                }

                if (rootPath != null && !rootPath.trim().isEmpty()) {
                    pageResults = extractRootPath(pageResults, rootPath);
                }

                allResults.addAll(pageResults);

                if ("NONE".equalsIgnoreCase(paginationType)) {
                    hasNextPage = false;
                } else if ("OFFSET".equalsIgnoreCase(paginationType) || "PAGE".equalsIgnoreCase(paginationType)) {
                    if (pageResults.size() < limit) {
                        hasNextPage = false;
                    }
                }
            }
            logger.info("Pagination finished. Total records: {}", allResults.size());
            return allResults;
        } catch (Exception e) {
            throw new SyncException(MessageUtils.get("error.sync.restfetch"), e);
        }
    }

    private String extractNextLink(List<String> linkHeaders) {
        if (linkHeaders == null) return null;
        for (String header : linkHeaders) {
            String[] parts = header.split(",");
            for (String part : parts) {
                if (part.contains("rel=\"next\"") || part.contains("rel=next")) {
                    int start = part.indexOf('<');
                    int end = part.indexOf('>');
                    if (start != -1 && end != -1 && start < end) {
                        return part.substring(start + 1, end);
                    }
                }
            }
        }
        return null;
    }

    private String updateQueryParam(String url, String paramName, String paramValue) {
        if (paramName == null || paramName.isEmpty() || paramValue == null) return url;
        return UriComponentsBuilder.fromUriString(url)
                .replaceQueryParam(paramName, paramValue)
                .toUriString();
    }

    @SuppressWarnings("unchecked")
    private String fetchDynamicToken(Map<String, Object> authConfig) {
        String url = (String) authConfig.get("url");
        String method = (String) authConfig.getOrDefault("method", "POST");
        String tokenPath = (String) authConfig.getOrDefault("tokenPath", "access_token");
        Map<String, String> headers = new HashMap<>();
        if (authConfig.containsKey("headers")) {
            Map<String, String> configuredHeaders = objectMapper.convertValue(authConfig.get("headers"),
                    new TypeReference<>() {
                    });
            if (configuredHeaders != null) {
                headers.putAll(configuredHeaders);
            }
        }
        if (!headers.containsKey(HttpHeaders.CONTENT_TYPE)) {
            headers.put(HttpHeaders.CONTENT_TYPE,
                    MediaType.APPLICATION_FORM_URLENCODED_VALUE);
        }
        Object bodyObj = authConfig.get("body");
        Object requestBody = bodyObj;
        if (org.springframework.http.MediaType.APPLICATION_FORM_URLENCODED_VALUE
                .equals(headers.get(org.springframework.http.HttpHeaders.CONTENT_TYPE))) {
            if (bodyObj instanceof Map) {
                LinkedMultiValueMap<String, String> formParams = new org.springframework.util.LinkedMultiValueMap<>();
                Map<String, Object> bodyMap = (Map<String, Object>) bodyObj;
                if (authConfig.containsKey("clientId"))
                    formParams.add("client_id", (String) authConfig.get("clientId"));
                if (authConfig.containsKey("clientSecret"))
                    formParams.add("client_secret", (String) authConfig.get("clientSecret"));
                if (authConfig.containsKey("grantType"))
                    formParams.add("grant_type", (String) authConfig.get("grantType"));
                if (authConfig.containsKey("scope"))
                    formParams.add("scope", (String) authConfig.get("scope"));
                for (Map.Entry<String, Object> entry : bodyMap.entrySet()) {
                    String key = entry.getKey();
                    if (!key.equals("client_id") && !key.equals("client_secret") &&
                            !key.equals("grant_type") && !key.equals("scope")) {
                        formParams.add(key, String.valueOf(entry.getValue()));
                    }
                }
                requestBody = formParams;
            } else if (bodyObj == null && (authConfig.containsKey("clientId") || authConfig.containsKey("grantType"))) {
                org.springframework.util.LinkedMultiValueMap<String, String> formParams = new org.springframework.util.LinkedMultiValueMap<>();
                if (authConfig.containsKey("clientId"))
                    formParams.add("client_id", (String) authConfig.get("clientId"));
                if (authConfig.containsKey("clientSecret"))
                    formParams.add("client_secret", (String) authConfig.get("clientSecret"));
                if (authConfig.containsKey("scope"))
                    formParams.add("scope", (String) authConfig.get("scope"));
                requestBody = formParams;
            }
        }
        logger.info("Fetching Dynamic Token: URL={}, Method={}", url, method);
        logger.debug("Token Request Headers: {}", headers);
        logger.debug("Token Request Body: {}", requestBody);
        List<Map<String, Object>> response = restClient.fetchData(url, method, headers, requestBody);
        if (response != null && !response.isEmpty()) {
            Map<String, Object> tokenResponse = response.get(0);
            Object token = resolvePath(tokenResponse, tokenPath);
            return token != null ? token.toString() : null;
        }
        return null;
    }

    private List<Map<String, Object>> fetchFromFile(DataSource source, String fetchQuery) {
        try {
            Map<String, Object> config = objectMapper.readValue(source.getConfig(), new TypeReference<>() {
            });
            String path = (String) config.get(AppConstants.CONFIG_PATH);
            String format = (String) config.get(AppConstants.CONFIG_FORMAT);
            String targetPath = (fetchQuery != null && !fetchQuery.trim().isEmpty()) ? fetchQuery : path;
            return fileService.readFile(targetPath, format);
        } catch (Exception e) {
            throw new SyncException(MessageUtils.get("error.sync.filefetch"), e);
        }
    }

    public List<Map<String, Object>> applyFieldMapping(List<Map<String, Object>> rawData, String mappingJson) {
        if (mappingJson == null || mappingJson.isEmpty()) {
            return rawData;
        }
        try {
            Map<String, String> mapping = objectMapper.readValue(mappingJson, new TypeReference<>() {
            });
            List<Map<String, Object>> transformed = new ArrayList<>();
            for (Map<String, Object> row : rawData) {
                Map<String, Object> newRow = new HashMap<>();
                for (Map.Entry<String, String> mapEntry : mapping.entrySet()) {
                    String targetField = mapEntry.getKey();
                    String sourcePath = mapEntry.getValue();
                    Object val = resolvePath(row, sourcePath);
                    if (val instanceof Map || val instanceof List) {
                        val = convertToString(val);
                    }
                    newRow.put(targetField, val);
                }
                transformed.add(newRow);
            }
            return transformed;
        } catch (Exception e) {
            logger.warn("Mapping failed, using raw data", e);
            return rawData;
        }
    }

    private String convertToString(Object val) {
        try {
            return objectMapper.writeValueAsString(val);
        } catch (Exception e) {
            return val.toString();
        }
    }

    private Object resolvePath(Map<String, Object> obj, String path) {
        if (path == null || obj == null)
            return null;
        String cleanPath = path.replaceAll("\\[(\\d+)\\]", ".$1");
        String[] parts = cleanPath.split("\\.");
        Object current = obj;
        for (String part : parts) {
            if (current instanceof Map) {
                current = ((Map<?, ?>) current).get(part);
            } else if (current instanceof List) {
                try {
                    int index = Integer.parseInt(part);
                    List<?> list = (List<?>) current;
                    if (index >= 0 && index < list.size()) {
                        current = list.get(index);
                    } else {
                        return null;
                    }
                } catch (NumberFormatException e) {
                    return null;
                }
            } else {
                return null;
            }
            if (current == null)
                return null;
        }
        return current;
    }

    private Map<String, String> inferSchema(Map<String, Object> row) {
        Map<String, String> schema = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : row.entrySet()) {
            Object val = entry.getValue();
            if (val instanceof Integer || val instanceof Long) {
                schema.put(entry.getKey(), "INTEGER");
            } else if (val instanceof Double || val instanceof Float) {
                schema.put(entry.getKey(), "FLOAT");
            } else {
                schema.put(entry.getKey(), "NVARCHAR(MAX)");
            }
        }
        return schema;
    }

    private List<Map<String, Object>> sanitizeDataKeys(List<Map<String, Object>> data) {
        if (data == null || data.isEmpty())
            return data;
        List<Map<String, Object>> sanitized = new ArrayList<>();
        for (Map<String, Object> row : data) {
            Map<String, Object> newRow = new HashMap<>();
            for (Map.Entry<String, Object> entry : row.entrySet()) {
                String key = entry.getKey();
                String safeKey = key.replaceAll("\\W", "_");
                newRow.put(safeKey, entry.getValue());
            }
            sanitized.add(newRow);
        }
        return sanitized;
    }

    public List<SyncDefinition> getAll() {
        return syncRepo.findAll();
    }

    public SyncDefinition create(SyncDefinition entity) {
        return syncRepo.save(entity);
    }

    @Transactional
    public Optional<SyncDefinition> update(Long id, SyncDefinition entity) {
        Optional<SyncDefinition> existingOpt = syncRepo.findById(id);
        if (existingOpt.isEmpty())
            return Optional.empty();
        SyncDefinition existing = existingOpt.get();
        String oldName = existing.getTargetTableName();
        String newName = entity.getTargetTableName();
        if (entity.getLastRunAt() == null)
            entity.setLastRunAt(existing.getLastRunAt());
        if (entity.getLastStatus() == null)
            entity.setLastStatus(existing.getLastStatus());
        entity.setId(id);


        for (WidgetDefinition w : existing.getWidgets()) {
            w.setSchemaChanged(true);
        }
        widgetRepo.saveAll(existing.getWidgets());
        for (NotificationRule n : existing.getNotificationRules()) {
            n.setSchemaChanged(true);
        }
        notifRepo.saveAll(existing.getNotificationRules());

        SyncDefinition saved = syncRepo.save(entity);
        if (newName != null && !newName.equals(oldName)) {
            logger.info("Renaming detected: Updating dependencies from {} to {}", oldName, newName);
            widgetRepo.updateDataSourceTable(oldName, newName);
            notifRepo.updateLocalTableName(oldName, newName);
            tableManager.dropTable(oldName);
        }
        return Optional.of(saved);
    }

    public boolean delete(Long id) {
        SyncDefinition sync = syncRepo.findById(id).orElse(null);
        if (sync == null)
            return false;

        String tableName = sync.getTargetTableName();
        self.deleteSyncMetadata(id);

        try {
            tableManager.dropTable(tableName);
        } catch (Exception e) {
            logger.warn("Failed to drop table {} after deleting sync definition {}: {}", tableName, id, e.getMessage());
        }
        return true;
    }

    @Transactional
    public void deleteSyncMetadata(Long id) {
        logger.info("Attempting to delete metadata for Sync ID: {}", id);
        SyncDefinition sync = syncRepo.findById(id).orElse(null);
        if (sync == null) {
            logger.warn("Sync Definition ID {} not found during metadata delete", id);
            return;
        }
        String tableName = sync.getTargetTableName();


        for (WidgetDefinition w : sync.getWidgets()) {
            w.setSchemaChanged(true);
            w.setSyncDefinition(null);
        }
        widgetRepo.saveAll(sync.getWidgets());

        logger.info("Marking dependent Notification Rules as schema-changed for table: {}", tableName);
        for (NotificationRule n : sync.getNotificationRules()) {
            n.setSchemaChanged(true);
            n.setSyncDefinition(null);
        }
        notifRepo.saveAll(sync.getNotificationRules());


        syncRepo.deleteById(id);


        try {
            tableManager.dropTable(tableName);
        } catch (Exception e) {
            logger.warn("Failed to drop table {}: {}", tableName, e.getMessage());
        }


    }

    public SyncDefinition getById(Long id) {
        return syncRepo.findById(id).orElse(null);
    }

    private void updateStatus(SyncDefinition sync, String status) {
        sync.setLastStatus(status);
        sync.setLastRunAt(LocalDateTime.now());
        syncRepo.save(sync);
    }
}
