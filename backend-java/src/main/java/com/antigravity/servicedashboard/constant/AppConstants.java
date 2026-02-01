package com.antigravity.servicedashboard.constant;

public class AppConstants {

    private AppConstants() {
        
    }

    
    public static final String DS_TYPE_REST_API = "REST_API";
    public static final String DS_TYPE_LOCAL_COMMAND = "LOCAL_COMMAND";
    public static final String DS_TYPE_LOCAL_FILE = "LOCAL_FILE";
    public static final String DS_TYPE_SQL_SERVER = "SQL_SERVER";

    
    public static final String WIDGET_TYPE_CARD = "card";
    public static final String WIDGET_TYPE_MULTI_METRIC = "multi_metric";
    public static final String WIDGET_TYPE_GRID = "grid";
    public static final String WIDGET_TYPE_STATUS_GRID = "status_grid";

    
    public static final String CONFIG_BASE_URL = "baseUrl";
    public static final String CONFIG_HEADERS = "headers";
    public static final String CONFIG_PATH = "path";
    public static final String CONFIG_FORMAT = "format";
    public static final String CONFIG_LABEL_COLUMN = "labelColumn";
    public static final String CONFIG_STATUS_COLUMN = "statusColumn";
    public static final String CONFIG_RULES = "rules";
    public static final String CONFIG_METRICS = "metrics";
    public static final String CONFIG_GLOBAL_FILTER = "globalFilter";

    
    public static final String KEY_OPERATION = "operation";
    public static final String KEY_COLUMN = "column";
    public static final String KEY_CONDITION = "condition";
    public static final String KEY_VALUE = "value";
    public static final String KEY_THRESHOLD_OP = "thresholdOperator";
    public static final String KEY_THRESHOLD_VAL = "thresholdValue";
    public static final String KEY_FIELD = "field";

    public static final String KEY_COLOR = "color";
    public static final String KEY_LABEL = "label";
    public static final String KEY_ERROR = "error";
    public static final String KEY_COUNT = "count";

    
    public static final String DEFAULT_COLOR = "primary";
    public static final String DEFAULT_STATUS = "-";
    public static final String DEFAULT_UNKNOWN = "Unknown";
    public static final String OP_COUNT = "COUNT";

    
    public static final String FORMAT_JSON = "json";
    public static final String FORMAT_CSV = "csv";
    public static final String FORMAT_AUTO = "auto";
    public static final String FORMAT_TEXT = "text";
}
