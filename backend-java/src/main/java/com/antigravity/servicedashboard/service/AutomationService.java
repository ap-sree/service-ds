package com.antigravity.servicedashboard.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.antigravity.servicedashboard.constant.AppConstants;
import com.antigravity.servicedashboard.dto.TaskExecutionSummary;
import com.antigravity.servicedashboard.entity.DataSource;
import com.antigravity.servicedashboard.entity.TaskDefinition;
import com.antigravity.servicedashboard.entity.TaskExecution;
import com.antigravity.servicedashboard.repository.DataSourceRepository;
import com.antigravity.servicedashboard.repository.TaskDefinitionRepository;
import com.antigravity.servicedashboard.repository.TaskExecutionRepository;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class AutomationService {

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(AutomationService.class);

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class StepInfo {
        private Integer stepIndex;
        private String name;
        private String type;
        private String status;
        private String startedAt;
        private String completedAt;
        private String error;
        private Map<String, Object> input = new HashMap<>();
        private Map<String, Object> output = new HashMap<>();
        private Object stepOutputFieldMapping;

        public Integer getStepIndex() { return stepIndex; }
        public void setStepIndex(Integer stepIndex) { this.stepIndex = stepIndex; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getStartedAt() { return startedAt; }
        public void setStartedAt(String startedAt) { this.startedAt = startedAt; }
        public String getCompletedAt() { return completedAt; }
        public void setCompletedAt(String completedAt) { this.completedAt = completedAt; }
        public String getError() { return error; }
        public void setError(String error) { this.error = error; }
        public Map<String, Object> getInput() { return input; }
        public void setInput(Map<String, Object> input) { this.input = input; }
        public Map<String, Object> getOutput() { return output; }
        public void setOutput(Map<String, Object> output) { this.output = output; }
        public Object getStepOutputFieldMapping() { return stepOutputFieldMapping; }
        public void setStepOutputFieldMapping(Object stepOutputFieldMapping) { this.stepOutputFieldMapping = stepOutputFieldMapping; }
    }

    private final TaskDefinitionRepository taskRepo;
    private final TaskExecutionRepository executionRepo;
    private final DataSourceRepository sourceRepo;
    private final SyncService syncService;
    private final AppConfigService appConfigService;
    private final ObjectMapper objectMapper;

    public AutomationService(
            TaskDefinitionRepository taskRepo,
            TaskExecutionRepository executionRepo,
            DataSourceRepository sourceRepo,
            SyncService syncService,
            AppConfigService appConfigService,
            ObjectMapper objectMapper) {
        this.taskRepo = taskRepo;
        this.executionRepo = executionRepo;
        this.sourceRepo = sourceRepo;
        this.syncService = syncService;
        this.appConfigService = appConfigService;
        this.objectMapper = objectMapper;
    }

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

    public List<TaskExecutionSummary> getTaskHistory(Long taskId) {
        return executionRepo.findSummaryByTaskIdAndTaskTypeOrderByStartedAtDesc(taskId, "TASK");
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

    public int getMaxSteps() {
        Object valObj = appConfigService.getConfigValue("automation_max_steps");
        if (valObj instanceof Number) {
            return ((Number) valObj).intValue();
        } else if (valObj instanceof String) {
            try {
                return Integer.parseInt((String) valObj);
            } catch (NumberFormatException e) {
                // ignore
            }
        }
        return 3;
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
            Map<String, Object> payloadMap = objectMapper.readValue(payload, new TypeReference<Map<String, Object>>() {});
            runMultiStepFlow(exec, payloadMap, runtimeParams);
        } catch (Exception e) {
            logger.error("Automation Execution Failed: TaskID=" + taskId, e);
            exec.setStatus("FAILED");
            // Only write the plain error if runMultiStepFlow didn't already set structured JSON output.
            // (runMultiStepFlow sets outputResult then rethrows — we must not overwrite it here.)
            if (exec.getOutputResult() == null || exec.getOutputResult().isBlank()) {
                exec.setOutputResult("Error: " + e.getMessage());
            }
            updateTaskStatus(taskId, "FAILED", LocalDateTime.now());
        } finally {
            exec.setCompletedAt(LocalDateTime.now());
            executionRepo.save(exec);
        }
        return exec;
    }

    @SuppressWarnings("unchecked")
    private void runMultiStepFlow(TaskExecution exec, Map<String, Object> payloadMap, Map<String, Object> runtimeParams) throws Exception {
        List<Object> stepsList = (List<Object>) payloadMap.get("steps");
        if (stepsList == null || stepsList.isEmpty()) {
            throw new IllegalArgumentException("No steps defined for multi-step task");
        }
        int maxSteps = getMaxSteps();
        if (stepsList.size() > maxSteps) {
            throw new IllegalArgumentException("Number of steps (" + stepsList.size() + ") exceeds the configured maximum of " + maxSteps);
        }

        Map<Integer, StepInfo> stepResultsMap = new LinkedHashMap<>();
        Map<String, Object> accumulatedVariables = new HashMap<>();
        if (runtimeParams != null) {
            accumulatedVariables.putAll(runtimeParams);
        }

        Object lastStepResult = null;
        boolean hasGeneratedFile = false;
        Map<String, Object> generatedFileMeta = null;

        for (int j = 0; j < stepsList.size(); j++) {
            int i = j;
            Map<String, Object> step = objectMapper.convertValue(stepsList.get(i), new TypeReference<Map<String, Object>>() {});
            String stepName = (String) step.getOrDefault("name", "Step " + (i + 1));
            String stepType = (String) step.getOrDefault("type", "DATASOURCE");
            boolean dependent = step.get("dependent") != null ? Boolean.TRUE.equals(step.get("dependent")) : true;

            if (i == 0 && !"DATASOURCE".equalsIgnoreCase(stepType)) {
                throw new IllegalArgumentException("The first step must be a Data Source step.");
            }

            StepInfo stepInfo = new StepInfo();
            stepInfo.setStepIndex(i + 1);
            stepInfo.setName(stepName);
            stepInfo.setType(stepType);
            stepInfo.setStartedAt(LocalDateTime.now().toString());

            try {
                Object stepOutputObj = null;

                if ("DATASOURCE".equalsIgnoreCase(stepType)) {
                    stepOutputObj = executeDataSourceStep(step, stepName, i + 1, stepResultsMap, accumulatedVariables, stepInfo);
                    lastStepResult = stepInfo.getStepOutputFieldMapping() != null ? stepInfo.getStepOutputFieldMapping() : stepInfo.getOutput().get("data");
                } else if ("PROCESS".equalsIgnoreCase(stepType)) {
                    String processType = (String) step.get("processType");
                    if (!"JSON_TO_FILE".equalsIgnoreCase(processType)) {
                        throw new IllegalArgumentException("Unsupported process type: " + processType);
                    }

                    String fileName = (String) step.getOrDefault("fileName", "export.json");
                    String fileFormat = (String) step.getOrDefault("fileFormat", "JSON");

                    logger.info("Executing step {} (PROCESS - JSON_TO_FILE): format={}, filename={}", stepName, fileFormat, fileName);
                    stepInfo.getInput().put("processType", processType);
                    stepInfo.getInput().put("fileName", fileName);
                    stepInfo.getInput().put("fileFormat", fileFormat);

                    Object inputObj = lastStepResult;
                    if (inputObj == null) {
                        inputObj = new ArrayList<>();
                    }

                    List<Map<String, Object>> listData = new ArrayList<>();
                    if (inputObj instanceof List) {
                        List<?> rawList = (List<?>) inputObj;
                        for (Object o : rawList) {
                            if (o instanceof Map) {
                                listData.add((Map<String, Object>) o);
                            } else {
                                Map<String, Object> m = new HashMap<>();
                                m.put("value", o);
                                listData.add(m);
                            }
                        }
                    } else if (inputObj instanceof Map) {
                        listData.add((Map<String, Object>) inputObj);
                    } else {
                        Map<String, Object> m = new HashMap<>();
                        m.put("value", inputObj);
                        listData.add(m);
                    }

                    String fileContentStr;
                    if ("CSV".equalsIgnoreCase(fileFormat)) {
                        fileContentStr = convertJsonToCsv(listData);
                    } else {
                        fileContentStr = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(listData);
                    }

                    stepInfo.getOutput().put("fileName", fileName);
                    stepInfo.getOutput().put("fileContent", fileContentStr);
                    stepInfo.getOutput().put("format", fileFormat);
                    stepInfo.getOutput().put("size", fileContentStr.length());

                    stepOutputObj = stepInfo.getOutput();
                    lastStepResult = stepOutputObj;
                    hasGeneratedFile = true;
                    generatedFileMeta = stepInfo.getOutput();
                } else {
                    throw new IllegalArgumentException("Unknown step type: " + stepType);
                }

                stepInfo.setStatus("SUCCESS");
                stepInfo.setCompletedAt(LocalDateTime.now().toString());
                stepResultsMap.put(i + 1, stepInfo);

                accumulatedVariables.put("step" + (i + 1), stepOutputObj);

                // 1. Populate variables from raw response data (so {{stepN.id}} or {{stepN[0].id}} always work even if field mapping is used)
                Object rawDataObj = stepInfo.getOutput().get("data");
                if (rawDataObj != null) {
                    flattenJson("step" + (i + 1), rawDataObj, accumulatedVariables);
                    if (rawDataObj instanceof List && !((List<?>) rawDataObj).isEmpty() && ((List<?>) rawDataObj).get(0) instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> firstRow = (Map<String, Object>) ((List<?>) rawDataObj).get(0);
                        firstRow.forEach((k, v) -> accumulatedVariables.put("step" + (i + 1) + "." + k, v));
                    } else if (rawDataObj instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> row = (Map<String, Object>) rawDataObj;
                        row.forEach((k, v) -> accumulatedVariables.put("step" + (i + 1) + "." + k, v));
                    }
                }

                // 2. Populate variables from mapped fields (so custom mapped names work too)
                Object mappedDataObj = stepInfo.getStepOutputFieldMapping();
                if (mappedDataObj != null && mappedDataObj != rawDataObj) {
                    flattenJson("step" + (i + 1), mappedDataObj, accumulatedVariables);
                    if (mappedDataObj instanceof List && !((List<?>) mappedDataObj).isEmpty() && ((List<?>) mappedDataObj).get(0) instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> firstRow = (Map<String, Object>) ((List<?>) mappedDataObj).get(0);
                        firstRow.forEach((k, v) -> accumulatedVariables.put("step" + (i + 1) + "." + k, v));
                    } else if (mappedDataObj instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> row = (Map<String, Object>) mappedDataObj;
                        row.forEach((k, v) -> accumulatedVariables.put("step" + (i + 1) + "." + k, v));
                    }
                }

            } catch (Exception e) {
                logger.error("Step execution failed: " + stepName, e);
                stepInfo.setStatus("FAILED");
                stepInfo.setError(e.getMessage());
                stepInfo.setCompletedAt(LocalDateTime.now().toString());
                stepResultsMap.put(i + 1, stepInfo);

                if (!dependent) {
                    logger.warn("Optional (non-dependent) step {} failed. Continuing workflow.", stepName);
                    continue;
                }

                Map<String, Object> finalResultMap = new HashMap<>();
                finalResultMap.put("input", runtimeParams != null && !runtimeParams.isEmpty() ? runtimeParams : payloadMap);
                finalResultMap.put("steps", stepResultsMap);
                finalResultMap.put("status", "FAILED");
                finalResultMap.put("failedStep", stepName);
                finalResultMap.put("failedStepIndex", i + 1);
                finalResultMap.put("failedStepError", e.getMessage());

                exec.setOutputResult(objectMapper.writeValueAsString(finalResultMap));
                exec.setStatus("FAILED");
                updateTaskStatus(exec.getTaskId(), "FAILED", LocalDateTime.now());
                throw e;
            }
        }

        Map<String, Object> endTask = (Map<String, Object>) payloadMap.get("endTask");
        Map<String, Object> endTaskResult = new HashMap<>();
        endTaskResult.put("status", "SUCCESS");

        if (endTask != null) {
            String endTaskType = (String) endTask.getOrDefault("type", "NONE");
            endTaskResult.put("type", endTaskType);

            if ("EMAIL".equalsIgnoreCase(endTaskType)) {
                String to = (String) endTask.getOrDefault("emailTo", "");
                String subject = (String) endTask.getOrDefault("emailSubject", "Automation Workflows Notification");
                String body = (String) endTask.getOrDefault("emailBody", "Please find the execution results below.");

                to = resolveVariables(to, accumulatedVariables);
                subject = resolveVariables(subject, accumulatedVariables);
                body = resolveVariables(body, accumulatedVariables);

                logger.info("SIMULATING EMAIL NOTIFICATION SENT:");
                logger.info("To: {}", to);
                logger.info("Subject: {}", subject);
                logger.info("Body: {}", body);

                List<Map<String, Object>> attachments = new ArrayList<>();
                if (hasGeneratedFile && generatedFileMeta != null) {
                    attachments.add(generatedFileMeta);
                    logger.info("Attached generated file: name={}, size={}", generatedFileMeta.get("fileName"), generatedFileMeta.get("size"));
                }

                endTaskResult.put("emailTo", to);
                endTaskResult.put("emailSubject", subject);
                endTaskResult.put("emailBody", body);
                endTaskResult.put("attachments", attachments);
                endTaskResult.put("details", "Email sent to " + to + " with " + attachments.size() + " attachment(s)");

            } else if ("DOWNLOAD".equalsIgnoreCase(endTaskType)) {
                Map<String, Object> downloadFile = new HashMap<>();
                if (hasGeneratedFile && generatedFileMeta != null) {
                    downloadFile.putAll(generatedFileMeta);
                } else {
                    String dlFormat = (String) endTask.getOrDefault("downloadFormat", "JSON");
                    String dlName = (String) endTask.getOrDefault("downloadFileName", "result.json");
                    String dlContent = "";

                    if (lastStepResult instanceof List) {
                        List<Map<String, Object>> listData = (List<Map<String, Object>>) lastStepResult;
                        if ("CSV".equalsIgnoreCase(dlFormat)) {
                            dlContent = convertJsonToCsv(listData);
                        } else {
                            dlContent = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(listData);
                        }
                    } else if (lastStepResult != null) {
                        dlContent = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(lastStepResult);
                    }

                    downloadFile.put("fileName", dlName);
                    downloadFile.put("fileContent", dlContent);
                    downloadFile.put("format", dlFormat);
                    downloadFile.put("size", dlContent.length());
                }
                endTaskResult.put("file", downloadFile);
                endTaskResult.put("details", "File generated for auto-download: " + downloadFile.get("fileName"));
            }
        }

        Map<String, Object> finalResultMap = new HashMap<>();
        finalResultMap.put("input", runtimeParams != null && !runtimeParams.isEmpty() ? runtimeParams : payloadMap);
        finalResultMap.put("steps", stepResultsMap);
        finalResultMap.put("endTaskResult", endTaskResult);
        finalResultMap.put("status", "SUCCESS");

        exec.setOutputResult(objectMapper.writeValueAsString(finalResultMap));
        exec.setStatus("SUCCESS");
        updateTaskStatus(exec.getTaskId(), "SUCCESS", LocalDateTime.now());
    }

    @SuppressWarnings("unchecked")
    private Object executeDataSourceStep(
            Map<String, Object> step, String stepName, int stepNumber,
            Map<Integer, StepInfo> stepResultsMap, Map<String, Object> accumulatedVariables, StepInfo stepInfo) throws Exception {

        Object sourceIdObj = step.get("sourceId");
        if (sourceIdObj == null) {
            throw new IllegalArgumentException("sourceId is required for DATASOURCE step: " + stepName);
        }
        Long stepSourceId = ((Number) sourceIdObj).longValue();
        DataSource source = sourceRepo.findById(stepSourceId)
                .orElseThrow(() -> new IllegalArgumentException("Source not found for step: " + stepName));

        String sourceType = source.getType();
        stepInfo.getInput().put("sourceId", stepSourceId);
        stepInfo.getInput().put("sourceType", sourceType);

        String query = (String) step.get("fetchQuery");
        if (query != null) {
            query = resolveVariables(query, accumulatedVariables);
            stepInfo.getInput().put("fetchQuery", query);
        }

        String method = (String) step.getOrDefault("httpMethod", "GET");
        String rootPath = (String) step.get("rootPath");
        if (rootPath == null) {
            rootPath = (String) step.get("responsePath");
        }
        Object body = step.get("body");
        Object mappingObj = step.get("mapping");
        Object paginationObj = step.get("paginationConfig");

        if (AppConstants.DS_TYPE_REST_API.equals(sourceType)) {
            method = resolveVariables(method, accumulatedVariables);
            if (rootPath != null) {
                rootPath = resolveVariables(rootPath, accumulatedVariables);
            }
            stepInfo.getInput().put("httpMethod", method);
            if (rootPath != null) {
                stepInfo.getInput().put("rootPath", rootPath);
                stepInfo.getInput().put("responsePath", rootPath);
            }

            Object bodyFromStepObj = step.get("bodyFromStep");
            if (bodyFromStepObj instanceof Number) {
                int bfStep = ((Number) bodyFromStepObj).intValue();
                StepInfo prevStep = stepResultsMap.get(bfStep);
                Object bodySourceResult = null;
                if (prevStep != null) {
                    bodySourceResult = prevStep.getOutput().get("responseBody");
                    if (bodySourceResult == null) {
                        bodySourceResult = prevStep.getStepOutputFieldMapping() != null
                                ? prevStep.getStepOutputFieldMapping()
                                : prevStep.getOutput().get("data");
                    }
                }
                if (bodySourceResult != null) {
                    if (bodySourceResult instanceof List) {
                        List<?> list = (List<?>) bodySourceResult;
                        bodySourceResult = list.isEmpty() ? new HashMap<String, Object>() : list.get(0);
                    }
                    Map<String, Object> mergedBody = (bodySourceResult instanceof Map)
                            ? deepCopyMap((Map<String, Object>) bodySourceResult)
                            : new HashMap<>();
                    Object overridesObj = step.get("overrides");
                    if (overridesObj instanceof Map) {
                        Map<String, Object> overrides = objectMapper.convertValue(
                                overridesObj, new TypeReference<Map<String, Object>>() {});
                        overrides.forEach((k, v) -> setNestedValue(mergedBody, k, v));
                    }
                    Object appendOverridesObj = step.get("appendOverrides");
                    if (appendOverridesObj instanceof Map) {
                        Map<String, Object> appendOverrides = objectMapper.convertValue(
                                appendOverridesObj, new TypeReference<Map<String, Object>>() {});
                        appendOverrides.forEach((k, v) -> appendNestedValue(mergedBody, k, v));
                    }
                    body = mergedBody;
                }
            }

            if (body instanceof String) {
                body = resolveVariables((String) body, accumulatedVariables);
            } else if (body != null) {
                String bodyStr = objectMapper.writeValueAsString(body);
                body = objectMapper.readValue(resolveVariables(bodyStr, accumulatedVariables), Object.class);
            }
            if (body != null) stepInfo.getInput().put("body", body);
        }

        String mapping = null;
        if (mappingObj instanceof Map) {
            mapping = objectMapper.writeValueAsString(mappingObj);
            stepInfo.getInput().put("mapping", mappingObj);
        } else if (mappingObj instanceof String) {
            mapping = (String) mappingObj;
            stepInfo.getInput().put("mapping", mapping);
        }

        String paginationConfig = null;
        if (paginationObj != null) {
            paginationConfig = paginationObj instanceof String
                    ? (String) paginationObj
                    : objectMapper.writeValueAsString(paginationObj);
            stepInfo.getInput().put("paginationConfig", paginationObj);
        }

        logger.info("Executing step {} ({}): source id {}", stepName, sourceType, source.getId());
        SyncService.FetchResult fetchResult = syncService.fetchDataWithStatus(source, query, method, body, rootPath, paginationConfig);
        Integer httpStatus = fetchResult.httpStatus;
        List<Map<String, Object>> rawData = fetchResult.data != null ? fetchResult.data : new ArrayList<>();

        if (httpStatus != null) {
            stepInfo.getOutput().put("httpStatus", httpStatus);
            accumulatedVariables.put("step" + stepNumber + ".httpStatus", httpStatus);
        }

        Object responseIndexObj = step.get("responseIndex");
        if (responseIndexObj == null && step.get("index") != null) {
            responseIndexObj = step.get("index");
        }

        String responseType = responseIndexObj != null ? "ArrayOfJSONObject" : (rawData.size() == 1 ? "JSONObject" : "ArrayOfJSONObject");
        stepInfo.getOutput().put("responseType", responseType);
        stepInfo.getOutput().put("resultCount", rawData.size());

        if (Boolean.TRUE.equals(step.get("includeResponseBody"))) {
            stepInfo.getOutput().put("responseBody", rawData);
            accumulatedVariables.put("step" + stepNumber + ".response", rawData);
        }

        Object primaryOutputData;
        if (responseIndexObj instanceof Number) {
            int idx = ((Number) responseIndexObj).intValue();
            if (idx >= 0 && idx < rawData.size()) {
                primaryOutputData = rawData.get(idx);
            } else {
                logger.warn("Step {} response index {} is out of bounds (size {})", stepName, idx, rawData.size());
                primaryOutputData = new HashMap<String, Object>();
            }
        } else {
            primaryOutputData = rawData;
        }
        stepInfo.getOutput().put("data", primaryOutputData);

        // Apply stepOutputFieldMapping based on StepInfo.output object
        if (mapping != null) {
            if (primaryOutputData instanceof List) {
                List<Map<String, Object>> mappedList = syncService.applyFieldMapping((List<Map<String, Object>>) primaryOutputData, mapping);
                stepInfo.setStepOutputFieldMapping(mappedList);
            } else if (primaryOutputData instanceof Map) {
                List<Map<String, Object>> singleList = new ArrayList<>();
                singleList.add((Map<String, Object>) primaryOutputData);
                List<Map<String, Object>> mappedList = syncService.applyFieldMapping(singleList, mapping);
                stepInfo.setStepOutputFieldMapping(mappedList.isEmpty() ? new HashMap<String, Object>() : mappedList.get(0));
            }
        } else {
            stepInfo.setStepOutputFieldMapping(primaryOutputData);
        }

        // Evaluate Success Criteria
        Object criteriaObj = step.get("successCriteria");
        if (criteriaObj instanceof Map) {
            Map<String, Object> criteria = (Map<String, Object>) criteriaObj;
            String type = (String) criteria.get("type");
            Object valObj = criteria.get("value");
            if (type != null && valObj != null && !valObj.toString().trim().isEmpty()) {
                if ("HTTP_STATUS_EQUALS".equalsIgnoreCase(type)) {
                    int expectedStatus = Integer.parseInt(valObj.toString().trim());
                    int actualStatus = httpStatus != null ? httpStatus : 200;
                    if (expectedStatus != actualStatus) {
                        throw new RuntimeException("Success criteria failed: expected HTTP status " + expectedStatus + " but got " + actualStatus);
                    }
                } else if ("RESULT_COUNT_EQ".equalsIgnoreCase(type)) {
                    int expectedCount = Integer.parseInt(valObj.toString().trim());
                    int actualCount = rawData.size();
                    if (expectedCount != actualCount) {
                        throw new RuntimeException("Success criteria failed: expected result count " + expectedCount + " but got " + actualCount);
                    }
                }
            }
        }

        return primaryOutputData;
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
        if (payload == null || runtimeParams == null || runtimeParams.isEmpty()) {
            return payload;
        }
        if (!payload.contains("{{") && !payload.contains("${")) {
            return payload;
        }
        String result = payload;
        for (Map.Entry<String, Object> entry : runtimeParams.entrySet()) {
            String key   = entry.getKey();
            String value = String.valueOf(entry.getValue());
            result = result.replace("{{" + key + "}}", value);   // {{varName}}
            result = result.replace("${" + key + "}", value);    // ${varName}
        }
        return result;
    }

    private void flattenJson(String prefix, Object jsonNode, Map<String, Object> targetMap) {
        if (jsonNode == null) {
            return;
        }
        if (jsonNode instanceof Map) {
            Map<?, ?> map = (Map<?, ?>) jsonNode;
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey());
                Object val = entry.getValue();
                String newPrefix = prefix.isEmpty() ? key : prefix + "." + key;
                targetMap.put(newPrefix, val);
                flattenJson(newPrefix, val, targetMap);
            }
        } else if (jsonNode instanceof List) {
            List<?> list = (List<?>) jsonNode;
            for (int i = 0; i < list.size(); i++) {
                Object val = list.get(i);
                String newPrefix = prefix + "[" + i + "]";
                targetMap.put(newPrefix, val);
                flattenJson(newPrefix, val, targetMap);
            }
        }
    }

    /**
     * Deep-copies a Map so that overrides applied to the copy never mutate
     * the original object stored in accumulatedVariables.
     * Primitives (String, Number, Boolean, null) are immutable and safe to share.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> deepCopyMap(Map<String, Object> source) {
        Map<String, Object> copy = new HashMap<>(source.size());
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            copy.put(entry.getKey(), deepCopyValue(entry.getValue()));
        }
        return copy;
    }

    @SuppressWarnings("unchecked")
    private Object deepCopyValue(Object value) {
        if (value instanceof Map) {
            return deepCopyMap((Map<String, Object>) value);
        }
        if (value instanceof List) {
            List<Object> copy = new ArrayList<>(((List<?>) value).size());
            for (Object item : (List<?>) value) {
                copy.add(deepCopyValue(item));
            }
            return copy;
        }
        return value; // String, Number, Boolean, null — immutable, safe to share
    }

    /**
     * Appends items into an existing array at the given path.
     * - If the target is a List and the new value is also a List  → addAll (extend the array).
     * - If the target is a List and the new value is a single Map/object → add (push one item).
     * - If the target is not a List → falls back to setNestedValue (replace).
     * Path syntax is identical to setNestedValue (dot + bracket notation).
     */
    @SuppressWarnings("unchecked")
    private void appendNestedValue(Map<String, Object> target, String path, Object newValue) {
        int dot     = path.indexOf('.');
        int bracket = path.indexOf('[');

        // ── Leaf ─────────────────────────────────────────────────────────────
        if (dot == -1 && bracket == -1) {
            Object existing = target.get(path);
            if (existing instanceof List) {
                List<Object> list = (List<Object>) existing;
                if (newValue instanceof List) {
                    list.addAll((List<?>) newValue);
                } else {
                    list.add(newValue);
                }
            } else {
                target.put(path, newValue); // not an array — replace
            }
            return;
        }

        if (bracket != -1 && (dot == -1 || bracket < dot)) {
            String key        = path.substring(0, bracket);
            int    closeBrack = path.indexOf(']', bracket);
            if (closeBrack == -1) { target.put(path, newValue); return; }
            int    index      = Integer.parseInt(path.substring(bracket + 1, closeBrack));
            String remainder  = (closeBrack + 1 < path.length())
                                ? path.substring(closeBrack + 1).replaceFirst("^\\.", "")
                                : "";
            Object listObj = target.get(key);
            if (!(listObj instanceof List)) return;
            List<Object> list = (List<Object>) listObj;
            if (index < 0 || index >= list.size()) return;
            if (remainder.isEmpty()) {
                list.set(index, newValue); // index is the leaf — replace
            } else {
                Object item = list.get(index);
                if (!(item instanceof Map)) return;
                appendNestedValue((Map<String, Object>) item, remainder, newValue);
            }
            return;
        }

        // ── Dot ───────────────────────────────────────────────────────────────
        String key       = path.substring(0, dot);
        String remainder = path.substring(dot + 1);
        Object child     = target.get(key);
        if (!(child instanceof Map)) return;
        appendNestedValue((Map<String, Object>) child, remainder, newValue);
    }

    private void setNestedValue(Map<String, Object> target, String path, Object value) {
        int dot     = path.indexOf('.');
        int bracket = path.indexOf('[');

        if (dot == -1 && bracket == -1) {
            target.put(path, value);
            return;
        }

        if (bracket != -1 && (dot == -1 || bracket < dot)) {
            String key         = path.substring(0, bracket);
            int    closeBrack  = path.indexOf(']', bracket);
            if (closeBrack == -1) { target.put(path, value); return; }
            int    index       = Integer.parseInt(path.substring(bracket + 1, closeBrack));
            String remainder   = (closeBrack + 1 < path.length())
                                 ? path.substring(closeBrack + 1).replaceFirst("^\\.", "")
                                 : "";

            Object listObj = target.get(key);
            if (!(listObj instanceof List)) return; 
            List<Object> list = (List<Object>) listObj;
            if (index < 0 || index >= list.size()) return;

            if (remainder.isEmpty()) {
                list.set(index, value);
            } else {
                Object item = list.get(index);
                if (!(item instanceof Map)) {
                    item = new HashMap<String, Object>();
                    list.set(index, item);
                }
                setNestedValue((Map<String, Object>) item, remainder, value);
            }
            return;
        }

        // ── Dot comes first: key.remainder ────────────────────────────────────
        String key       = path.substring(0, dot);
        String remainder = path.substring(dot + 1);
        Object child     = target.get(key);
        if (!(child instanceof Map)) {
            child = new HashMap<String, Object>();
            target.put(key, child);
        }
        setNestedValue((Map<String, Object>) child, remainder, value);
    }

    private String convertJsonToCsv(List<Map<String, Object>> list) {
        if (list == null || list.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        List<String> headers = new ArrayList<>();
        for (String key : list.get(0).keySet()) {
            headers.add(key);
        }
        sb.append(String.join(",", headers)).append("\n");
        for (Map<String, Object> row : list) {
            List<String> values = new ArrayList<>();
            for (String header : headers) {
                Object val = row.get(header);
                String valStr = val == null ? "" : String.valueOf(val);
                if (valStr.contains(",") || valStr.contains("\"") || valStr.contains("\n") || valStr.contains("\r")) {
                    valStr = "\"" + valStr.replace("\"", "\"\"") + "\"";
                }
                values.add(valStr);
            }
            sb.append(String.join(",", values)).append("\n");
        }
        return sb.toString();
    }
}
