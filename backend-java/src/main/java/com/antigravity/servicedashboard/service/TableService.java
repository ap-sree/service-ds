package com.antigravity.servicedashboard.service;

import com.antigravity.servicedashboard.entity.SyncDefinition;
import com.antigravity.servicedashboard.entity.WidgetDefinition;
import com.antigravity.servicedashboard.repository.SyncDefinitionRepository;
import com.antigravity.servicedashboard.repository.WidgetDefinitionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import com.antigravity.servicedashboard.constant.AppConstants;
import com.antigravity.servicedashboard.util.AppUtils;
import com.antigravity.servicedashboard.util.MessageUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;


@Service
public class TableService {

    private static final Logger logger = LoggerFactory.getLogger(TableService.class);

    private final WidgetDefinitionRepository widgetRepo;
    private final SyncDefinitionRepository syncRepo;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper mapper = new ObjectMapper();

    private static final String KEY_ITEMS = "items";
    private static final Set<String> SYSTEM_COLUMNS = Set.of("_id", "_synced_at");

    public TableService(WidgetDefinitionRepository widgetRepo, SyncDefinitionRepository syncRepo, JdbcTemplate jdbcTemplate) {
        this.widgetRepo = widgetRepo;
        this.syncRepo = syncRepo;
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
            throw new IllegalArgumentException(MessageUtils.get("error.table.invalid"));
        }

        String type = widget.getType().toLowerCase();
        String userColumn = widget.getUserColumn();

        StringBuilder sql = new StringBuilder("SELECT TOP(").append(limit).append(") * FROM \"app\".\"").append(tableName).append("\"");
        List<Object> params = new ArrayList<>();

        if (userId != null && userColumn != null && !userColumn.isEmpty()) {
            sql.append(" WHERE ").append(userColumn).append(" = ?");
            params.add(userId);
        }

        if (widget.getQueryConfig() != null) {
            Map<String, Object> config = parseConfig(widget.getQueryConfig());
            String globalFilter = (String) config.get(AppConstants.CONFIG_GLOBAL_FILTER);

            if (globalFilter != null && !globalFilter.isBlank()) {

                validateSqlFilter(globalFilter);
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

        else if (AppConstants.WIDGET_TYPE_GRID.equals(type) || AppConstants.WIDGET_TYPE_STATUS_GRID.equals(type)) {
            return fetchGridData(sql.toString(), params, widget, limit, type);
        }

        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql.toString(), params.toArray());
            return Map.of("type", type, KEY_ITEMS, stripSystemColumns(rows), "limit", limit);
        } catch (Exception e) {
            logger.error("Data fetch failed for widget {} (table: {})", widgetId, tableName, e);
            throw new IllegalStateException(MessageUtils.get("error.table.unreachable", tableName), e);
        }
    }

    private List<Map<String, Object>> stripSystemColumns(List<Map<String, Object>> rows) {
        return rows.stream().map(row -> {
            Map<String, Object> filtered = new LinkedHashMap<>(row);
            SYSTEM_COLUMNS.forEach(filtered::remove);
            return filtered;
        }).toList();
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
        String countSql = "SELECT COUNT(*) as count FROM \"app\"." + getQuotedTableName(widget.getDataSourceTable());
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
            logger.error("Card data fetch failed for table: {}", widget.getDataSourceTable(), e);
            throw new IllegalStateException(MessageUtils.get("error.table.notready", widget.getDataSourceTable()), e);
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
                    validateSqlFilter(cond);
                    cond = AppUtils.applyDateRegex(cond);

                    if (AppConstants.OP_COUNT.equals(op)) {
                        target = "CASE WHEN " + cond + " THEN 1 ELSE NULL END";
                    } else {
                        target = "CASE WHEN " + cond + " THEN " + col + " ELSE NULL END";
                    }
                }
                selects.add(op + "(" + target + ") as m" + i);
            }

            String tableName = widget.getDataSourceTable();
            StringBuilder aggSql = new StringBuilder("SELECT ").append(String.join(", ", selects))
                    .append(" FROM \"app\".\"").append(tableName).append("\"");
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
            logger.error("Multi-metric aggregation failed for widget: {}", widget.getTitle(), e);
            throw new IllegalStateException(MessageUtils.get("error.table.aggregation"), e);
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
                String color = AppConstants.DEFAULT_COLOR;

                if (rules != null && statusVal != null) {
                    for (Map<String, Object> rule : rules) {
                        Object ruleVal = rule.get("value");

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
            logger.error("Grid fetch failed for widget: {}", widget.getTitle(), e);
            throw new IllegalStateException(MessageUtils.get("error.table.gridfetch"), e);
        }
    }

    public List<String> getTableSchema(Long widgetId) {
        WidgetDefinition widget = widgetRepo.findById(widgetId)
                .orElseThrow(() -> new IllegalArgumentException("Widget not found"));

        return fetchColumns(widget.getDataSourceTable());
    }

    public List<String> getSyncSchema(Long syncId) {
        SyncDefinition sync = syncRepo.findById(syncId)
                .orElseThrow(() -> new IllegalArgumentException("Sync definition not found"));

        return fetchColumns(sync.getTargetTableName());
    }

    private List<String> fetchColumns(String tableName) {
        if (!AppUtils.isValidTableName(tableName)) {
            throw new IllegalArgumentException(MessageUtils.get("error.table.invalid.param", tableName));
        }

        try {
            List<Map<String, Object>> columns = jdbcTemplate.queryForList(
                    "{call app.sp_GetTableColumns(?)}",
                    tableName);

            return columns.stream()
                    .map(row -> (String) row.get("name"))
                    .filter(name -> !SYSTEM_COLUMNS.contains(name))
                    .toList();
        } catch (Exception e) {
            logger.error("Schema fetch failed for table: {}", tableName, e);
            throw new IllegalStateException(MessageUtils.get("error.table.schemafetch"), e);
        }
    }

    private String getQuotedTableName(String tableName) {
        return "\"" + tableName + "\"";
    }

    private void validateSqlFilter(String filter) {
        if (filter == null || filter.isBlank())
            return;

        String upper = filter.toUpperCase();
        java.util.List<String> blockedKeywords = java.util.List.of(
                "DROP ", "DELETE ", "INSERT ", "UPDATE ", "ALTER ",
                "CREATE ", "EXEC ", "EXECUTE ", "UNION ", "INTO ",
                "--", "/*", "*/", "FILE");

        for (String keyword : blockedKeywords) {
            if (upper.contains(keyword)) {
                throw new IllegalArgumentException(MessageUtils.get("error.sql.forbidden.keyword", keyword));
            }
        }


        if (filter.contains(";") || filter.contains("\\")) {
            throw new IllegalArgumentException(MessageUtils.get("error.sql.forbidden.chars"));
        }
    }
}
