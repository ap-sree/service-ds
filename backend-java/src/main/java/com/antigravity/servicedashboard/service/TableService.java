package com.antigravity.servicedashboard.service;

import com.antigravity.servicedashboard.entity.WidgetDefinition;
import com.antigravity.servicedashboard.repository.WidgetDefinitionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import com.antigravity.servicedashboard.constant.AppConstants;
import com.antigravity.servicedashboard.util.AppUtils;

@Service
public class TableService {

    private final WidgetDefinitionRepository widgetRepo;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper mapper = new ObjectMapper();

    private static final String KEY_ITEMS = "items";

    public TableService(WidgetDefinitionRepository widgetRepo, JdbcTemplate jdbcTemplate) {
        this.widgetRepo = widgetRepo;
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Object> fetchWidgetData(Long widgetId, String userId, int limit) {
        Optional<WidgetDefinition> widgetOpt = widgetRepo.findById(widgetId);
        if (widgetOpt.isEmpty()) {
            return Collections.emptyMap();
        }
        WidgetDefinition widget = widgetOpt.get();
        String tableName = widget.getDataSourceTable();
        if (!tableName.matches("^\\w+$")) {
            throw new IllegalArgumentException("Invalid table name");
        }

        String type = widget.getType().toLowerCase();
        String userColumn = widget.getUserColumn();

        // Quote table name
        StringBuilder sql = new StringBuilder("SELECT * FROM \"").append(tableName).append("\"");
        List<Object> params = new ArrayList<>();

        if (userId != null && userColumn != null && !userColumn.isEmpty()) {
            sql.append(" WHERE ").append(userColumn).append(" = ?");
            params.add(userId);
        }

        // Global Filter Logic
        if (widget.getQueryConfig() != null) {
            Map<String, Object> config = parseConfig(widget.getQueryConfig());
            String globalFilter = (String) config.get(AppConstants.CONFIG_GLOBAL_FILTER);

            if (globalFilter != null && !globalFilter.isBlank()) {
                // Apply Date Regex
                globalFilter = AppUtils.applyDateRegex(globalFilter);

                if (sql.toString().contains(" WHERE ")) {
                    sql.append(" AND (").append(globalFilter).append(")");
                } else {
                    sql.append(" WHERE (").append(globalFilter).append(")");
                }
            }
        }

        if (AppConstants.WIDGET_TYPE_CARD.equals(type)) {
            return fetchCardData(sql.toString(), params, widget);
        } else if (AppConstants.WIDGET_TYPE_MULTI_METRIC.equals(type)) {
            return fetchMultiMetricData(sql.toString(), params, widget);
        }

        else if (AppConstants.WIDGET_TYPE_GRID.equals(type) || AppConstants.WIDGET_TYPE_STATUS_GRID.equals(type))

        {
            // Apply LIMIT
            sql.append(" LIMIT ?");
            params.add(limit);
            return fetchGridData(sql.toString(), params, widget, limit, type);
        }

        // Default: Table
        sql.append(" LIMIT ?");
        params.add(limit);

        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql.toString(), params.toArray());
            return Map.of("type", type, KEY_ITEMS, rows, "limit", limit);
        } catch (Exception e) {
            throw new IllegalStateException("Data unreachable: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseConfig(String configJson) {
        try {
            return mapper.readValue(configJson, Map.class);
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    private Map<String, Object> fetchCardData(String baseSql, List<Object> params, WidgetDefinition widget) {
        String countSql = baseSql.replaceFirst("SELECT \\* FROM \"? \\w+ \"?",
                "SELECT COUNT(*) as count FROM " + getQuotedTableName(widget.getDataSourceTable())); // Simplified
                                                                                                     // replacement
        // Better approach: Reconstruct query
        countSql = "SELECT COUNT(*) as count FROM \"" + widget.getDataSourceTable() + "\"";
        if (baseSql.contains(" WHERE ")) {
            countSql += baseSql.substring(baseSql.indexOf(" WHERE "));
        }

        try {
            Long count = jdbcTemplate.queryForObject(countSql, Long.class, params.toArray());
            return Map.of(
                    "type", AppConstants.WIDGET_TYPE_CARD,
                    "count", count != null ? count : 0,
                    "label", widget.getTitle());
        } catch (Exception e) {
            throw new IllegalStateException("Table not ready");
        }
    }

    private Map<String, Object> fetchMultiMetricData(String baseSql, List<Object> params, WidgetDefinition widget) {
        try {
            if (widget.getQueryConfig() == null)
                return Map.of("type", AppConstants.WIDGET_TYPE_MULTI_METRIC, KEY_ITEMS, List.of());

            Map<String, Object> config = parseConfig(widget.getQueryConfig());
            @SuppressWarnings("unchecked")
            List<Map<String, String>> metrics = (List<Map<String, String>>) config.get(AppConstants.CONFIG_METRICS);

            if (metrics == null || metrics.isEmpty()) {
                return Map.of("type", AppConstants.WIDGET_TYPE_MULTI_METRIC, KEY_ITEMS, List.of());
            }

            List<String> selects = new ArrayList<>();
            for (int i = 0; i < metrics.size(); i++) {
                Map<String, String> m = metrics.get(i);
                String op = m.getOrDefault("operation", AppConstants.OP_COUNT).toUpperCase();
                String col = m.getOrDefault("column", "*");
                String cond = m.getOrDefault("condition", "");

                if (!col.matches("^[\\w*]+$"))
                    col = "*";

                String target = col;

                if (cond != null && !cond.isBlank()) {
                    cond = AppUtils.applyDateRegex(cond);

                    if (AppConstants.OP_COUNT.equals(op)) {
                        target = "CASE WHEN " + cond + " THEN 1 ELSE NULL END";
                    } else {
                        target = "CASE WHEN " + cond + " THEN " + col + " ELSE NULL END";
                    }
                }
                selects.add(op + "(" + target + ") as m" + i);
            }

            // Fix SQL Construction
            String tableName = widget.getDataSourceTable();
            StringBuilder aggSql = new StringBuilder("SELECT ").append(String.join(", ", selects))
                    .append(" FROM \"").append(tableName).append("\"");
            if (baseSql.contains(" WHERE ")) {
                aggSql.append(baseSql.substring(baseSql.indexOf(" WHERE ")));
            }

            Map<String, Object> row = jdbcTemplate.queryForMap(aggSql.toString(), params.toArray());

            List<Map<String, Object>> items = new ArrayList<>();
            for (int i = 0; i < metrics.size(); i++) {
                Map<String, String> m = metrics.get(i);
                items.add(Map.of(
                        "label", m.getOrDefault("label", "Metric"),
                        "value", row.get("m" + i),
                        "operation", m.getOrDefault("operation", AppConstants.OP_COUNT)));
            }
            return Map.of("type", AppConstants.WIDGET_TYPE_MULTI_METRIC, KEY_ITEMS, items);
        } catch (Exception e) {
            throw new IllegalStateException("Aggregation failed: " + e.getMessage());
        }
    }

    private Map<String, Object> fetchGridData(String sql, List<Object> params, WidgetDefinition widget, int limit,
            String type) {
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params.toArray());

            Map<String, Object> config = Map.of();
            if (widget.getQueryConfig() != null) {
                config = parseConfig(widget.getQueryConfig());
            }

            String labelCol = (String) config.get(AppConstants.CONFIG_LABEL_COLUMN);
            String statusCol = (String) config.get(AppConstants.CONFIG_STATUS_COLUMN);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> rules = (List<Map<String, Object>>) config.get(AppConstants.CONFIG_RULES);

            List<Map<String, Object>> items = new ArrayList<>();
            for (Map<String, Object> row : rows) {
                Object labelVal = labelCol != null ? row.get(labelCol) : AppConstants.DEFAULT_UNKNOWN;
                Object statusVal = statusCol != null ? row.get(statusCol) : AppConstants.DEFAULT_STATUS;
                String color = AppConstants.DEFAULT_COLOR; // Default

                if (rules != null && statusVal != null) {
                    for (Map<String, Object> rule : rules) {
                        Object ruleVal = rule.get("value");
                        // Loose equality check (String vs Number)
                        if (String.valueOf(ruleVal).equals(String.valueOf(statusVal))) {
                            color = (String) rule.get("color");
                            break;
                        }
                    }
                }

                items.add(Map.of(
                        "label", labelVal != null ? labelVal : AppConstants.DEFAULT_UNKNOWN,
                        "status", statusVal != null ? statusVal : AppConstants.DEFAULT_STATUS,
                        "color", color));
            }

            return Map.of("type", type, KEY_ITEMS, items, "limit", limit);
        } catch (Exception e) {
            throw new IllegalStateException("Grid fetch failed: " + e.getMessage());
        }
    }

    public List<String> getTableSchema(String tableName) {
        if (!AppUtils.isValidTableName(tableName)) {
            throw new IllegalArgumentException("Invalid table name");
        }
        // Use standard JDBC or H2 INFORMATION_SCHEMA instead of PRAGMA
        List<Map<String, Object>> columns = jdbcTemplate.queryForList(
                "SELECT COLUMN_NAME as \"name\" FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ?",
                tableName);
        // Fallback or double check casing if empty?
        // H2 stores quoted table names case-sensitively. Since we are fixing the app to
        // quote,
        // we should expect it to be passed correctly.
        if (columns.isEmpty()) {
            columns = jdbcTemplate.queryForList(
                    "SELECT COLUMN_NAME as \"name\" FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ?",
                    tableName.toUpperCase());
        }

        return columns.stream()
                .map(row -> (String) row.get("name"))
                .toList();
    }

    private String getQuotedTableName(String tableName) {
        return "\"" + tableName + "\"";
    }

    // applyDateRegex moved to AppUtils
}
