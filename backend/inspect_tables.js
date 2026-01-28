const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./app.db');

db.serialize(() => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log("Tables found:", tables.map(t => t.name));
    });
});

db.close();
