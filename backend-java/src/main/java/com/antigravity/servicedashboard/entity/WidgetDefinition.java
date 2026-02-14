package com.antigravity.servicedashboard.entity;

import jakarta.persistence.*;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

@Entity
@Table(name = "widget_definitions")
public class WidgetDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    @NotBlank(message = "{widget.title.required}")
    private String title;

    @Column(nullable = false)
    @NotBlank(message = "{widget.type.required}")
    @Pattern(regexp = "^(TABLE|CARD|STATUS_GRID|MULTI_METRIC)$", message = "{widget.type.pattern}")
    private String type;

    @Column(name = "data_source_table", nullable = false)
    @NotBlank(message = "{widget.dataSourceTable.required}")
    private String dataSourceTable;

    @Column(name = "query_config")
    @Lob
    private String queryConfig;

    @Column(name = "user_column")
    private String userColumn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sync_id")
    private SyncDefinition syncDefinition;

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
