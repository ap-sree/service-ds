package com.antigravity.servicedashboard.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

@Entity
@Table(name = "users")
public class User {

    @Id
    @Column(nullable = false, unique = true)
    @NotBlank(message = "{user.username.required}")
    private String username;

    @Column
    @NotBlank(message = "{user.role.required}")
    @Pattern(regexp = "^(ADMIN|USER)$", message = "{user.role.pattern}")
    private String role;

    @Lob
    @Column
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
