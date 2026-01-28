package com.antigravity.servicedashboard.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "notification_rules")
public class NotificationRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "local_table_name", nullable = false)
    private String localTableName;

    @Column(name = "condition_json", nullable = false, columnDefinition = "TEXT")
    @Convert(converter = com.antigravity.servicedashboard.converter.NotificationConditionConverter.class)
    private com.antigravity.servicedashboard.model.NotificationCondition condition;

    @Column(name = "action_type", nullable = false)
    private String actionType; // TOAST, OS_NOTIFY

    @Column(name = "message_template")
    private String messageTemplate;

    @Column(name = "schedule_type")
    private String scheduleType;

    @Column(name = "schedule_config")
    private String scheduleConfig;

    @Column(name = "user_column")
    private String userColumn;

    @Column(name = "target_role")
    private String targetRole; // ADMIN, USER, VIEWER

    @Column(name = "title_template")
    private String titleTemplate;

    // Getters and Setters
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
}
