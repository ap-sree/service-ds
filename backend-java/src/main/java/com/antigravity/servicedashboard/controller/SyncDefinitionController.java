package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.entity.SyncDefinition;
import com.antigravity.servicedashboard.service.SyncService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class SyncDefinitionController {

    private final SyncService syncService;

    @Autowired
    public SyncDefinitionController(SyncService syncService) {
        this.syncService = syncService;
    }

    @GetMapping("/api/sync-defs")
    public List<SyncDefinition> getAll() {
        return syncService.getAll();
    }

    @PostMapping("/api/sync-defs")
    public SyncDefinition create(@RequestBody SyncDefinition entity) {
        return syncService.create(entity);
    }

    @PutMapping("/api/sync-defs/{id}")
    public ResponseEntity<SyncDefinition> update(@PathVariable Long id, @RequestBody SyncDefinition entity) {
        return syncService.update(id, entity)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/api/sync-defs/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (syncService.delete(id)) {
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/api/preview")
    public ResponseEntity<Object> preview(@RequestBody Map<String, Object> body) {
        try {
            Long sourceId = ((Number) body.get("source_id")).longValue();
            String fetchQuery = (String) body.get("fetch_query");

            List<Map<String, Object>> sample = syncService.previewData(sourceId, fetchQuery);

            
            Map<String, String> mapping = new java.util.LinkedHashMap<>();
            if (!sample.isEmpty()) {
                sample.get(0).keySet().forEach(k -> mapping.put(k, k));
            }

            return ResponseEntity.ok(Map.of("sample", sample, "mapping", mapping));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    
    @PostMapping("/api/sync/{id}")
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
