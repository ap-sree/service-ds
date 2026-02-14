package com.antigravity.servicedashboard.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.antigravity.servicedashboard.entity.DataSource;
import com.antigravity.servicedashboard.entity.TaskDefinition;
import com.antigravity.servicedashboard.entity.TaskExecution;
import com.antigravity.servicedashboard.repository.DataSourceRepository;
import com.antigravity.servicedashboard.repository.TaskDefinitionRepository;
import com.antigravity.servicedashboard.repository.TaskExecutionRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class AutomationService {

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(AutomationService.class);

    @Autowired

    private TaskDefinitionRepository taskRepo;

    @Autowired

    private TaskExecutionRepository executionRepo;

    @Autowired

    private DataSourceRepository sourceRepo;

    @Autowired

    private SyncService syncService;

    @Autowired

    private ObjectMapper objectMapper;

    public List<TaskDefinition> getAllTasks() {
        return taskRepo.findAll();
    }

    public TaskDefinition createTask(TaskDefinition task) {
        return taskRepo.save(task);
    }

    public Optional<TaskDefinition> updateTask(Long id, TaskDefinition task) {
        if (!taskRepo.existsById(id))
            return Optional.empty();
        task.setId(id);
        return Optional.of(taskRepo.save(task));
    }

    public boolean deleteTask(Long id) {
        if (!taskRepo.existsById(id))
            return false;
        taskRepo.deleteById(id);
        return true;
    }

    public List<TaskExecution> getTaskHistory(Long taskId) {
        return executionRepo.findByTaskIdOrderByStartedAtDesc(taskId);
    }

    public Optional<TaskExecution> getExecution(Long id) {
        return executionRepo.findById(id);
    }

    public TaskExecution executeTask(Long taskId) {
        return executeTask(taskId, null);
    }

    public TaskExecution executeTask(Long taskId, Map<String, Object> runtimeParams) {
        TaskDefinition task = taskRepo.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found"));
        return runWithLogging(task.getSourceId(), task.getPayload(), taskId, "USER", runtimeParams);
    }

    public TaskExecution executeAdHoc(Long sourceId, String payload) {
        return runWithLogging(sourceId, payload, -1L, "USER (AdHoc)", null);
    }

    private TaskExecution runWithLogging(Long sourceId, String payload, Long taskId, String user,
            Map<String, Object> runtimeParams) {
        TaskExecution exec = new TaskExecution();
        exec.setTaskId(taskId);
        exec.setStartedAt(LocalDateTime.now());
        exec.setStatus("RUNNING");
        exec.setInputPayload(payload);
        exec.setTriggeredBy(user);
        exec = executionRepo.save(exec);
        try {
            DataSource source = sourceRepo.findById(sourceId)
                    .orElseThrow(() -> new IllegalArgumentException("Source not found"));
            String effectivePayload = resolveVariables(payload, runtimeParams);
            logger.debug("Effective Payload after substitution: {}", effectivePayload);
            exec.setInputPayload(effectivePayload);
            executionRepo.save(exec);
            Map<String, Object> payloadMap = objectMapper.readValue(effectivePayload, new TypeReference<>() {
            });
            String query = (String) payloadMap.get("fetch_query");
            Object mappingObj = payloadMap.get("mapping");
            String mapping = null;
            if (mappingObj instanceof Map) {
                mapping = objectMapper.writeValueAsString(mappingObj);
            } else if (mappingObj instanceof String) {
                mapping = (String) mappingObj;
            }
            String method = (String) payloadMap.getOrDefault("method", "GET");
            String rootPath = (String) payloadMap.get("root_path");
            Object body = payloadMap.get("body");

            Object paginationObj = payloadMap.get("pagination_config");
            String paginationConfig = null;
            if (paginationObj != null) {
                if (paginationObj instanceof String) {
                    paginationConfig = (String) paginationObj;
                } else {
                    paginationConfig = objectMapper.writeValueAsString(paginationObj);
                }
            }

            logger.info("Starting Automation Execution: TaskID={}, SourceID={}, User={}", taskId, sourceId, user);
            List<Map<String, Object>> data = syncService.fetchData(source, query, method, body, rootPath,
                    paginationConfig);
            List<Map<String, Object>> result = syncService.applyFieldMapping(data, mapping);
            String jsonResult = objectMapper.writeValueAsString(result);
            exec.setOutputResult(jsonResult);
            exec.setStatus("SUCCESS");
            updateTaskStatus(taskId, "SUCCESS", LocalDateTime.now());
            logger.info("Automation Execution Successful: TaskID={}, Records={}", taskId, result.size());
        } catch (Exception e) {
            logger.error("Automation Execution Failed: TaskID=" + taskId, e);
            exec.setStatus("FAILED");
            exec.setOutputResult("Error: " + e.getMessage());
            updateTaskStatus(taskId, "FAILED", LocalDateTime.now());
        } finally {
            exec.setCompletedAt(LocalDateTime.now());
            executionRepo.save(exec);
        }
        return exec;
    }

    private void updateTaskStatus(Long taskId, String status, LocalDateTime lastRunAt) {
        if (taskId != null && taskId > 0) {
            taskRepo.findById(taskId).ifPresent(task -> {
                task.setLastStatus(status);
                task.setLastRunAt(lastRunAt);
                taskRepo.save(task);
            });
        }
    }

    private String resolveVariables(String payload, Map<String, Object> runtimeParams) {
        if (payload == null || !payload.contains("{{") || runtimeParams == null || runtimeParams.isEmpty()) {
            return payload;
        }
        String result = payload;
        for (Map.Entry<String, Object> entry : runtimeParams.entrySet()) {
            String key = entry.getKey();
            String value = String.valueOf(entry.getValue());
            result = result.replace("{{" + key + "}}", value);
        }
        return result;
    }

}
