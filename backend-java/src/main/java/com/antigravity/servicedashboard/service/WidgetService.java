package com.antigravity.servicedashboard.service;

import com.antigravity.servicedashboard.entity.AppConfig;
import com.antigravity.servicedashboard.entity.User;
import com.antigravity.servicedashboard.entity.WidgetDefinition;
import com.antigravity.servicedashboard.repository.AppConfigRepository;
import com.antigravity.servicedashboard.repository.UserRepository;
import com.antigravity.servicedashboard.repository.WidgetDefinitionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class WidgetService {

    private static final Logger logger = LoggerFactory.getLogger(WidgetService.class);

    private final WidgetDefinitionRepository repository;
    private final UserRepository userRepository;
    private final AppConfigRepository appConfigRepository;
    private final com.antigravity.servicedashboard.repository.SyncDefinitionRepository syncRepo;

    public WidgetService(WidgetDefinitionRepository repository,
            UserRepository userRepository,
            AppConfigRepository appConfigRepository,
            com.antigravity.servicedashboard.repository.SyncDefinitionRepository syncRepo) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.appConfigRepository = appConfigRepository;
        this.syncRepo = syncRepo;
    }

    private final ObjectMapper mapper = new ObjectMapper();

    public List<WidgetDefinition> getWidgetsForUser(String username) {
        List<WidgetDefinition> allWidgets = repository.findAll();

        List<Long> activeIds = parseWidgetIds(null);

        boolean hasCustomLayout = false;

        if (username != null) {
            User user = userRepository.findById(username).orElse(null);
            if (user != null && user.getPreferences() != null && !user.getPreferences().isEmpty()) {
                activeIds = parseWidgetIds(user.getPreferences());
                hasCustomLayout = true;
                logger.debug("DEBUG: Used User Layout");
            }
        }

        if (!hasCustomLayout) {
            AppConfig globalConf = appConfigRepository.findById("global_dashboard_layout").orElse(null);
            if (globalConf != null) {
                activeIds = parseWidgetIds(globalConf.getValue());
                logger.debug("DEBUG: Used Global Layout");
            }
        }

        logger.debug("DEBUG: Final IDs: {}", activeIds);

        List<WidgetDefinition> result = new ArrayList<>();
        for (Long id : activeIds) {
            allWidgets.stream()
                    .filter(w -> w.getId().equals(id))
                    .findFirst()
                    .ifPresent(result::add);
        }
        return result;
    }

    public List<WidgetDefinition> getCatalog() {
        return repository.findAll();
    }

    public List<WidgetDefinition> getAllDefinitions() {
        return repository.findAll();
    }

    public WidgetDefinition create(WidgetDefinition entity) {
        if (entity.getDataSourceTable() != null) {
            syncRepo.findFirstByTargetTableName(entity.getDataSourceTable())
                    .ifPresent(entity::setSyncDefinition);
        }
        return repository.save(entity);
    }

    public Optional<WidgetDefinition> update(Long id, WidgetDefinition entity) {
        if (!repository.existsById(id))
            return Optional.empty();
        entity.setId(id);
        entity.setSchemaChanged(false);
        if (entity.getDataSourceTable() != null) {
            syncRepo.findFirstByTargetTableName(entity.getDataSourceTable())
                    .ifPresent(entity::setSyncDefinition);
        }
        return Optional.of(repository.save(entity));
    }

    public boolean delete(Long id) {
        if (!repository.existsById(id))
            return false;
        repository.deleteById(id);
        return true;
    }

    private List<Long> parseWidgetIds(String json) {
        List<Long> ids = new ArrayList<>();
        if (json == null || json.isEmpty())
            return ids;
        try {
            JsonNode root = mapper.readTree(json);

            // Handle double-encoded JSON string
            if (root.isTextual()) {
                try {
                    root = mapper.readTree(root.asText());
                } catch (Exception e) {
                    logger.warn("Failed to unwrap double-encoded JSON: {}", json);
                }
            }

            // Case 1: JSON Object with "widgetIds"
            if (root.isObject()) {
                if (root.has("widgetIds")) {
                    JsonNode idsNode = root.get("widgetIds");
                    if (idsNode.isArray()) {
                        for (JsonNode id : idsNode) {
                            ids.add(id.asLong());
                        }
                    }
                }
            }
            // Case 2: JSON Array of IDs (Legacy)
            else if (root.isArray()) {
                for (JsonNode id : root) {
                    ids.add(id.asLong());
                }
            }
        } catch (Exception e) {
            logger.warn("Failed to parse widget IDs from JSON: {}", json, e);
        }
        return ids;
    }
}
