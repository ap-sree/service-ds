package com.antigravity.servicedashboard.controller;

import com.antigravity.servicedashboard.entity.TaskDefinition;
import com.antigravity.servicedashboard.entity.TaskExecution;
import com.antigravity.servicedashboard.service.AutomationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import java.util.Map;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/automation")
public class AutomationController {

    @Autowired

    private AutomationService service;

    @GetMapping("/tasks")

    public List<TaskDefinition> getAllTasks() {
        return service.getAllTasks();
    }

    @PostMapping("/tasks")

    public TaskDefinition createTask(@Valid @RequestBody TaskDefinition task) {
        return service.createTask(task);
    }

    @PutMapping("/tasks/{id}")

    public ResponseEntity<TaskDefinition> updateTask(@PathVariable Long id, @Valid @RequestBody TaskDefinition task) {
        return service.updateTask(id, task)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/tasks/{id}")

    public ResponseEntity<Void> deleteTask(@PathVariable Long id) {
        if (service.deleteTask(id)) {
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/tasks/{id}/history")

    public List<TaskExecution> getHistory(@PathVariable Long id) {
        return service.getTaskHistory(id);
    }

    @GetMapping("/executions/{id}")

    public ResponseEntity<TaskExecution> getExecution(@PathVariable Long id) {
        return service.getExecution(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/tasks/{id}/execute")

    public TaskExecution executeTask(@PathVariable Long id,
            @RequestBody(required = false) Map<String, Object> runtimeParams) {
        return service.executeTask(id, runtimeParams);
    }

    @PostMapping("/execute")

    public TaskExecution executeAdHoc(@RequestBody Map<String, Object> request) {
        Long sourceId = ((Number) request.get("source_id")).longValue();
        String payload = (String) request.get("payload");
        return service.executeAdHoc(sourceId, payload);
    }
}
