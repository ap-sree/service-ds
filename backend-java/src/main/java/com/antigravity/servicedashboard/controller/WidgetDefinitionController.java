package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.entity.WidgetDefinition;
import com.antigravity.servicedashboard.service.WidgetService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class WidgetDefinitionController {

    private final WidgetService service;

    @Autowired
    public WidgetDefinitionController(WidgetService service) {
        this.service = service;
    }

    @GetMapping("/widgets")
    public ResponseEntity<Object> getWidgets(@RequestParam(required = false) String username) {
        if (username == null || username.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Username is required to fetch dashboard widgets.");
        }

        try {
            List<WidgetDefinition> result = service.getWidgetsForUser(username);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Error fetching widgets: " + e.getMessage());
        }
    }

    @GetMapping("/widget-catalog")
    public ResponseEntity<List<WidgetDefinition>> getCatalog() {
        return ResponseEntity.ok(service.getCatalog());
    }

    @GetMapping("/admin/widgets")
    public List<WidgetDefinition> getAllDefinitions() {
        return service.getAllDefinitions();
    }

    @PostMapping("/widgets")
    public WidgetDefinition create(@RequestBody WidgetDefinition entity) {
        return service.create(entity);
    }

    @PutMapping("/widgets/{id}")
    public ResponseEntity<WidgetDefinition> update(@PathVariable Long id, @RequestBody WidgetDefinition entity) {
        return service.update(id, entity)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/widgets/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (service.delete(id)) {
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }
}
