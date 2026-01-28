package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.service.TableService;
import com.antigravity.servicedashboard.constant.AppConstants;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class WidgetDataController {

    private final TableService service;

    @Autowired
    public WidgetDataController(TableService service) {
        this.service = service;
    }

    @GetMapping("/widgets/{id}/data")
    public ResponseEntity<Object> getWidgetData(
            @PathVariable Long id,
            @RequestParam(required = false) String userId,
            @RequestParam(defaultValue = "100") int limit) {

        try {
            Map<String, Object> data = service.fetchWidgetData(id, userId, limit);
            if (data == null)
                return ResponseEntity.notFound().build();
            return ResponseEntity.ok(data);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(AppConstants.KEY_ERROR, e.getMessage()));
        } catch (Exception e) {
            if (e.getMessage() != null && e.getMessage().contains("Table not ready")) {
                return ResponseEntity.status(404).body(Map.of(AppConstants.KEY_ERROR, "Table not ready"));
            }
            return ResponseEntity.internalServerError().body(Map.of(AppConstants.KEY_ERROR, e.getMessage()));
        }
    }

    @GetMapping("/schema/{tableName}")
    public ResponseEntity<Object> getTableSchema(@PathVariable String tableName) {
        try {
            return ResponseEntity.ok(service.getTableSchema(tableName));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(AppConstants.KEY_ERROR, e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(AppConstants.KEY_ERROR, e.getMessage()));
        }
    }
}
