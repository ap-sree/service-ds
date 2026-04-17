package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.dto.UserDTO;
import com.antigravity.servicedashboard.entity.WidgetDefinition;
import com.antigravity.servicedashboard.mapper.UserMapper;
import com.antigravity.servicedashboard.model.UserPreferences;
import com.antigravity.servicedashboard.service.AppConfigService;
import com.antigravity.servicedashboard.service.UserService;
import com.antigravity.servicedashboard.service.WidgetService;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final UserService userService;
    private final UserMapper userMapper;
    private final AppConfigService appConfigService;
    private final WidgetService widgetService;

    public AuthController(UserService userService, UserMapper userMapper,
            AppConfigService appConfigService, WidgetService widgetService) {
        this.userService = userService;
        this.userMapper = userMapper;
        this.appConfigService = appConfigService;
        this.widgetService = widgetService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserDTO> me(@AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getClaimAsString("preferred_username");
        if (username == null) {
            username = jwt.getSubject();
        }
        UserDTO userDTO = userMapper.toDTO(userService.verifyOrCreate(username));


        UserPreferences userPrefs = userService.getPreferences(username);
        Integer refreshInterval = null;
        List<Long> layout = null;

        if (userPrefs != null) {
            refreshInterval = userPrefs.getRefreshInterval();
            layout = userPrefs.getWidgetIds();
        }


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


        List<WidgetDefinition> widgets = widgetService.getWidgetsForUser(username);
        List<Map<String, Object>> widgetSummaries = new ArrayList<>();
        for (WidgetDefinition w : widgets) {
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("id", w.getId());
            summary.put("title", w.getTitle());
            summary.put("type", w.getType());
            summary.put("schemaChanged", w.isSchemaChanged());
            widgetSummaries.add(summary);
        }


        Map<String, Object> dashboardConfig = new LinkedHashMap<>();
        dashboardConfig.put("widgets", widgetSummaries);
        dashboardConfig.put("refreshInterval", refreshInterval);
        dashboardConfig.put("layout", layout);

        userDTO.setDashboardConfig(dashboardConfig);

        return ResponseEntity.ok(userDTO);
    }
}
