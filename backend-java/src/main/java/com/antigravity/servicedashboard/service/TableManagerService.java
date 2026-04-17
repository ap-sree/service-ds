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

import com.antigravity.servicedashboard.util.MessageUtils;

@Service
public class TableManagerService {

    private static final Logger logger = LoggerFactory.getLogger(TableManagerService.class);

    private final JdbcTemplate jdbcTemplate;

    public TableManagerService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private void validateTableName(String tableName) {
        if (!tableName.startsWith("sync_")) {
            throw new IllegalArgumentException(
                    "Security Alert: Table name must start with 'sync_'. Provided: " + tableName);
        }
        if (!tableName.matches("^[\\w]+$")) {
            throw new IllegalArgumentException(MessageUtils.get("error.table.invalidformat", tableName));
        }
    }

    @Transactional
    public void createOrUpdateTable(String tableName, Map<String, String> schema, String strategy) {
        validateTableName(tableName);

        if ("RELOAD".equalsIgnoreCase(strategy) || strategy == null) {
            logger.info("Dropping table if exists (RELOAD): {}", tableName);
            dropTable(tableName);
        }

        // Check if table exists
        boolean tableExists = false;
        try {
            Integer result = jdbcTemplate.queryForObject(
                    "{call app.sp_CheckTableExists(?)}",
                    Integer.class, tableName);
            tableExists = result != null && result == 1;
        } catch (Exception e) {
            logger.warn("Table existence check failed for {}: {}", tableName, e.getMessage());
        }

        if (tableExists && "APPEND".equalsIgnoreCase(strategy)) {
            return;
        }

        // Build column definitions string for SP
        StringJoiner colDefs = new StringJoiner(", ");
        for (Map.Entry<String, String> entry : schema.entrySet()) {
            String colName = entry.getKey();
            String colType = entry.getValue();

            if ("_id".equalsIgnoreCase(colName) || "_synced_at".equalsIgnoreCase(colName)) {
                continue; // Skip system columns
            }

            if (!colName.matches("^[\\w]+$")) {
                logger.warn("Skipping invalid column name: {}", colName);
                continue;
            }

            // Basic type mapping adjustment if needed, but assuming input is generic enough
            // or SQL Server compatible
            // e.g. TEXT -> NVARCHAR(MAX) mapping might be handled by caller or here
            colDefs.add(colName + " " + colType);
        }

        logger.info("Calling sp_CreateDynamicTable for {}", tableName);
        jdbcTemplate.update("{call app.sp_CreateDynamicTable(?, ?)}", tableName, colDefs.toString());
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
            logger.info("Strategy RELOAD: Clearing table {}", tableName);
            jdbcTemplate.execute("DELETE FROM \"app\".\"" + tableName + "\"");
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
        StringBuilder sql = new StringBuilder("INSERT INTO \"app\".\"" + tableName + "\" (");
        StringJoiner colNames = new StringJoiner(", ");
        StringJoiner placeHolders = new StringJoiner(", ");
        for (String col : columns) {
            colNames.add(col);
            placeHolders.add("?");
        }
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
        Map<String, Object> firstRow = dataRowList.get(0);
        Set<String> columns = firstRow.keySet();
        List<Map<String, Object>> existing = jdbcTemplate
                .queryForList("SELECT _id, " + primaryKey + " FROM \"app\".\"" + tableName + "\"");
        Map<String, Integer> existingMap = new java.util.HashMap<>();
        for (Map<String, Object> row : existing) {
            Object pkVal = row.get(primaryKey);
            if (pkVal != null) {
                existingMap.put(String.valueOf(pkVal).toLowerCase(), (Integer) row.get("_id"));
            }
        }
        List<Object[]> insertBatch = new java.util.ArrayList<>();
        List<Object[]> updateBatch = new java.util.ArrayList<>();
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
                Object[] updateArgs = new Object[args.length + 1];
                System.arraycopy(args, 0, updateArgs, 0, args.length);
                updateArgs[args.length] = existingMap.get(pkStr);
                updateBatch.add(updateArgs);
            } else {
                insertBatch.add(args);
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
        StringBuilder sql = new StringBuilder("INSERT INTO \"app\".\"" + tableName + "\" (");
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
        StringBuilder sql = new StringBuilder("UPDATE \"app\".\"" + tableName + "\" SET ");
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
        jdbcTemplate.update("{call app.sp_DropDynamicTable(?)}", tableName);
    }
}
