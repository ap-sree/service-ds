package com.antigravity.servicedashboard.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.StringJoiner;

@Service
public class TableManagerService {

    private static final Logger logger = LoggerFactory.getLogger(TableManagerService.class);

    private final JdbcTemplate jdbcTemplate;

    public TableManagerService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Ensures the table name starts with 'sync_' to prevent overriding system
     * tables.
     */
    private void validateTableName(String tableName) {
        if (!tableName.startsWith("sync_")) {
            throw new IllegalArgumentException(
                    "Security Alert: Table name must start with 'sync_'. Provided: " + tableName);
        }
        // Basic SQL Injection prevention for table names (allow only alphanumeric and
        // underscores)
        if (!tableName.matches("^[\\w]+$")) {
            throw new IllegalArgumentException("Security Alert: Invalid table name format. Provided: " + tableName);
        }
    }

    @Transactional
    public void createOrUpdateTable(String tableName, Map<String, String> schema, String strategy) {
        validateTableName(tableName);

        // For RELOAD, we drop and recreate
        // For APPEND, we only create if not exists (schema evolution not fully handled
        // in V1)
        if ("RELOAD".equalsIgnoreCase(strategy) || strategy == null) {
            logger.info("Dropping table if exists (RELOAD): {}", tableName);
            jdbcTemplate.execute("DROP TABLE IF EXISTS " + tableName);
        }

        // Check if table exists
        boolean tableExists = false;
        try {
            jdbcTemplate.queryForObject("SELECT 1 FROM " + tableName + " LIMIT 1", Integer.class);
            tableExists = true;
        } catch (Exception e) {
            // Table likely doesn't exist
        }

        if (tableExists && "APPEND".equalsIgnoreCase(strategy)) {
            // Ideally check schema matches, for now assume OK
            return;
        }

        // Build CREATE TABLE statement
        StringBuilder sql = new StringBuilder("CREATE TABLE IF NOT EXISTS ").append(tableName).append(" (");

        // Use _id as internal PK to allow flexible primary keys
        sql.append("_id INTEGER PRIMARY KEY AUTOINCREMENT");
        sql.append(", _synced_at DATETIME DEFAULT CURRENT_TIMESTAMP");

        for (Map.Entry<String, String> entry : schema.entrySet()) {
            String colName = entry.getKey();
            String colType = entry.getValue();

            // Sanitize column name
            // Sanitize column name
            if ("_id".equalsIgnoreCase(colName)) {
                continue; // Skip internal PK
            }
            if (!colName.matches("^[\\w]+$")) {
                logger.warn("Skipping invalid column name: {}", colName);
                continue;
            }

            sql.append(", ").append(colName).append(" ").append(colType);
        }

        sql.append(")");

        logger.info("Executing DDL: {}", sql);
        jdbcTemplate.execute(sql.toString());
    }

    @Transactional
    public void syncData(String tableName, List<Map<String, Object>> dataRowList, String strategy, String primaryKey) {
        validateTableName(tableName);

        if (dataRowList == null || dataRowList.isEmpty()) {
            return;
        }

        if ("APPEND".equalsIgnoreCase(strategy) && primaryKey != null && !primaryKey.isEmpty()) {
            upsertData(tableName, dataRowList, primaryKey);
        } else {
            // RELOAD or FALLBACK
            logger.info("Strategy RELOAD: Clearing table {}", tableName);
            jdbcTemplate.execute("DELETE FROM " + tableName);
            batchInsert(tableName, dataRowList);
        }
    }

    private void batchInsert(String tableName, List<Map<String, Object>> dataRowList) {
        if (dataRowList.isEmpty())
            return;

        Map<String, Object> firstRow = dataRowList.get(0);
        Set<String> columns = firstRow.keySet();
        if (columns.isEmpty())
            return;

        // Build INSERT
        StringBuilder sql = new StringBuilder("INSERT INTO ").append(tableName).append(" (");
        StringJoiner colNames = new StringJoiner(", ");
        StringJoiner placeHolders = new StringJoiner(", ");

        for (String col : columns) {
            colNames.add(col);
            placeHolders.add("?");
        }
        // Add _synced_at
        sql.append(colNames).append(", _synced_at) VALUES (").append(placeHolders).append(", CURRENT_TIMESTAMP)");

        List<Object[]> batchArgs = dataRowList.stream().map(row -> {
            Object[] args = new Object[columns.size()];
            int i = 0;
            for (String col : columns) {
                args[i++] = row.get(col);
            }
            return args;
        }).toList();

        jdbcTemplate.batchUpdate(sql.toString(), batchArgs);
        logger.info("Inserted {} rows into {}", dataRowList.size(), tableName);
    }

    private void upsertData(String tableName, List<Map<String, Object>> dataRowList, String primaryKey) {
        if (dataRowList.isEmpty())
            return;

        // 1. Load existing Keys (Case-Insensitive)
        // Map<LowerCasePK, InternalID>
        Map<String, Object> firstRow = dataRowList.get(0);
        Set<String> columns = firstRow.keySet();

        List<Map<String, Object>> existing = jdbcTemplate
                .queryForList("SELECT _id, " + primaryKey + " FROM " + tableName);
        Map<String, Integer> existingMap = new java.util.HashMap<>();

        for (Map<String, Object> row : existing) {
            Object pkVal = row.get(primaryKey);
            if (pkVal != null) {
                existingMap.put(String.valueOf(pkVal).toLowerCase(), (Integer) row.get("_id"));
            }
        }

        // 2. Separate Insert vs Update
        List<Object[]> insertBatch = new java.util.ArrayList<>();
        List<Object[]> updateBatch = new java.util.ArrayList<>();

        // Prepared Stats
        String insertSql = buildInsertSql(tableName, columns);
        String updateSql = buildUpdateSql(tableName, columns, "_id");

        for (Map<String, Object> row : dataRowList) {
            Object pkVal = row.get(primaryKey);
            String pkStr = pkVal != null ? String.valueOf(pkVal).toLowerCase() : null;

            Object[] args = new Object[columns.size()];
            int i = 0;
            for (String col : columns) {
                args[i++] = row.get(col);
            }

            if (pkStr != null && existingMap.containsKey(pkStr)) {
                // UPDATE: Add ID to args
                Object[] updateArgs = new Object[args.length + 1];
                System.arraycopy(args, 0, updateArgs, 0, args.length);
                updateArgs[args.length] = existingMap.get(pkStr); // WHERE _id = ?
                updateBatch.add(updateArgs);
            } else {
                // INSERT
                insertBatch.add(args);

                // Track new inserts to avoid dups within same batch?
                // For MVP assume unique batch
                if (pkStr != null)
                    existingMap.put(pkStr, -1);
            }
        }

        if (!insertBatch.isEmpty()) {
            jdbcTemplate.batchUpdate(insertSql, insertBatch);
            logger.info("Upsert: Inserted {} rows", insertBatch.size());
        }
        if (!updateBatch.isEmpty()) {
            jdbcTemplate.batchUpdate(updateSql, updateBatch);
            logger.info("Upsert: Updated {} rows", updateBatch.size());
        }
    }

    private String buildInsertSql(String tableName, Set<String> columns) {
        StringBuilder sql = new StringBuilder("INSERT INTO ").append(tableName).append(" (");
        StringJoiner colNames = new StringJoiner(", ");
        StringJoiner placeHolders = new StringJoiner(", ");

        for (String col : columns) {
            colNames.add(col);
            placeHolders.add("?");
        }
        sql.append(colNames).append(", _synced_at) VALUES (").append(placeHolders).append(", CURRENT_TIMESTAMP)");
        return sql.toString();
    }

    private String buildUpdateSql(String tableName, Set<String> columns, String idCol) {
        StringBuilder sql = new StringBuilder("UPDATE ").append(tableName).append(" SET ");
        StringJoiner updates = new StringJoiner(", ");

        for (String col : columns) {
            updates.add(col + " = ?");
        }
        sql.append(updates).append(", _synced_at = CURRENT_TIMESTAMP WHERE ").append(idCol).append(" = ?");
        return sql.toString();
    }

    public void dropTable(String tableName) {
        validateTableName(tableName);
        logger.info("Dropping table: {}", tableName);
        jdbcTemplate.execute("DROP TABLE IF EXISTS " + tableName);
    }
}
