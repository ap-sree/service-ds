const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./app.db');

db.all("PRAGMA table_info(users)", [], (err, columns) => {
    if (err) console.error(err);
    else console.log("Users Schema:", columns);
    db.close();
});
