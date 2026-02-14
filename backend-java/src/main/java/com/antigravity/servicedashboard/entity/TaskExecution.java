package com.antigravity.servicedashboard.entity;
import jakarta.persistence.*;
import java.time.LocalDateTime;
@Entity
@Table(name = "task_executions")
public class TaskExecution {

    @Id

    @GeneratedValue(strategy = GenerationType.IDENTITY)

    private Long id;

    @Column(name = "task_id", nullable = false)

    private Long taskId;

    @Column(name = "started_at", nullable = false)

    private LocalDateTime startedAt;

    @Column(name = "completed_at")

    private LocalDateTime completedAt;

    @Column(nullable = false)

    private String status;

    @Lob

    @Column(name = "input_payload", columnDefinition = "TEXT")

    private String inputPayload;

    @Lob

    @Column(name = "output_result", columnDefinition = "TEXT")

    private String outputResult;

    @Column(name = "triggered_by")

    private String triggeredBy;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getTaskId() {
        return taskId;
    }

    public void setTaskId(Long taskId) {
        this.taskId = taskId;
    }

    public LocalDateTime getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(LocalDateTime startedAt) {
        this.startedAt = startedAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getInputPayload() {
        return inputPayload;
    }

    public void setInputPayload(String inputPayload) {
        this.inputPayload = inputPayload;
    }

    public String getOutputResult() {
        return outputResult;
    }

    public void setOutputResult(String outputResult) {
        this.outputResult = outputResult;
    }

    public String getTriggeredBy() {
        return triggeredBy;
    }

    public void setTriggeredBy(String triggeredBy) {
        this.triggeredBy = triggeredBy;
    }
}
