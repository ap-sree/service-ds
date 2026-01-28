const db = require('./backend/database');

db.serialize(() => {
    // 1. Create Table
    db.run("CREATE TABLE IF NOT EXISTS sample_servers (name TEXT, status TEXT, load INTEGER, version TEXT)");
    db.run("DELETE FROM sample_servers");
    const stmt = db.prepare("INSERT INTO sample_servers VALUES (?, ?, ?, ?)");
    stmt.run("Prod-DB-01", "Running", 45, "v2.1");
    stmt.run("Prod-API-01", "Running", 60, "v2.1");
    stmt.run("Dev-Worker", "Stopped", 0, "v2.2-beta");
    stmt.run("Stage-Web", "Error", 0, "v2.1");
    stmt.finalize();

    console.log("Table 'sample_servers' created and populated.");

    // 2. Create Dummy Source & Sync (so it appears in Admin)
    db.run(`INSERT INTO data_sources (name, type, config) VALUES ('Sample Data', 'LOCAL_COMMAND', '{}')`, function (err) {
        if (!err) {
            const sourceId = this.lastID;
            db.run(`INSERT INTO sync_definitions (source_id, target_table_name, fetch_query, sync_mode)
                    VALUES (?, 'sample_servers', 'echo sample', 'MANUAL')`, [sourceId], (err) => {
                if (!err) console.log("Sync Definition created.");
            });
        }
    });

    // 3. Create Widget
    const gridConfig = {
        labelColumn: 'name',
        statusColumn: 'status',
        rules: [
            { value: 'Running', color: 'success' },
            { value: 'Stopped', color: 'accent' },
            { value: 'Error', color: 'warn' }
        ]
    };

    db.run(`INSERT INTO widget_definitions (title, type, data_source_table, query_config)
            VALUES ('Server Status', 'STATUS_GRID', 'sample_servers', ?)`, [JSON.stringify(gridConfig)], (err) => {
        if (!err) console.log("Status Grid Widget created.");
        else console.error("Widget creation failed", err);
    });
});
