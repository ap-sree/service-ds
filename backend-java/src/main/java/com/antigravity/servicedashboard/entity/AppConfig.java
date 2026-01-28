package com.antigravity.servicedashboard.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Column;

@Entity
@Table(name = "app_configs")
public class AppConfig {

    @Id
    @Column(name = "key")
    private String key;

    @Column(name = "value", length = 4000)
    private String value;

    public AppConfig() {
    }

    public AppConfig(String key, String value) {
        this.key = key;
        this.value = value;
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }
}
