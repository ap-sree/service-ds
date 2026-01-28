const db = require('./database');

db.serialize(() => {
    console.log('Seeding mock data...');

    // 1. Data Sources (Clear first to avoid duplicates in this dev script)
    db.run(`DELETE FROM data_sources WHERE name IN ('Mock System', 'Sample SQL Server')`);

    db.run(`INSERT INTO data_sources (name, type, config) VALUES ('Mock System', 'REST_API', '{"baseUrl":"http://localhost:3000/mock"}')`, (err) => {
        if (!err) console.log('Added Mock API Source');
    });

    db.run(`INSERT INTO data_sources (name, type, config) VALUES ('Sample SQL Server', 'SQL_SERVER', '{"server":"localhost","database":"master","user":"sa","password":"password"}')`, (err) => {
        if (!err) console.log('Added Sample SQL Source');
    });

    // 2. Sync Definition
    db.run(`DELETE FROM sync_definitions WHERE target_table_name = 'mock_tickets'`);
    db.run(`INSERT INTO sync_definitions (source_id, target_table_name, fetch_query, sync_mode, last_status, last_run_at)
            VALUES (1, 'mock_tickets', '/tickets', 'MANUAL', 'SUCCESS', CURRENT_TIMESTAMP)`, (err) => {
        if (!err) console.log('Added Sync Definition');
    });

    // 3. Create Mock Data Table (Simulating a synced table)
    db.run(`DROP TABLE IF EXISTS mock_tickets`);
    db.run(`CREATE TABLE mock_tickets (id INTEGER, title TEXT, status TEXT, priority TEXT)`);

    const stmt = db.prepare("INSERT INTO mock_tickets VALUES (?, ?, ?, ?)");
    stmt.run(101, 'Cannot login to portal', 'Open', 'High');
    stmt.run(102, 'Sync job failed usually', 'in_progress', 'Medium');
    stmt.run(103, 'UI typo in dashboard', 'Closed', 'Low');
    stmt.run(104, 'Server CPU high', 'Open', 'Critical');
    stmt.finalize();

    // 4. Widget Definitions
    db.run("DELETE FROM widget_definitions");
    // Card: Open Tickets Count
    db.run(`INSERT INTO widget_definitions (title, type, data_source_table, query_config)
            VALUES ('Open Tickets', 'CARD', 'mock_tickets', '{"field":"status", "aggregation":"COUNT", "filter":{"field":"status","operator":"=","value":"Open"}}')`, (err) => {
        if (!err) console.log('Added Card Widget');
    });

    // Table: All Tickets
    db.run(`INSERT INTO widget_definitions (title, type, data_source_table, query_config)
            VALUES ('Recent Tickets', 'TABLE', 'mock_tickets', '{"columns":["id","title","status","priority"]}')`, (err) => {
        if (!err) console.log('Added Table Widget');
    });

    // 5. Notification Rule
    db.run(`INSERT INTO notification_rules (local_table_name, condition_json, action_type, message_template)
            VALUES ('mock_tickets', '{"field":"priority","operator":"=","value":"Critical"}', 'TOAST', 'Critical Issue: {{value}} tickets found!')`, (err) => {
        if (!err) console.log('Added Notification Rule');
    });

    // --- NEW: Kubernetes Status ---
    db.run(`DROP TABLE IF EXISTS mock_k8s`);
    db.run(`CREATE TABLE mock_k8s (id INTEGER, cluster_name TEXT, status TEXT, node_count INTEGER)`);
    const stmtK8s = db.prepare("INSERT INTO mock_k8s VALUES (?, ?, ?, ?)");
    stmtK8s.run(1, 'production-us-east', 'Healthy', 50);
    stmtK8s.run(2, 'staging-eu-west', 'Degraded', 12);
    stmtK8s.run(3, 'dev-local', 'Healthy', 3);
    stmtK8s.finalize();

    // Widget: K8s Status Table
    db.run(`INSERT INTO widget_definitions (title, type, data_source_table, query_config)
            VALUES ('Kubernetes Clusters', 'TABLE', 'mock_k8s', '{"columns":["cluster_name","status","node_count"]}')`, (err) => {
        if (!err) console.log('Added K8s Widget');
    });

    // --- NEW: Server Status ---
    db.run(`DROP TABLE IF EXISTS mock_servers`);
    db.run(`CREATE TABLE mock_servers (id INTEGER, hostname TEXT, cpu_usage INTEGER, memory_usage INTEGER, status TEXT)`);
    const stmtServer = db.prepare("INSERT INTO mock_servers VALUES (?, ?, ?, ?, ?)");
    stmtServer.run(1, 'web-server-01', 45, 60, 'Online');
    stmtServer.run(2, 'db-server-01', 88, 75, 'Online');
    stmtServer.run(3, 'cache-server-01', 12, 30, 'Offline');
    stmtServer.finalize();

    // Widget: Server CPU Card
    db.run(`INSERT INTO widget_definitions (title, type, data_source_table, query_config)
            VALUES ('High CPU Servers', 'CARD', 'mock_servers', '{"field":"hostname", "aggregation":"COUNT", "filter":{"field":"cpu_usage","operator":">","value":80}}')`, (err) => {
        if (!err) console.log('Added Server CPU Widget');
    });

    // Widget: Server List Table
    db.run(`INSERT INTO widget_definitions (title, type, data_source_table, query_config)
        VALUES ('Server Health', 'TABLE', 'mock_servers', '{"columns":["hostname","cpu_usage","status"]}')`, (err) => {
        if (!err) console.log('Added Server Table Widget');
    });

    console.log('Seeding complete.');
});
