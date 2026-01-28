package com.antigravity.servicedashboard.model;

import java.time.LocalDateTime;
import java.util.UUID;

public class Notification {
    private String id;
    private String title;
    private String body;
    private String action_type; // TOAST, OS_NOTIFY
    private String targetUser;
    private String targetRole;
    private LocalDateTime timestamp;

    public Notification() {
    }

    public Notification(String title, String body, String action_type, String targetUser, String targetRole) {
        this.id = UUID.randomUUID().toString();
        this.title = title;
        this.body = body;
        this.action_type = action_type;
        this.targetUser = targetUser;
        this.targetRole = targetRole;
        this.timestamp = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public String getAction_type() {
        return action_type;
    }

    public void setAction_type(String action_type) {
        this.action_type = action_type;
    }

    public String getTargetUser() {
        return targetUser;
    }

    public void setTargetUser(String targetUser) {
        this.targetUser = targetUser;
    }

    public String getTargetRole() {
        return targetRole;
    }

    public void setTargetRole(String targetRole) {
        this.targetRole = targetRole;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
}
