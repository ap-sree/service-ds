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

import java.util.*;

@Service
public class WidgetService {

    private static final Logger logger = LoggerFactory.getLogger(WidgetService.class);

    private final WidgetDefinitionRepository repository;
    private final UserRepository userRepository;
    private final AppConfigRepository appConfigRepository;

    public WidgetService(WidgetDefinitionRepository repository,
            UserRepository userRepository,
            AppConfigRepository appConfigRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.appConfigRepository = appConfigRepository;
    }

    private final ObjectMapper mapper = new ObjectMapper();

    public List<WidgetDefinition> getWidgetsForUser(String username) {
        List<WidgetDefinition> allWidgets = repository.findAll();

        // 2. Resolve Layout
        List<Long> activeIds = parseWidgetIds(null);

        if (username != null) {
            User user = userRepository.findById(username).orElse(null);
            if (user != null && user.getPreferences() != null && !user.getPreferences().isEmpty()) {
                List<Long> userIds = parseWidgetIds(user.getPreferences());
                if (!userIds.isEmpty()) {
                    activeIds = userIds;
                    logger.debug("DEBUG: Used User Layout");
                }
            }
        }

        if (activeIds.isEmpty()) {
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
        return repository.save(entity);
    }

    public Optional<WidgetDefinition> update(Long id, WidgetDefinition entity) {
        if (!repository.existsById(id))
            return Optional.empty();
        entity.setId(id);
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
            com.antigravity.servicedashboard.model.UserPreferences prefs = mapper.readValue(json,
                    com.antigravity.servicedashboard.model.UserPreferences.class);
            if (prefs != null && prefs.getWidgetIds() != null) {
                return prefs.getWidgetIds();
            }
        } catch (Exception e) {
            try {
                JsonNode root = mapper.readTree(json);
                JsonNode idsNode = root.get("widgetIds");
                if (idsNode != null && idsNode.isArray()) {
                    for (JsonNode id : idsNode) {
                        ids.add(id.asLong());
                    }
                }
            } catch (Exception ex) {
                logger.warn("Failed to parse widget IDs from JSON: {}", json, ex);
            }
        }
        return ids;
    }
}
