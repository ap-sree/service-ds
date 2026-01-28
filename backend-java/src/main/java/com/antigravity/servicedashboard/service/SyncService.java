package com.antigravity.servicedashboard.service;

import com.antigravity.servicedashboard.entity.DataSource;
import com.antigravity.servicedashboard.entity.SyncDefinition;
import com.antigravity.servicedashboard.repository.DataSourceRepository;
import com.antigravity.servicedashboard.repository.NotificationRuleRepository;
import com.antigravity.servicedashboard.repository.SyncDefinitionRepository;
import com.antigravity.servicedashboard.repository.WidgetDefinitionRepository;
import com.antigravity.servicedashboard.constant.AppConstants;
import com.antigravity.servicedashboard.exception.SyncException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

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
            List<Map<String, Object>> rawData = fetchData(source, sync.getFetchQuery());
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

    public List<Map<String, Object>> previewData(Long sourceId, String fetchQuery) {
        Optional<DataSource> sourceOpt = sourceRepo.findById(sourceId);
        if (sourceOpt.isEmpty()) {
            throw new IllegalArgumentException("DataSource not found ID: " + sourceId);
        }
        List<Map<String, Object>> data = fetchData(sourceOpt.get(), fetchQuery);
        if (data.size() > 5) {
            return data.subList(0, 5);
        }
        return data;
    }

    private List<Map<String, Object>> fetchData(DataSource source, String fetchQuery) {
        try {
            if (AppConstants.DS_TYPE_REST_API.equals(source.getType())) {
                return fetchFromRestApi(source, fetchQuery);
            } else if (AppConstants.DS_TYPE_LOCAL_COMMAND.equals(source.getType())) {
                return shellService.executeCommand(fetchQuery, ".");
            } else if (AppConstants.DS_TYPE_LOCAL_FILE.equals(source.getType())) {
                return fetchFromFile(source, fetchQuery);
            }
        } catch (SyncException e) {
            throw e;
        } catch (Exception e) {
            throw new SyncException("Failed to fetch data from source " + source.getName(), e);
        }
        return Collections.emptyList();
    }

    private List<Map<String, Object>> fetchFromRestApi(DataSource source, String fetchQuery) {
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

            return restClient.fetchData(url, "GET", headers);
        } catch (Exception e) {
            throw new SyncException("Rest API fetch failed", e);
        }
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

    private List<Map<String, Object>> applyFieldMapping(List<Map<String, Object>> rawData, String mappingJson) {
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
                schema.put(entry.getKey(), "REAL");
            } else {
                schema.put(entry.getKey(), "TEXT");
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
        if (!syncRepo.existsById(id))
            return false;

        self.deleteSyncCascade(id);
        return true;
    }

    @Transactional
    public void deleteSyncCascade(Long id) {
        SyncDefinition sync = syncRepo.findById(id).orElse(null);
        if (sync == null)
            return;

        String tableName = sync.getTargetTableName();

        widgetRepo.deleteByDataSourceTable(tableName);

        notifRepo.deleteByLocalTableName(tableName);

        tableManager.dropTable(tableName);

        syncRepo.deleteById(id);
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
