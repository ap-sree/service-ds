package com.antigravity.servicedashboard.controller;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.antigravity.servicedashboard.dto.DashboardConfigDTO;
import com.antigravity.servicedashboard.dto.WidgetDefinitionDTO;
import com.antigravity.servicedashboard.entity.WidgetDefinition;
import com.antigravity.servicedashboard.mapper.WidgetDefinitionMapper;
import com.antigravity.servicedashboard.model.UserPreferences;
import com.antigravity.servicedashboard.service.AppConfigService;
import com.antigravity.servicedashboard.service.UserService;
import com.antigravity.servicedashboard.service.WidgetService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/widgets")
public class WidgetDefinitionController {

    private static final Logger logger = LoggerFactory.getLogger(WidgetDefinitionController.class);

    private final WidgetService service;
    private final UserService userService;
    private final AppConfigService appConfigService;
    private final WidgetDefinitionMapper widgetMapper;

    public WidgetDefinitionController(WidgetService service, UserService userService,
            AppConfigService appConfigService, WidgetDefinitionMapper widgetMapper) {
        this.service = service;
        this.userService = userService;
        this.appConfigService = appConfigService;
        this.widgetMapper = widgetMapper;
    }

    @GetMapping
    public ResponseEntity<DashboardConfigDTO> getWidgets(@AuthenticationPrincipal Jwt jwt) {
        try {
            // Extract username from JWT subject claim
            String username = jwt.getSubject();

            List<WidgetDefinition> widgets = service.getWidgetsForUser(username);
            List<WidgetDefinitionDTO> widgetDTOs = widgetMapper.toDTOList(widgets);

            // Get user preferences
            UserPreferences userPrefs = userService.getPreferences(username);

            // Use user's refresh interval if set, otherwise fall back to global config
            Integer refreshInterval = null;
            List<Long> layout = null;

            if (userPrefs != null) {
                refreshInterval = userPrefs.getRefreshInterval();
                layout = userPrefs.getWidgetIds();
            }

            // Fallback to global config if any preferences are missing
            if (refreshInterval == null || layout == null || layout.isEmpty()) {
                UserPreferences globalPrefs = appConfigService.getGlobalDashboardLayout();
                if (globalPrefs != null) {
                    if (refreshInterval == null) {
                        refreshInterval = globalPrefs.getRefreshInterval();
                    }
                    if (layout == null || layout.isEmpty()) {
                        layout = globalPrefs.getWidgetIds();
                    }
                }
            }

            DashboardConfigDTO config = new DashboardConfigDTO(widgetDTOs, refreshInterval, layout);
            return ResponseEntity.ok(config);
        } catch (Exception e) {
            logger.error("Error fetching widgets", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/catalog")
    public ResponseEntity<List<WidgetDefinitionDTO>> getCatalog() {
        List<WidgetDefinition> entities = service.getCatalog();
        return ResponseEntity.ok(widgetMapper.toDTOList(entities));
    }

    @GetMapping("/admin")
    public ResponseEntity<List<WidgetDefinitionDTO>> getAllDefinitions() {
        List<WidgetDefinition> entities = service.getAllDefinitions();
        return ResponseEntity.ok(widgetMapper.toDTOList(entities));
    }

    @PostMapping
    public ResponseEntity<WidgetDefinitionDTO> create(@Valid @RequestBody WidgetDefinitionDTO dto) {
        WidgetDefinition entity = widgetMapper.toEntity(dto);
        WidgetDefinition saved = service.create(entity);
        return ResponseEntity.ok(widgetMapper.toDTO(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<WidgetDefinitionDTO> update(@PathVariable Long id,
            @Valid @RequestBody WidgetDefinitionDTO dto) {
        WidgetDefinition entity = widgetMapper.toEntity(dto);
        return service.update(id, entity)
                .map(widgetMapper::toDTO)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (service.delete(id)) {
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }
}
