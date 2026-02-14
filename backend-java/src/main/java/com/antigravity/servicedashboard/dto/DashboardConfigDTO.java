package com.antigravity.servicedashboard.dto;

import java.util.List;

public class DashboardConfigDTO {
    private List<WidgetDefinitionDTO> widgets;
    private Integer refreshInterval;
    private List<Long> layout;

    public DashboardConfigDTO() {
    }

    public DashboardConfigDTO(List<WidgetDefinitionDTO> widgets, Integer refreshInterval, List<Long> layout) {
        this.widgets = widgets;
        this.refreshInterval = refreshInterval;
        this.layout = layout;
    }

    public List<WidgetDefinitionDTO> getWidgets() {
        return widgets;
    }

    public void setWidgets(List<WidgetDefinitionDTO> widgets) {
        this.widgets = widgets;
    }

    public Integer getRefreshInterval() {
        return refreshInterval;
    }

    public void setRefreshInterval(Integer refreshInterval) {
        this.refreshInterval = refreshInterval;
    }

    public List<Long> getLayout() {
        return layout;
    }

    public void setLayout(List<Long> layout) {
        this.layout = layout;
    }
}
