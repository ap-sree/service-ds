package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.entity.SyncDefinition;
import com.antigravity.servicedashboard.service.SyncService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/sync-defs")
public class SyncDefinitionController {

    private final SyncService syncService;

    public SyncDefinitionController(SyncService syncService) {
        this.syncService = syncService;
    }

    @GetMapping
    public List<SyncDefinition> getAll() {
        return syncService.getAll();
    }

    @PostMapping
    public SyncDefinition create(@Valid @RequestBody SyncDefinition entity) {
        return syncService.create(entity);
    }

    @PutMapping("/{id}")
    public ResponseEntity<SyncDefinition> update(@PathVariable Long id, @Valid @RequestBody SyncDefinition entity) {
        return syncService.update(id, entity)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (syncService.delete(id)) {
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/preview")
    public ResponseEntity<Object> preview(@RequestBody Map<String, Object> body) {
        try {
            Long sourceId = ((Number) body.get("source_id")).longValue();
            String fetchQuery = (String) body.get("fetch_query");
            String method = (String) body.getOrDefault("method", "GET");
            String rootPath = (String) body.get("root_path");
            Object requestBody = body.get("body");
            List<Map<String, Object>> sample = syncService.previewData(sourceId, fetchQuery, method,
                    requestBody != null ? requestBody.toString() : null, rootPath);
            Map<String, String> mapping = new java.util.LinkedHashMap<>();
            if (!sample.isEmpty()) {
                sample.get(0).keySet().forEach(k -> mapping.put(k, k));
            }

            return ResponseEntity.ok(Map.of("sample", sample, "mapping", mapping));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/sync/{id}")
    public ResponseEntity<Object> triggerSync(@PathVariable Long id) {
        try {

            SyncDefinition sync = syncService.getById(id);
            if (sync == null)
                throw new IllegalArgumentException("Sync not found");
            syncService.runSyncJob(sync);
            return ResponseEntity.ok(Map.of("status", "Sync Completed"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
