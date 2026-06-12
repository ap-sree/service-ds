package com.antigravity.servicedashboard.dto;

import java.time.LocalDateTime;

public interface TaskExecutionSummary {
    Long getId();
    Long getTaskId();
    LocalDateTime getStartedAt();
    LocalDateTime getCompletedAt();
    String getStatus();
    String getOutputResult();
    String getTriggeredBy();
}
