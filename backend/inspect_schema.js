const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./app.db');

db.serialize(() => {
    ['mock_tickets', 'sync_todos', 'sync_cmd'].forEach(table => {
        db.all(`PRAGMA table_info(${table})`, [], (err, columns) => {
            if (err) {
                console.error(err);
                return;
            }
            console.log(`Schema for ${table}:`, columns.map(c => c.name + " (" + c.type + ")"));
        });
    });
});

db.close();
