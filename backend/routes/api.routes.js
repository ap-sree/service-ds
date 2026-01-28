const express = require('express');
const router = express.Router();
const db = require('../database');
const syncService = require('../services/dynamic-sync.service');

// --- Generic CRUD Helper ---
function crud(tableName, routerPath) {
    // List
    router.get(routerPath, (req, res) => {
        db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
            if (err) res.status(500).json({ error: err.message });
            else res.json(rows);
        });
    });

    // Create
    router.post(routerPath, (req, res) => {
        const keys = Object.keys(req.body);
        const values = Object.values(req.body);
        const placeholders = keys.map(() => '?').join(',');
        const sql = `INSERT INTO ${tableName} (${keys.join(',')}) VALUES (${placeholders})`;

        db.run(sql, values, function (err) {
            if (err) res.status(500).json({ error: err.message });
            else res.json({ id: this.lastID, ...req.body });
        });
    });

    // Delete
    router.delete(`${routerPath}/:id`, (req, res) => {
        db.run(`DELETE FROM ${tableName} WHERE id = ?`, req.params.id, function (err) {
            if (err) res.status(500).json({ error: err.message });
            else res.json({ deleted: this.changes });
        });
    });

    // Update (PUT)
    router.put(`${routerPath}/:id`, (req, res) => {
        const keys = Object.keys(req.body).filter(k => k !== 'id'); // Don't update ID
        const values = keys.map(k => req.body[k]);
        values.push(req.params.id); // Add ID for WHERE clause

        const setClause = keys.map(k => `${k} = ?`).join(',');
        const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`;

        db.run(sql, values, function (err) {
            if (err) res.status(500).json({ error: err.message });
            else res.json({ updated: this.changes });
        });
    });
}

// --- Specialized Routes ---

// Override generic POST to schedule the job immediately
router.post('/sync-defs', (req, res) => {
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);
    const placeholders = keys.map(() => '?').join(',');
    const sql = `INSERT INTO sync_definitions (${keys.join(',')}) VALUES (${placeholders})`;

    db.run(sql, values, function (err) {
        if (err) res.status(500).json({ error: err.message });
        else {
            const newDef = { id: this.lastID, ...req.body };
            // Schedule it
            syncService.scheduleSync(newDef);
            console.log(`Scheduled new Sync Job ${newDef.id}`);
            res.json(newDef);
        }
    });
});

// Overwrite generic PUT for sync_definitions to handle Table Renaming/Cleanup
router.put('/sync-defs/:id', (req, res) => {
    const id = req.params.id;
    const newName = req.body.target_table_name;

    // 1. Get Old Name
    db.get("SELECT target_table_name FROM sync_definitions WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Sync Def not found' });

        const oldName = row.target_table_name;

        // 2. Perform Generic Update
        const keys = Object.keys(req.body).filter(k => k !== 'id');
        const values = keys.map(k => req.body[k]);
        values.push(id);
        const setClause = keys.map(k => `${k} = ?`).join(',');

        db.run(`UPDATE sync_definitions SET ${setClause} WHERE id = ?`, values, function (updateErr) {
            if (updateErr) return res.status(500).json({ error: updateErr.message });

            // 3. Cleanup Orphan Table if name changed
            if (newName && oldName && newName !== oldName) {
                console.log(`Renaming detected: Updating dependencies from ${oldName} to ${newName}`);

                // Update Widgets
                db.run("UPDATE widget_definitions SET data_source_table = ? WHERE data_source_table = ?",
                    [newName, oldName], (err) => {
                        if (err) console.error('Failed to update widgets on rename', err);
                        else console.log(`Updated widgets for rename: ${oldName} -> ${newName}`);
                    });

                // Update Notification Rules
                db.run("UPDATE notification_rules SET local_table_name = ? WHERE local_table_name = ?",
                    [newName, oldName], (err) => {
                        if (err) console.error('Failed to update rules on rename', err);
                        else console.log(`Updated rules for rename: ${oldName} -> ${newName}`);
                    });

                // Drop OLD table (data is re-synced to new table)
                db.run(`DROP TABLE IF EXISTS "${oldName}"`, (dropErr) => {
                    if (dropErr) console.warn('Failed to drop old table', dropErr);
                });
            }

            // 4. Reschedule Sync Job (Critical for Interval Updates)
            // We need to fetch the full updated definition because req.body might be partial
            db.get("SELECT * FROM sync_definitions WHERE id = ?", [id], (fetchErr, updatedDef) => {
                if (!fetchErr && updatedDef) {
                    syncService.scheduleSync(updatedDef);
                    console.log(`Rescheduled Sync Job ${id} with mode ${updatedDef.sync_mode}`);
                }
            });

            res.json({ updated: this.changes });
        });
    });
});

// --- Meta Tables CRUD ---
// --- Meta Tables CRUD ---

// Config Routes (Key-Value Store)
router.get('/config/:key', (req, res) => {
    db.get("SELECT value FROM app_configs WHERE key = ?", [req.params.key], (err, row) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(row ? JSON.parse(row.value) : null);
    });
});

router.post('/config', (req, res) => {
    const { key, value } = req.body;
    // Upsert (SQLite specific)
    db.run(`INSERT INTO app_configs (key, value) VALUES (?, ?) 
            ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, JSON.stringify(value)], function (err) {
            if (err) res.status(500).json({ error: err.message });
            else res.json({ success: true });
        });
});
// --- Cascade Delete Logic (Must be defined BEFORE generic CRUD) ---

const runSql = (query, params = []) => new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
        if (err) reject(err); else resolve(this);
    });
});
const getSql = (query, params = []) => new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
        if (err) reject(err); else resolve(rows);
    });
});

async function deleteSyncJob(syncId) {
    // 1. Get Target Table Name
    const rows = await getSql("SELECT target_table_name FROM sync_definitions WHERE id = ?", [syncId]);
    if (rows.length === 0) return; // Already gone
    const tableName = rows[0].target_table_name;

    // 2. Delete Widgets using this table
    console.log(`[Cascade] Deleting Widgets for table: ${tableName}`);
    await runSql("DELETE FROM widget_definitions WHERE data_source_table = ?", [tableName]);

    // 3. Delete Notification Rules using this table
    const rules = await getSql("SELECT id FROM notification_rules WHERE local_table_name = ?", [tableName]);
    console.log(`[Cascade] Found ${rules.length} rules to delete for table: ${tableName}`);
    for (const rule of rules) {
        require('../services/notification.service').removeSchedule(rule.id);
    }
    await runSql("DELETE FROM notification_rules WHERE local_table_name = ?", [tableName]);
    // 4. Drop Local Table
    await runSql(`DROP TABLE IF EXISTS ${tableName}`);

    // 5. Delete Sync Definition
    const dynamicSync = require('../services/dynamic-sync.service');
    if (dynamicSync.tasks && dynamicSync.tasks.has(Number(syncId))) {
        dynamicSync.tasks.get(Number(syncId)).stop(); // Stop scheduler
        dynamicSync.tasks.delete(Number(syncId));
    }

    await runSql("DELETE FROM sync_definitions WHERE id = ?", [syncId]);
}

router.delete('/data-sources/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const syncs = await getSql("SELECT id FROM sync_definitions WHERE source_id = ?", [id]);
        for (const sync of syncs) {
            await deleteSyncJob(sync.id);
        }
        await runSql("DELETE FROM data_sources WHERE id = ?", [id]);
        res.json({ message: 'Source and dependencies deleted' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/sync-defs/:id', async (req, res) => {
    try {
        await deleteSyncJob(req.params.id);
        res.json({ message: 'Sync Job and dependencies deleted' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ------------------------------------------------------------------

crud('data_sources', '/data-sources');
crud('sync_definitions', '/sync-defs');
// crud('widget_definitions', '/widgets'); // Replaced by custom routes below

// --- Consolidated Widgets Route ---
const widgetRoute = '/widgets';

// GET: Fetch Dashboard Widgets (Strictly for a User)
router.get(widgetRoute, async (req, res) => {
    try {
        const username = req.query.username;

        // Security: Strict Requirement
        if (!username) {
            return res.status(400).json({ error: "Username is required to fetch dashboard widgets." });
        }

        // 1. Fetch All Widgets (Base Data)
        const allWidgetsRaw = await getSql("SELECT * FROM widget_definitions");
        const allWidgets = allWidgetsRaw.map(r => {
            let config = r.query_config;
            try {
                if (config && typeof config === 'string') config = JSON.parse(config);
            } catch (e) { }

            // Optimization: UI only needs query_config for Status/Grid to map colors
            const isGrid = r.type && (r.type.toUpperCase() === 'STATUS_GRID' || r.type.toUpperCase() === 'GRID');

            return {
                id: r.id,
                title: r.title,
                type: r.type,
                query_config: isGrid ? config : undefined
            };
        });

        // 2. Resolve Layout (User > Global > Empty)
        let activeIds = [];
        let globalLayout = null;

        // Fetch Global First (Fallback)
        const globalRow = await getSql("SELECT value FROM app_configs WHERE key = 'global_dashboard_layout'");
        if (globalRow.length > 0 && globalRow[0].value) {
            try { globalLayout = JSON.parse(globalRow[0].value); } catch (e) { }
        }

        // Fetch User Prefs
        let userLayout = null;
        const userRow = await getSql("SELECT preferences FROM users WHERE username = ?", [username]);
        if (userRow.length > 0 && userRow[0].preferences) {
            try { userLayout = JSON.parse(userRow[0].preferences); } catch (e) { }
        }

        // Determine IDs
        if (userLayout && userLayout.widgetIds) {
            activeIds = userLayout.widgetIds;
        } else if (globalLayout && globalLayout.widgetIds) {
            activeIds = globalLayout.widgetIds;
        } else {
            // No Default: Return empty if no configuration exists
            return res.json([]);
        }

        // Map & Filter
        const displayedWidgets = activeIds
            .map(id => allWidgets.find(w => w.id === id))
            .filter(w => !!w);

        res.json(displayedWidgets);

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET: Widget Catalog (Safe Inventory for "Add Widget" Dropdown)
router.get('/widget-catalog', async (req, res) => {
    try {
        const rows = await getSql("SELECT id, title, type FROM widget_definitions");
        // Strictly return only metadata needed for selection
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET: Admin - List All Widgets (Full Details)
router.get('/admin/widgets', async (req, res) => {
    try {
        const rows = await getSql("SELECT * FROM widget_definitions");
        // Return raw rows (query_config as JSON string) for the Builder to parse/edit
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST: Stringify JSON fields
router.post(widgetRoute, (req, res) => {
    const { title, type, data_source_table, query_config, user_column } = req.body;
    const configStr = typeof query_config === 'object' ? JSON.stringify(query_config) : query_config;

    db.run(`INSERT INTO widget_definitions (title, type, data_source_table, query_config, user_column) 
            VALUES (?, ?, ?, ?, ?)`,
        [title, type, data_source_table, configStr, user_column],
        function (err) {
            if (err) res.status(500).json({ error: err.message });
            else res.json({ id: this.lastID, ...req.body });
        });
});

// PUT: Stringify JSON fields
router.put(`${widgetRoute}/:id`, (req, res) => {
    const id = req.params.id;
    const { title, type, data_source_table, query_config, user_column } = req.body;
    const configStr = typeof query_config === 'object' ? JSON.stringify(query_config) : query_config;

    db.run(`UPDATE widget_definitions SET title=?, type=?, data_source_table=?, query_config=?, user_column=? WHERE id=?`,
        [title, type, data_source_table, configStr, user_column, id],
        function (err) {
            if (err) res.status(500).json({ error: err.message });
            else res.json({ updated: this.changes });
        });
});

// DELETE: Standard
router.delete(`${widgetRoute}/:id`, (req, res) => {
    db.run(`DELETE FROM widget_definitions WHERE id = ?`, req.params.id, function (err) {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ deleted: this.changes });
    });
});

// Specialized Notification Routes (to handle Scheduler hooks)
const notifRoute = '/notification-rules';
router.get(notifRoute, (req, res) => {
    db.all("SELECT * FROM notification_rules", (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

router.post(notifRoute, (req, res) => {
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);
    const placeholders = keys.map(() => '?').join(',');
    const sql = `INSERT INTO notification_rules (${keys.join(',')}) VALUES (${placeholders})`;

    db.run(sql, values, function (err) {
        if (err) res.status(500).json({ error: err.message });
        else {
            const newRule = { id: this.lastID, ...req.body };
            // Register with Scheduler
            require('../services/notification.service').scheduleRule(newRule);
            res.json(newRule);
        }
    });
});

router.put(`${notifRoute}/:id`, (req, res) => {
    const id = parseInt(req.params.id);
    const keys = Object.keys(req.body).filter(k => k !== 'id');
    const values = keys.map(k => req.body[k]);
    values.push(id);
    const setClause = keys.map(k => `${k} = ?`).join(',');

    db.run(`UPDATE notification_rules SET ${setClause} WHERE id = ?`, values, function (err) {
        if (err) res.status(500).json({ error: err.message });
        else {
            const updatedRule = { id, ...req.body };
            // Update Scheduler
            require('../services/notification.service').scheduleRule(updatedRule);
            res.json({ updated: this.changes });
        }
    });
});

router.delete(`${notifRoute}/:id`, (req, res) => {
    const id = parseInt(req.params.id);
    db.run("DELETE FROM notification_rules WHERE id = ?", id, function (err) {
        if (err) res.status(500).json({ error: err.message });
        else {
            // Remove from Scheduler
            require('../services/notification.service').removeSchedule(id);
            res.json({ deleted: this.changes });
        }
    });
});

// --- Other Specialized Routes ---

// 0. Preview Data (Fetch & Return Schema/Sample)
router.post('/preview', async (req, res) => {
    try {
        const { source_id, fetch_query } = req.body;

        // Use service to fetch raw data (reuse logic)
        // We need to expose a "fetchRaw" method in syncService or duplicate logic.
        // For now, let's call a new method we'll add to syncService.
        const data = await syncService.previewData(source_id, fetch_query);

        // Limit to 5
        const sample = data.slice(0, 5);

        // Generate Auto-Mapping (Identity map) based on first row
        let mapping = {};
        if (sample.length > 0) {
            Object.keys(sample[0]).forEach(k => mapping[k] = k);
        }

        res.json({ sample, mapping });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const userService = require('../services/user.service');

// ... (Existing Routes)

// --- Auth & User Management ---

router.post('/auth/login', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: 'Username required' });
        const user = await userService.login(username);
        res.json(user);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// User Management
router.post('/users', (req, res) => {
    userService.createUser(req.body.username, req.body.role)
        .then(user => res.json(user))
        .catch(err => {
            if (err.message === 'User already exists') {
                res.status(409).json({ error: err.message });
            } else {
                res.status(500).json({ error: err.message });
            }
        });
});

router.get('/users', async (req, res) => {
    try {
        const users = await userService.getUsers();
        res.json(users);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update Role
router.put('/users/:username/role', async (req, res) => {
    try {
        const { role } = req.body;
        await userService.updateRole(req.params.username, role);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/users/:username', async (req, res) => {
    try {
        await userService.deleteUser(req.params.username);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Dashboard Preferences (Replaces old dashboard-layout) ---

router.get('/users/:username/preferences', async (req, res) => {
    try {
        const user = await userService.login(req.params.username); // Ensure user exists
        if (user.preferences) {
            res.json(JSON.parse(user.preferences));
        } else {
            res.json(null);
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/users/:username/preferences', async (req, res) => {
    try {
        const preferences = req.body;
        await userService.savePreferences(req.params.username, preferences);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 1. Manual Sync Trigger
router.post('/sync/:id', async (req, res) => {
    try {
        const id = req.params.id;
        // Trigger generic sync for this ID (async or await?)
        // We'll await it to give feedback
        await syncService.runSync(id);
        res.json({ status: 'Sync Completed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Deprecated Layout Routes (Replaced by User Preferences) ---
// Kept commented out for reference if needed, but logic moved to User Service.
/*
router.get('/dashboard-layout/:userId', ...);
router.post('/dashboard-layout/:userId', ...);
*/

// 2. Generic Data Query for Widgets
router.get('/data/:tableName', (req, res) => {
    const tableName = req.params.tableName;
    // Security: Validate tableName avoids SQL injection?
    // In a real app, check against allow-list or sync_definitions target_table_name

    // Simple protection: Ensure alphanumeric + underscore
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
        return res.status(400).json({ error: 'Invalid table name' });
    }

    db.all(`SELECT * FROM "${tableName}" LIMIT 1000`, (err, rows) => {
        if (err) {
            // Table might not exist yet if sync hasn't run
            res.status(404).json({ error: 'Table not found or empty' });
        }
        else res.json(rows);
    });
});

// 3. Smart Widget Data Endpoint (Optimized)
router.get('/widgets/:id/data', (req, res) => {
    const widgetId = req.params.id;
    const userId = req.query.userId;
    const limit = parseInt(req.query.limit) || 100;

    // 1. Get Widget Definition
    db.get("SELECT * FROM widget_definitions WHERE id = ?", [widgetId], (err, widget) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!widget) return res.status(404).json({ error: 'Widget not found' });

        const tableName = widget.data_source_table;
        const type = (widget.type || '').toLowerCase(); // Normalize to lowercase
        const config = JSON.parse(widget.query_config || '{}');
        const userColumn = widget.user_column; // e.g. 'userId' or 'owner'

        let query = "";
        let params = [];
        let whereClauses = [];

        // 1. Row Filtering (User ID)
        if (userId && userColumn) {
            whereClauses.push(`"${userColumn}" = ?`);
            params.push(userId);
        }

        // 2. Global Filter (with Date Regex)
        if (config.global_filter) {
            let gf = config.global_filter;
            // Date Regex: > -2d, -1m, -1y
            gf = gf.replace(/([><]=?|!=|=)\s*([+-]?\d+)([dmy])/g, (match, operator, num, unit) => {
                const map = { d: 'days', m: 'months', y: 'years' };
                return `${operator} datetime('now', '${num} ${map[unit]}', 'start of day')`;
            });
            whereClauses.push(`(${gf})`);
        }

        let whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : "";

        // Widget-Specific Logic
        if (type === 'card') {
            // OPTIMIZATION: Count only
            query = `SELECT COUNT(*) as count FROM "${tableName}" ${whereClause}`;
        } else if (type === 'table') {
            // OPTIMIZATION: Pagination
            query = `SELECT * FROM "${tableName}" ${whereClause} LIMIT ${limit}`;
        } else if (type === 'grid' || type === 'status_grid') {
            // OPTIMIZATION: Limited Columns? (For now SELECT *, but could filter)
            query = `SELECT * FROM "${tableName}" ${whereClause} LIMIT ${limit}`;
        } else if (type === 'multi_metric') {
            // Aggregation Query: SELECT count(*) as m0, avg(duration) as m1 ...
            const metrics = config.metrics || [];
            if (metrics.length === 0) {
                return res.json({ type: 'multi_metric', items: [] });
            }

            const selects = metrics.map((m, idx) => {
                let op = (m.operation || 'COUNT').toUpperCase();
                let col = m.column || '*';
                let cond = m.condition;

                // Safety
                if (!/^[a-zA-Z0-9_*]+$/.test(col)) col = '*';

                let target = col;

                if (cond && typeof cond === 'string' && cond.trim().length > 0) {
                    // 1. Date Shorthand: > -2d, -1m, -1y
                    cond = cond.replace(/([><]=?|!=|=)\s*([+-]?\d+)([dmy])/g, (match, operator, num, unit) => {
                        const map = { d: 'days', m: 'months', y: 'years' };
                        return `${operator} datetime('now', '${num} ${map[unit]}', 'start of day')`;
                    });

                    // 2. Wrap in CASE WHEN
                    if (op === 'COUNT') {
                        target = `CASE WHEN ${cond} THEN 1 ELSE NULL END`;
                    } else {
                        target = `CASE WHEN ${cond} THEN ${col} ELSE NULL END`;
                    }
                }

                return `${op}(${target}) as m${idx}`;
            });

            query = `SELECT ${selects.join(', ')} FROM "${tableName}" ${whereClause}`;
        } else {
            // Fallback
            query = `SELECT * FROM "${tableName}" ${whereClause} LIMIT ${limit}`;
        }

        // 3. Execute
        db.all(query, params, (qErr, rows) => {
            if (qErr) return res.status(500).json({ error: qErr.message });

            // 4. Transform Result
            if (type === 'card') {
                // Return simple count object
                res.json({
                    type: 'card',
                    count: rows[0].count,
                    label: widget.title
                });
            } else if (type === 'multi_metric') {
                const row = rows[0] || {};
                const items = (config.metrics || []).map((m, idx) => ({
                    label: m.label,
                    value: row[`m${idx}`] ?? 0,
                    operation: m.operation
                }));

                res.json({
                    type: 'multi_metric',
                    items: items
                });
            } else if (type === 'grid' || type === 'status_grid') {
                // Apply specific formatting for Grid (Label + Color)
                // This satisfies "API should process color, UI shouldn't parse config"
                const items = rows.map(row => {
                    let label = 'Unknown';
                    let status = '-';
                    let color = 'primary';

                    if (config.labelColumn) label = row[config.labelColumn] || label;
                    if (config.statusColumn) status = row[config.statusColumn];

                    if (config.rules && Array.isArray(config.rules) && config.statusColumn) {
                        // Find matching rule
                        const val = row[config.statusColumn];
                        // Weak equality to match "1" == 1
                        const rule = config.rules.find(r => r.value == val);
                        if (rule) color = rule.color;
                    }

                    return { label, status, color };
                });

                res.json({
                    type: type,
                    items: items,
                    limit: limit
                });
            } else {
                // Return items array
                res.json({
                    type: type,
                    items: rows,
                    limit: limit
                });
            }
        });
    });
});

// 4. Get Table Schema (Columns)
router.get('/schema/:tableName', (req, res) => {
    const tableName = req.params.tableName;

    // Simple protection
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
        return res.status(400).json({ error: 'Invalid table name' });
    }

    db.all(`PRAGMA table_info("${tableName}")`, (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else {
            // Return list of column names
            const columns = rows.map(r => r.name);
            res.json(columns);
        }
    });
});

// 4. Notifications Polling
router.get('/notifications', async (req, res) => {
    const user = req.query.user;
    const notifications = await require('../services/notification.service').getPendingNotifications(user);
    res.json(notifications);
});

module.exports = router;
