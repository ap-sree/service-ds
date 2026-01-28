const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'app.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // 1. App Configs
        db.run(`CREATE TABLE IF NOT EXISTS app_configs (
            key TEXT PRIMARY KEY,
            value TEXT
        )`);

        // 2. Data Sources (SQL Server, APIs)
        db.run(`CREATE TABLE IF NOT EXISTS data_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('SQL_SERVER', 'REST_API', 'LOCAL_COMMAND')),
            config TEXT NOT NULL -- JSON: { connectionString, baseUrl, headers... }
        )`);

        // 3. Sync Definitions (How to fetch and where to store)
        db.run(`CREATE TABLE IF NOT EXISTS sync_definitions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id INTEGER NOT NULL,
            target_table_name TEXT NOT NULL,
            fetch_query TEXT NOT NULL, -- SQL Query or API Endpoint
            sync_mode TEXT NOT NULL CHECK(sync_mode IN ('MANUAL', 'SCHEDULED', 'INTERVAL')),
            schedule_config TEXT, -- Cron expression or Minutes
            field_mapping TEXT, -- JSON mapping remote->local
            last_run_at DATETIME,
            last_status TEXT,
            sync_strategy TEXT DEFAULT 'RELOAD', -- 'RELOAD' or 'APPEND'
            primary_key TEXT, -- Column name for upsert (required if APPEND)
            FOREIGN KEY(source_id) REFERENCES data_sources(id)
        )`);

        // Migration: Add sync_strategy and primary_key if not exists
        db.all("PRAGMA table_info(sync_definitions)", (err, rows) => {
            if (!err) {
                const hasStrat = rows.some(r => r.name === 'sync_strategy');
                if (!hasStrat) {
                    db.run("ALTER TABLE sync_definitions ADD COLUMN sync_strategy TEXT DEFAULT 'RELOAD'", (err) => {
                        if (err) console.error("Failed to add sync_strategy", err);
                    });
                }
                const hasPk = rows.some(r => r.name === 'primary_key');
                if (!hasPk) {
                    db.run("ALTER TABLE sync_definitions ADD COLUMN primary_key TEXT", (err) => {
                        if (err) console.error("Failed to add primary_key", err);
                    });
                }
            }
        });

        // 4. Widget Definitions (Visuals)
        db.run(`CREATE TABLE IF NOT EXISTS widget_definitions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('TABLE', 'CARD', 'STATUS_GRID', 'MULTI_METRIC', 'MARKDOWN')),
            data_source_table TEXT NOT NULL, -- Local Sync Table
            query_config TEXT, -- JSON: selected columns, filters, aggregations
            user_column TEXT -- Column to filter by logged-in user
        )`);

        // Migration: Add user_column if not exists
        db.all("PRAGMA table_info(widget_definitions)", (err, rows) => {
            if (!err) {
                const hasUserCol = rows.some(r => r.name === 'user_column');
                if (!hasUserCol) {
                    db.run("ALTER TABLE widget_definitions ADD COLUMN user_column TEXT", (err) => {
                        if (err) console.error("Failed to add user_column", err);
                        else console.log("Added user_column to widget_definitions");
                    });
                }
            }
        });

        // 5. User Dashboards (Layouts)
        db.run(`CREATE TABLE IF NOT EXISTS user_dashboards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT DEFAULT 'admin',
            layout_json TEXT -- JSON: List of widget IDs and positions
        )`);

        // Users Table (Mock Auth)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            role TEXT DEFAULT 'USER', -- 'ADMIN' or 'USER'
            preferences TEXT -- JSON for dashboard layout
        )`);

        // 6. Notification Rules
        db.run(`CREATE TABLE IF NOT EXISTS notification_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            local_table_name TEXT NOT NULL,
            condition_json TEXT NOT NULL, -- JSON: { field, operator, threshold }
            action_type TEXT NOT NULL CHECK(action_type IN ('TOAST', 'OS_NOTIFY')),
            message_template TEXT,
            schedule_type TEXT DEFAULT 'EVENT', -- 'EVENT', 'CRON', 'INTERVAL'
            schedule_config TEXT,
            user_column TEXT -- Column to group by for user-specific alerts
        )`);

        // Migration: Add user_column to notification_rules if not exists
        db.all("PRAGMA table_info(notification_rules)", (err, rows) => {
            if (!err) {
                const hasUserCol = rows.some(r => r.name === 'user_column');
                if (!hasUserCol) {
                    db.run("ALTER TABLE notification_rules ADD COLUMN user_column TEXT", (err) => {
                        if (err) console.error("Failed to add user_column to rules", err);
                        else console.log("Added user_column to notification_rules");
                    });
                }
            }
        });


        // Migration: Add target_role for role-based notifications
        db.all("PRAGMA table_info(notification_rules)", (err, rows) => {
            if (!err) {
                const hasCol = rows.some(r => r.name === 'target_role');
                if (!hasCol) {
                    db.run("ALTER TABLE notification_rules ADD COLUMN target_role TEXT", (err) => {
                        if (err) console.error("Failed to add target_role to rules", err);
                        else console.log("Added target_role to notification_rules");
                    });
                }
            }
        });

        console.log('Database tables initialized.');
    });
}

module.exports = db;
