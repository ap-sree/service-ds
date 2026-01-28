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
        StringBuilder sql = new StringBuilder("SELECT * FROM ").append(tableName);
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
        String countSql = baseSql.replace("SELECT *", "SELECT COUNT(*) as count");
        try {
            Long count = jdbcTemplate.queryForObject(countSql, Long.class, params.toArray());
            return Map.of(
                    "type", AppConstants.WIDGET_TYPE_CARD,
                    AppConstants.KEY_COUNT, count != null ? count : 0,
                    AppConstants.KEY_LABEL, widget.getTitle());
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
                String op = m.getOrDefault(AppConstants.KEY_OPERATION, AppConstants.OP_COUNT).toUpperCase();
                String col = m.getOrDefault(AppConstants.KEY_COLUMN, "*");
                String cond = m.getOrDefault(AppConstants.KEY_CONDITION, "");

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

            String aggSql = baseSql.replace("SELECT *", "SELECT " + String.join(", ", selects));
            Map<String, Object> row = jdbcTemplate.queryForMap(aggSql, params.toArray());

            List<Map<String, Object>> items = new ArrayList<>();
            for (int i = 0; i < metrics.size(); i++) {
                Map<String, String> m = metrics.get(i);
                items.add(Map.of(
                        AppConstants.KEY_LABEL, m.getOrDefault(AppConstants.KEY_LABEL, "Metric"),
                        AppConstants.KEY_VALUE, row.get("m" + i),
                        AppConstants.KEY_OPERATION, m.getOrDefault(AppConstants.KEY_OPERATION, AppConstants.OP_COUNT)));
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
                        Object ruleVal = rule.get(AppConstants.KEY_VALUE);
                        // Loose equality check (String vs Number)
                        if (String.valueOf(ruleVal).equals(String.valueOf(statusVal))) {
                            color = (String) rule.get(AppConstants.KEY_COLOR);
                            break;
                        }
                    }
                }

                items.add(Map.of(
                        AppConstants.KEY_LABEL, labelVal != null ? labelVal : AppConstants.DEFAULT_UNKNOWN,
                        "status", statusVal != null ? statusVal : AppConstants.DEFAULT_STATUS,
                        AppConstants.KEY_COLOR, color));
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
        List<Map<String, Object>> columns = jdbcTemplate.queryForList("PRAGMA table_info(" + tableName + ")");
        return columns.stream()
                .map(row -> (String) row.get("name"))
                .toList();
    }

    // applyDateRegex moved to AppUtils
}
