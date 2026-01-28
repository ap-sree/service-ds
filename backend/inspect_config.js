const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('app.db');

db.all("SELECT * FROM app_configs", (err, rows) => {
    if (err) console.error(err);
    else console.log(JSON.stringify(rows, null, 2));
});
