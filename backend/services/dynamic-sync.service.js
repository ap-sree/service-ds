const cron = require('node-cron');
const db = require('../database');
const externalDb = require('./external-db.service');
const apiService = require('./api.service');
const shellService = require('./shell.service');
const fileService = require('./files.service');
const tableManager = require('./table-manager.service');
const notificationService = require('./notification.service');

class DynamicSyncService {
    constructor() {
        this.tasks = new Map(); // Store scheduled tasks
    }

    // Load definitions from DB and schedule them
    init() {
        console.log('Initializing Sync Engine...');
        db.all("SELECT * FROM sync_definitions", (err, rows) => {
            if (err) {
                console.error('Failed to load sync definitions', err);
                return;
            }
            rows.forEach(def => this.scheduleSync(def));
        });
    }

    async previewData(sourceId, query) {
        const source = await this._getSource(sourceId);
        if (!source) throw new Error(`Source ${sourceId} not found`);

        const sourceConfig = JSON.parse(source.config);

        if (source.type === 'SQL_SERVER') {
            return await externalDb.executeQuery(sourceConfig, query);
        } else if (source.type === 'REST_API') {
            return await apiService.fetchData(sourceConfig, query);
        } else if (source.type === 'LOCAL_COMMAND') {
            const format = sourceConfig.format || 'text';
            return await shellService.execute(query, format);
        } else if (source.type === 'LOCAL_FILE') {
            // query acts as the file path override OR we use config path
            const filePath = query && query.trim() !== '' ? query : sourceConfig.path;
            const format = sourceConfig.format || 'auto';
            return await fileService.readFile(filePath, format);
        }
        return [];
    }

    scheduleSync(def) {
        // Clear existing task if any (for updates)
        if (this.tasks.has(def.id)) {
            this.tasks.get(def.id).stop();
            this.tasks.delete(def.id);
        }

        if (def.sync_mode === 'MANUAL') return;

        if (def.sync_mode === 'SCHEDULED' && def.schedule_config) {
            // Cron
            const task = cron.schedule(def.schedule_config, () => {
                this.runSync(def.id);
            });
            this.tasks.set(def.id, task);
        }
    }

    async runSync(defId) {
        console.log(`Starting sync for Def ID: ${defId}`);

        // 1. Fetch Definition & Source Config
        const def = await this._getSyncDef(defId);
        if (!def) return console.error(`Sync Def ${defId} not found`);

        const source = await this._getSource(def.source_id);
        if (!source) return console.error(`Source ${def.source_id} not found`);

        const sourceConfig = JSON.parse(source.config);

        try {
            let data = [];

            // 2. Fetch Data
            if (source.type === 'SQL_SERVER') {
                data = await externalDb.executeQuery(sourceConfig, def.fetch_query);
            } else if (source.type === 'REST_API') {
                data = await apiService.fetchData(sourceConfig, def.fetch_query);
            } else if (source.type === 'LOCAL_COMMAND') {
                const format = sourceConfig.format || 'text';
                data = await shellService.execute(def.fetch_query, format);
            } else if (source.type === 'LOCAL_FILE') {
                // def.fetch_query can be an override path, or we default to sourceConfig.path
                // If fetch_query is empty, assume sourceConfig.path is the target
                const filePath = def.fetch_query && def.fetch_query.trim() !== '' ? def.fetch_query : sourceConfig.path;
                const format = sourceConfig.format || 'auto';
                data = await fileService.readFile(filePath, format);
            }

            console.log(`Fetched ${data.length} records for ${def.target_table_name}`);

            // 2.5 Apply Field Mapping (Extraction & Flattening)
            // Expects mapping format: { "target_column_name": "source.property.path" }
            if (def.field_mapping && data.length > 0) {
                try {
                    const mapping = JSON.parse(def.field_mapping);
                    const targetColumns = Object.keys(mapping);

                    if (targetColumns.length > 0) {
                        data = data.map(row => {
                            const newRow = {};
                            targetColumns.forEach(col => {
                                const path = mapping[col];
                                let val = this._resolvePath(row, path);

                                // Auto-Stringify Objects/Arrays for storage
                                if (val && typeof val === 'object') {
                                    val = JSON.stringify(val);
                                }
                                newRow[col] = val;
                            });
                            return newRow;
                        });
                        console.log('Applied deep field extraction mapping');
                    }
                } catch (e) {
                    console.warn('Invalid field_mapping JSON', e);
                }
            }

            // 3. Sync to Local DB
            console.log(`Syncing ${data.length} rows to DB (${def.sync_strategy})...`);
            await tableManager.syncData(def.target_table_name, data, def.sync_strategy, def.primary_key);

            // 4. Update Status
            this._updateSyncStatus(defId, 'SUCCESS', data.length);

            // 5. Check Notification Rules
            notificationService.checkRules(def.target_table_name);

        } catch (error) {
            console.error(`Sync failed for ${defId}`, error);
            this._updateSyncStatus(defId, 'ERROR', 0, error.message);
        }
    }

    // --- Helpers ---

    _getSyncDef(id) {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM sync_definitions WHERE id = ?", [id], (err, row) => {
                if (err) reject(err); else resolve(row);
            });
        });
    }

    _getSource(id) {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM data_sources WHERE id = ?", [id], (err, row) => {
                if (err) reject(err); else resolve(row);
            });
        });
    }

    _updateSyncStatus(id, status, count, errorMsg = null) {
        db.run(`UPDATE sync_definitions SET last_run_at = CURRENT_TIMESTAMP, last_status = ? WHERE id = ?`,
            [status, id]
        );
    }

    _resolvePath(obj, path) {
        if (!path || !obj) return null;
        // Normalize array syntax: "items[0].name" -> "items.0.name"
        const cleanPath = path.replace(/\[(\d+)\]/g, '.$1');
        return cleanPath.split('.').reduce((acc, part) => acc && acc[part] !== undefined ? acc[part] : null, obj);
    }
}

module.exports = new DynamicSyncService();
