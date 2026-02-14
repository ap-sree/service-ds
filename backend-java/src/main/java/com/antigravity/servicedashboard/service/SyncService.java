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

import com.antigravity.servicedashboard.constant.AppConstants;
import com.antigravity.servicedashboard.entity.DataSource;
import com.antigravity.servicedashboard.entity.SyncDefinition;
import com.antigravity.servicedashboard.exception.SyncException;
import com.antigravity.servicedashboard.repository.DataSourceRepository;
import com.antigravity.servicedashboard.repository.NotificationRuleRepository;
import com.antigravity.servicedashboard.repository.SyncDefinitionRepository;
import com.antigravity.servicedashboard.repository.WidgetDefinitionRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

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
            throw new IllegalArgumentException("DataSource not found ID: " + sync.getSourceId());
        }
        DataSource source = sourceOpt.get();
        try {
            String method = sync.getHttpMethod() != null ? sync.getHttpMethod() : "GET";
            Object body = sync.getRequestBody();
            List<Map<String, Object>> rawData = fetchData(source, sync.getFetchQuery(), method, body, null,
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
            throw new SyncException("Sync job failed for " + sync.getTargetTableName(), e);
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
            throw new IllegalArgumentException("DataSource not found ID: " + sourceId);
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
                result = fetchFromRestApi(source, fetchQuery, method, body, paginationConfig);
            } else if (AppConstants.DS_TYPE_LOCAL_COMMAND.equals(source.getType())) {
                result = shellService.executeCommand(fetchQuery, ".");
            } else if (AppConstants.DS_TYPE_LOCAL_FILE.equals(source.getType())) {
                result = fetchFromFile(source, fetchQuery);
            }
            if (rootPath != null && !rootPath.trim().isEmpty() && !result.isEmpty()) {
                return extractRootPath(result, rootPath);
            }
            return result;
        } catch (SyncException e) {
            throw e;
        } catch (Exception e) {
            throw new SyncException("Failed to fetch data from source " + source.getName(), e);
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
            Object body, String paginationConfig) {
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
                    throw new SyncException("Failed to fetch dynamic token: " + e.getMessage(), e);
                }
            }

            if (method == null || method.isEmpty())
                method = "GET";
            logger.info("Executing REST Request: Method={}, URL={}", method, url);
            logger.debug("Request Headers: {}", headers.keySet());
            if (body != null) {
                logger.debug("Request Body: {}", body);
            }
            if (paginationConfig != null && !paginationConfig.isEmpty()) {
                logger.info("Pagination Enabled: {}", paginationConfig);
                // TODO: Implement full pagination loop
                // 1. Parse config
                // 2. Loop while next page exists
                // 3. Merge results
                // For now, fetching first page
            }
            return restClient.fetchData(url, method, headers, body);
        } catch (Exception e) {
            throw new SyncException("Rest API fetch failed", e);
        }
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
        if (!headers.containsKey(org.springframework.http.HttpHeaders.CONTENT_TYPE)) {
            headers.put(org.springframework.http.HttpHeaders.CONTENT_TYPE,
                    org.springframework.http.MediaType.APPLICATION_FORM_URLENCODED_VALUE);
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
            throw new SyncException("File fetch failed", e);
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
        logger.info("Deleting dependent Widgets for table: {}", tableName);
        widgetRepo.deleteByDataSourceTable(tableName);
        logger.info("Deleting dependent Notification Rules for table: {}", tableName);
        notifRepo.deleteByLocalTableName(tableName);
        logger.info("Deleting Sync Definition record ID: {}", id);
        syncRepo.deleteById(id);

        // Drop the actual H2 table
        try {
            tableManager.dropTable(tableName);
        } catch (Exception e) {
            logger.warn("Failed to drop table {}: {}", tableName, e.getMessage());
        }

        logger.info("Metadata delete transaction completed successfully for ID: {}", id);
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
