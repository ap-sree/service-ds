package com.antigravity.servicedashboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

@Entity
@Table(name = "notification_rules")
public class NotificationRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "local_table_name", nullable = false)
    @NotBlank(message = "{notification.localTableName.required}")
    private String localTableName;

    @Lob
    @Column(name = "condition_json", nullable = false)
    @Convert(converter = com.antigravity.servicedashboard.converter.NotificationConditionConverter.class)
    @NotNull(message = "{notification.condition.required}")
    private com.antigravity.servicedashboard.model.NotificationCondition condition;

    @Column(name = "action_type", nullable = false)
    @NotBlank(message = "{notification.actionType.required}")
    @Pattern(regexp = "^(EMAIL|TOAST|OS_NOTIFY)$", message = "{notification.actionType.pattern}")
    private String actionType;

    @Column(name = "message_template")
    @NotBlank(message = "{notification.messageTemplate.required}")
    private String messageTemplate;

    @Column(name = "schedule_type")
    @NotBlank(message = "{notification.scheduleType.required}")
    @Pattern(regexp = "^(EVENT|CRON)$", message = "{notification.scheduleType.pattern}")
    private String scheduleType;

    @Column(name = "schedule_config")
    private String scheduleConfig;

    @Column(name = "user_column")
    private String userColumn;

    @Column(name = "target_role")
    private String targetRole;

    @Column(name = "title_template")
    @NotBlank(message = "{notification.titleTemplate.required}")
    private String titleTemplate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sync_id")
    private SyncDefinition syncDefinition;

    @Column(name = "schema_changed")
    private boolean schemaChanged = false;

    public SyncDefinition getSyncDefinition() {
        return syncDefinition;
    }

    public void setSyncDefinition(SyncDefinition syncDefinition) {
        this.syncDefinition = syncDefinition;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getLocalTableName() {
        return localTableName;
    }

    public void setLocalTableName(String localTableName) {
        this.localTableName = localTableName;
    }

    public com.antigravity.servicedashboard.model.NotificationCondition getCondition() {
        return condition;
    }

    public void setCondition(com.antigravity.servicedashboard.model.NotificationCondition condition) {
        this.condition = condition;
    }

    public String getActionType() {
        return actionType;
    }

    public void setActionType(String actionType) {
        this.actionType = actionType;
    }

    public String getMessageTemplate() {
        return messageTemplate;
    }

    public void setMessageTemplate(String messageTemplate) {
        this.messageTemplate = messageTemplate;
    }

    public String getScheduleType() {
        return scheduleType;
    }

    public void setScheduleType(String scheduleType) {
        this.scheduleType = scheduleType;
    }

    public String getScheduleConfig() {
        return scheduleConfig;
    }

    public void setScheduleConfig(String scheduleConfig) {
        this.scheduleConfig = scheduleConfig;
    }

    public String getUserColumn() {
        return userColumn;
    }

    public void setUserColumn(String userColumn) {
        this.userColumn = userColumn;
    }

    public String getTargetRole() {
        return targetRole;
    }

    public void setTargetRole(String targetRole) {
        this.targetRole = targetRole;
    }

    public String getTitleTemplate() {
        return titleTemplate;
    }

    public void setTitleTemplate(String titleTemplate) {
        this.titleTemplate = titleTemplate;
    }

    public boolean isSchemaChanged() {
        return schemaChanged;
    }

    public void setSchemaChanged(boolean schemaChanged) {
        this.schemaChanged = schemaChanged;
    }
}
