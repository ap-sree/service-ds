const db = require('../database');

class TableManagerService {
    /**
     * Ensures the target table exists with columns matching the data keys.
     * WARNING: This is a simplified implementation. In production, we'd handle schema migration.
     * @param {string} tableName 
     * @param {object} sampleRow 
     */
    async ensureTable(tableName, sampleRow) {
        if (!sampleRow) return;

        const columns = Object.keys(sampleRow).map(key => {
            // Simple type inference
            const type = typeof sampleRow[key] === 'number' ? 'NUMERIC' : 'TEXT';
            return `"${key}" ${type}`;
        });

        const createSql = `CREATE TABLE IF NOT EXISTS "${tableName}" (
            _id INTEGER PRIMARY KEY AUTOINCREMENT,
            _synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            ${columns.join(', ')}
        )`;

        return new Promise((resolve, reject) => {
            db.run(createSql, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Replaces or Appends data in the table.
     * @param {string} tableName 
     * @param {any[]} data 
     * @param {string} strategy 'RELOAD' (default) or 'APPEND'
     * @param {string} primaryKey Required if strategy is 'APPEND'
     */
    async syncData(tableName, data, strategy = 'RELOAD', primaryKey = null) {
        if (!data || data.length === 0) return;

        // 1. Ensure Table Exists & Schema Matches
        const schemaOk = await this.checkSchema(tableName, data[0]);
        if (!schemaOk) {
            console.log(`Schema mismatch for ${tableName}. Recreating table...`);
            await this._run(`DROP TABLE IF EXISTS "${tableName}"`);
        }
        await this.ensureTable(tableName, data[0]);

        // STRATEGY: RELOAD (Default)
        if (strategy === 'RELOAD' || !strategy) {
            // Clear existing data
            await this._run(`DELETE FROM "${tableName}"`);
            return await this._batchInsert(tableName, data);
        }

        // STRATEGY: APPEND (Upsert)
        if (strategy === 'APPEND') {
            if (!primaryKey) {
                console.warn(`Sync Strategy is APPEND but no Primary Key defined for ${tableName}. Falling back to Insert-All.`);
                return await this._batchInsert(tableName, data);
            }
            return await this._upsertData(tableName, data, primaryKey);
        }
    }

    async _batchInsert(tableName, data) {
        const sampleKeys = Object.keys(data[0]);
        const placeholders = sampleKeys.map(() => '?').join(',');
        const sql = `INSERT INTO "${tableName}" (${sampleKeys.map(k => `"${k}"`).join(',')}, _synced_at) VALUES (${placeholders}, CURRENT_TIMESTAMP)`;

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run("BEGIN TRANSACTION");

                const stmt = db.prepare(sql, (err) => {
                    if (err) {
                        db.run("ROLLBACK"); // Rollback if prepare fails
                        return reject(err);
                    }
                });

                data.forEach(row => {
                    const values = sampleKeys.map(key => {
                        const val = row[key];
                        return typeof val === 'object' ? JSON.stringify(val) : val;
                    });
                    stmt.run(values, (err) => {
                        if (err) {
                            console.error(`Insert Failed [${tableName}]:`, err.message);
                            // In a transaction, a single failed insert should ideally rollback the whole thing
                            // For now, we just log and let the transaction continue, but this might need refinement
                            // depending on desired error handling (e.g., db.run("ROLLBACK"); reject(err);)
                        }
                    });
                });

                stmt.finalize();

                db.run("COMMIT", (err) => {
                    if (err) reject(err);
                    else resolve(data.length);
                });
            });
        });
    }

    async _upsertData(tableName, data, primaryKey) {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run("BEGIN TRANSACTION");

                // 1. Load Existing Keys for Case-Insensitive comparison
                db.all(`SELECT _id, "${primaryKey}" as pk FROM "${tableName}"`, (err, rows) => {
                    if (err) {
                        db.run("ROLLBACK");
                        return reject(err);
                    }

                    const existingMap = new Map();
                    rows.forEach(r => {
                        if (r.pk !== null && r.pk !== undefined) {
                            existingMap.set(String(r.pk).toLowerCase(), r._id);
                        }
                    });

                    // 2. Prepare Statements
                    const sampleKeys = Object.keys(data[0]);
                    const colNames = sampleKeys.map(k => `"${k}"`).join(',');
                    const placeholders = sampleKeys.map(() => '?').join(',');

                    const insertSql = `INSERT INTO "${tableName}" (${colNames}, _synced_at) VALUES (${placeholders}, CURRENT_TIMESTAMP)`;
                    const insertStmt = db.prepare(insertSql);

                    const updateSet = sampleKeys.map(k => `"${k}" = ?`).join(',');
                    const updateSql = `UPDATE "${tableName}" SET ${updateSet}, _synced_at = CURRENT_TIMESTAMP WHERE _id = ?`;
                    const updateStmt = db.prepare(updateSql);

                    // 3. Process Rows
                    data.forEach(row => {
                        const pkVal = row[primaryKey];
                        const pkStr = (pkVal !== null && pkVal !== undefined) ? String(pkVal).toLowerCase() : null;
                        const existingId = pkStr ? existingMap.get(pkStr) : null;

                        const values = sampleKeys.map(k => {
                            const val = row[k];
                            return typeof val === 'object' ? JSON.stringify(val) : val;
                        });

                        if (existingId) {
                            updateStmt.run([...values, existingId]);
                        } else {
                            insertStmt.run(values);
                        }
                    });

                    insertStmt.finalize();
                    updateStmt.finalize();

                    db.run("COMMIT", (err) => {
                        if (err) reject(err); else resolve(data.length);
                    });
                });
            });
        });
    }

    async checkSchema(tableName, sampleRow) {
        return new Promise((resolve) => {
            db.all(`PRAGMA table_info("${tableName}")`, (err, rows) => {
                if (err || !rows || rows.length === 0) {
                    resolve(false); // Table doesn't exist = "not ok" (will create)
                    return;
                }
                const existingCols = new Set(rows.map(r => r.name));
                const newCols = Object.keys(sampleRow);

                // 1. Check if all new keys exist in table
                const allKeysExist = newCols.every(k => existingCols.has(k));

                // 2. Check if table has extra columns (strict sync? or allow? let's be strict for now)
                // Actually, ignore extra columns like _id, _synced_at

                resolve(allKeysExist);
            });
        });
    }

    _run(sql, params = []) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }
}

module.exports = new TableManagerService();
