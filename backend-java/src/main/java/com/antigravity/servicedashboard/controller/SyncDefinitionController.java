package com.antigravity.servicedashboard.controller;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.antigravity.servicedashboard.dto.TaskExecutionSummary;
import com.antigravity.servicedashboard.entity.SyncDefinition;
import com.antigravity.servicedashboard.service.SyncService;
import com.antigravity.servicedashboard.util.MessageUtils;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/sync-defs")
public class SyncDefinitionController {

    private static final Logger logger = LoggerFactory.getLogger(SyncDefinitionController.class);

    private final SyncService syncService;
    private final com.antigravity.servicedashboard.service.TableService tableService;

    public SyncDefinitionController(SyncService syncService, com.antigravity.servicedashboard.service.TableService tableService) {
        this.syncService = syncService;
        this.tableService = tableService;
    }

    @GetMapping("/{id}/schema")
    public ResponseEntity<Object> getSyncTableSchema(@PathVariable("id") Long id) {
        try {
            return ResponseEntity.ok(tableService.getSyncSchema(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            logger.error("Schema fetch error for sync id={}", id, e);
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to retrieve schema. Please try again later."));
        }
    }

    @GetMapping("/{id}/data")
    public ResponseEntity<Object> getSyncData(@PathVariable("id") Long id) {
        try {
            return ResponseEntity.ok(tableService.fetchSyncData(id));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            logger.error("Data fetch error for sync id={}", id, e);
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to retrieve data."));
        }
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
    }

    @PostMapping("/sync/{id}")
    public ResponseEntity<Object> triggerSync(@PathVariable Long id) {
        SyncDefinition sync = syncService.getById(id);
        if (sync == null)
            throw new IllegalArgumentException(MessageUtils.get("error.sync.notfound"));
        syncService.runSyncJob(sync);
        return ResponseEntity.ok(Map.of("status", "Sync Completed"));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<List<TaskExecutionSummary>> getHistory(@PathVariable Long id) {
        return ResponseEntity.ok(syncService.getSyncHistory(id));
    }
}
