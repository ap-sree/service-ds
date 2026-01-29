package com.antigravity.servicedashboard.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "widget_definitions")
public class WidgetDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String type;

    @Column(name = "data_source_table", nullable = false)
    private String dataSourceTable;

    @Column(name = "query_config")
    @Lob
    private String queryConfig;

    @Column(name = "user_column")
    private String userColumn;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getDataSourceTable() {
        return dataSourceTable;
    }

    public void setDataSourceTable(String dataSourceTable) {
        this.dataSourceTable = dataSourceTable;
    }

    @com.fasterxml.jackson.annotation.JsonRawValue

    public String getQueryConfig() {
        return queryConfig;
    }

    public void setQueryConfig(String queryConfig) {
        this.queryConfig = queryConfig;
    }

    public String getUserColumn() {
        return userColumn;
    }

    public void setUserColumn(String userColumn) {
        this.userColumn = userColumn;
    }
}
