package com.antigravity.servicedashboard.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class UserPreferences {

    @JsonProperty("widgetIds")
    private List<Long> widgetIds;

    @JsonProperty("theme")
    private String theme;

    public UserPreferences() {
        super();
    }

    public List<Long> getWidgetIds() {
        return widgetIds;
    }

    public void setWidgetIds(List<Long> widgetIds) {
        this.widgetIds = widgetIds;
    }

    public String getTheme() {
        return theme;
    }

    public void setTheme(String theme) {
        this.theme = theme;
    }
}
