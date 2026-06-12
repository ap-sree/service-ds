package com.antigravity.servicedashboard.entity;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

@Entity
@Table(name = "sync_definitions")
public class SyncDefinition {


    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "source_id", nullable = false)
    @NotNull(message = "{sync.sourceId.required}")
    private Long sourceId;

    @Column(name = "target_table_name", nullable = false)
    @NotBlank(message = "{sync.targetTableName.required}")
    @Pattern(regexp = "^[a-zA-Z0-9_]+$", message = "{sync.targetTableName.pattern}")
    private String targetTableName;

    @Lob
    @Column(name = "fetch_query", nullable = false)
    @NotBlank(message = "{sync.fetchQuery.required}")
    private String fetchQuery;

    @Column(name = "http_method")
    @Pattern(regexp = "^(GET|POST|PUT|DELETE|PATCH)$", message = "{sync.httpMethod.pattern}")
    private String httpMethod = "GET";

    @Lob
    @Column(name = "request_body")
    private String requestBody;

    @Column(name = "sync_mode", nullable = false)
    @NotBlank(message = "{sync.syncMode.required}")
    @Pattern(regexp = "^(MANUAL|SCHEDULED)$", message = "{sync.syncMode.pattern}")
    private String syncMode;

    @Column(name = "schedule_config")
    private String scheduleConfig;

    @Lob
    @Column(name = "field_mapping")
    private String fieldMapping;

    @Column(name = "last_run_at")
    private LocalDateTime lastRunAt;

    @Column(name = "last_status")
    private String lastStatus;

    @Column(name = "sync_strategy")
    @NotBlank(message = "{sync.syncStrategy.required}")
    @Pattern(regexp = "^(RELOAD|APPEND)$", message = "{sync.syncStrategy.pattern}")
    private String syncStrategy;

    @Column(name = "primary_key")
    private String primaryKey;

    @Lob
    @Column(name = "pagination_config")
    private String paginationConfig;

    @Column(name = "root_path")
    private String rootPath;

    @Column(name = "schema_changed")
    private boolean schemaChanged = false;

    public String getPaginationConfig() {
        return paginationConfig;
    }

    public void setPaginationConfig(String paginationConfig) {
        this.paginationConfig = paginationConfig;
    }

    public String getRootPath() {
        return rootPath;
    }

    public void setRootPath(String rootPath) {
        this.rootPath = rootPath;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getSourceId() {
        return sourceId;
    }

    public void setSourceId(Long sourceId) {
        this.sourceId = sourceId;
    }

    public String getTargetTableName() {
        return targetTableName;
    }

    public void setTargetTableName(String targetTableName) {
        this.targetTableName = targetTableName;
    }

    public String getFetchQuery() {
        return fetchQuery;
    }

    public void setFetchQuery(String fetchQuery) {
        this.fetchQuery = fetchQuery;
    }

    public String getHttpMethod() {
        return httpMethod;
    }

    public void setHttpMethod(String httpMethod) {
        this.httpMethod = httpMethod;
    }

    public String getRequestBody() {
        return requestBody;
    }

    public void setRequestBody(String requestBody) {
        this.requestBody = requestBody;
    }

    public String getSyncMode() {
        return syncMode;
    }

    public void setSyncMode(String syncMode) {
        this.syncMode = syncMode;
    }

    public String getScheduleConfig() {
        return scheduleConfig;
    }

    public void setScheduleConfig(String scheduleConfig) {
        this.scheduleConfig = scheduleConfig;
    }

    public String getFieldMapping() {
        return fieldMapping;
    }

    public void setFieldMapping(String fieldMapping) {
        this.fieldMapping = fieldMapping;
    }

    public LocalDateTime getLastRunAt() {
        return lastRunAt;
    }

    public void setLastRunAt(LocalDateTime lastRunAt) {
        this.lastRunAt = lastRunAt;
    }

    public String getLastStatus() {
        return lastStatus;
    }

    public void setLastStatus(String lastStatus) {
        this.lastStatus = lastStatus;
    }

    public String getSyncStrategy() {
        return syncStrategy;
    }

    public void setSyncStrategy(String syncStrategy) {
        this.syncStrategy = syncStrategy;
    }

    public String getPrimaryKey() {
        return primaryKey;
    }

    public void setPrimaryKey(String primaryKey) {
        this.primaryKey = primaryKey;
    }

    @JsonIgnore
    @OneToMany(mappedBy = "syncDefinition", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private java.util.List<WidgetDefinition> widgets = new java.util.ArrayList<>();

    public java.util.List<WidgetDefinition> getWidgets() {
        return widgets;
    }

    public void setWidgets(java.util.List<WidgetDefinition> widgets) {
        this.widgets = widgets;
    }

    @JsonIgnore
    @OneToMany(mappedBy = "syncDefinition", cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    private java.util.List<NotificationRule> notificationRules = new java.util.ArrayList<>();

    public java.util.List<NotificationRule> getNotificationRules() {
        return notificationRules;
    }

    public void setNotificationRules(java.util.List<NotificationRule> notificationRules) {
        this.notificationRules = notificationRules;
    }

    public boolean isSchemaChanged() {
        return schemaChanged;
    }

    public void setSchemaChanged(boolean schemaChanged) {
        this.schemaChanged = schemaChanged;
    }

}
