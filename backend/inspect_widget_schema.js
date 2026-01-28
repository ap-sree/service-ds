const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./app.db');

db.serialize(() => {
    db.all("PRAGMA table_info(widget_definitions)", [], (err, columns) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("Schema for widget_definitions:", columns.map(c => c.name + " (" + c.type + ")"));
    });
});

db.close();
