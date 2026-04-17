package com.antigravity.servicedashboard.dto;

import java.util.Map;

public class UserDTO {
    private String username;
    private String role;
    private Map<String, Object> dashboardConfig;

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public Map<String, Object> getDashboardConfig() {
        return dashboardConfig;
    }

    public void setDashboardConfig(Map<String, Object> dashboardConfig) {
        this.dashboardConfig = dashboardConfig;
    }
}
