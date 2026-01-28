package com.antigravity.servicedashboard.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @Column(nullable = false, unique = true)
    private String username;

    @Column
    private String role;

    @Column(columnDefinition = "TEXT")
    private String preferences;

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

    @com.fasterxml.jackson.annotation.JsonRawValue
    public String getPreferences() {
        return preferences;
    }

    @com.fasterxml.jackson.annotation.JsonSetter
    public void setPreferences(com.fasterxml.jackson.databind.JsonNode json) {
        this.preferences = json.toString();
    }

    public void setPreferences(String preferences) {
        this.preferences = preferences;
    }
}
