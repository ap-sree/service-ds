const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../app.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Adding title_template column to notification_rules...');
    db.run("ALTER TABLE notification_rules ADD COLUMN title_template TEXT", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Column already exists.');
            } else {
                console.error('Error adding column:', err);
            }
        } else {
            console.log('Column added successfully.');
        }
        process.exit(0); // Exit explicitly
    });
});
