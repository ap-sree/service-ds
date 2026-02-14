package com.antigravity.servicedashboard.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Entity
@Table(name = "data_sources")
public class DataSource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "{datasource.name.required}")
    @Size(min = 3, max = 100, message = "{datasource.name.size}")
    @Pattern(regexp = "^[a-zA-Z0-9 _-]+$", message = "{datasource.name.pattern}")
    @Column(nullable = false)
    private String name;

    @NotBlank(message = "{datasource.type.required}")
    @Pattern(regexp = "^(REST_API|LOCAL_COMMAND|LOCAL_FILE|SQL_SERVER)$", message = "{datasource.type.pattern}")
    @Column(nullable = false)
    private String type;

    @Lob
    @NotBlank(message = "{datasource.config.required}")
    @Column(nullable = false)
    private String config;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getConfig() {
        return config;
    }

    public void setConfig(String config) {
        this.config = config;
    }
}
