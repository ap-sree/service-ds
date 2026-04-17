package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.service.TableService;
import com.antigravity.servicedashboard.constant.AppConstants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/widgets")
public class WidgetDataController {

    private static final Logger logger = LoggerFactory.getLogger(WidgetDataController.class);

    private final TableService service;

    public WidgetDataController(TableService service) {
        this.service = service;
    }

    @GetMapping("/{id}/data")
    public ResponseEntity<Object> getWidgetData(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "100") int limit) {

        String userId = jwt.getSubject();

        try {
            Map<String, Object> data = service.fetchWidgetData(id, userId, limit);
            if (data == null)
                return ResponseEntity.notFound().build();
            return ResponseEntity.ok(data);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(AppConstants.KEY_ERROR, e.getMessage()));
        } catch (Exception e) {
            logger.error("Widget data fetch error for id={}", id, e);
            return ResponseEntity.internalServerError().body(Map.of(AppConstants.KEY_ERROR, "An error occurred while fetching widget data."));
        }
    }

    @GetMapping("/{id}/schema")
    public ResponseEntity<Object> getTableSchema(@PathVariable("id") Long id) {
        try {
            return ResponseEntity.ok(service.getTableSchema(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(AppConstants.KEY_ERROR, e.getMessage()));
        } catch (Exception e) {
            logger.error("Schema fetch error for widget id={}", id, e);
            return ResponseEntity.internalServerError().body(Map.of(AppConstants.KEY_ERROR, "Failed to retrieve schema."));
        }
    }
}

