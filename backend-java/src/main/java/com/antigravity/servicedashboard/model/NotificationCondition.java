package com.antigravity.servicedashboard.model;

import com.antigravity.servicedashboard.constant.AppConstants;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationCondition {

    @JsonProperty(AppConstants.KEY_OPERATION)
    private String operation;

    @JsonProperty(AppConstants.KEY_COLUMN)
    private String column;

    @JsonProperty(AppConstants.KEY_CONDITION)
    private String condition;

    @JsonProperty(AppConstants.KEY_THRESHOLD_OP)
    private String thresholdOperator;

    @JsonProperty(AppConstants.KEY_THRESHOLD_VAL)
    private Double thresholdValue;

    // Getters and Setters
    public String getOperation() {
        return operation;
    }

    public void setOperation(String operation) {
        this.operation = operation;
    }

    public String getColumn() {
        return column;
    }

    public void setColumn(String column) {
        this.column = column;
    }

    public String getCondition() {
        return condition;
    }

    public void setCondition(String condition) {
        this.condition = condition;
    }

    public String getThresholdOperator() {
        return thresholdOperator;
    }

    public void setThresholdOperator(String thresholdOperator) {
        this.thresholdOperator = thresholdOperator;
    }

    public Double getThresholdValue() {
        return thresholdValue;
    }

    public void setThresholdValue(Double thresholdValue) {
        this.thresholdValue = thresholdValue;
    }
}
