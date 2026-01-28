const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./app.db');

const TARGET_COUNT = 10000;

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

db.serialize(() => {
    console.log("Starting bulk seed...");

    // 1. mock_tickets
    db.run("BEGIN TRANSACTION");
    const stmtTickets = db.prepare("INSERT INTO mock_tickets (title, status, priority) VALUES (?, ?, ?)");
    for (let i = 0; i < TARGET_COUNT; i++) {
        stmtTickets.run(
            `Bulk Ticket ${i}`,
            getRandomItem(['Open', 'In Progress', 'Closed', 'Resolved']),
            getRandomItem(['Low', 'Medium', 'High', 'Critical'])
        );
    }
    stmtTickets.finalize();
    console.log(`Inserted ${TARGET_COUNT} into mock_tickets`);

    // 2. sync_todos
    const stmtTodos = db.prepare("INSERT INTO sync_todos (_synced_at, userId, id, title, body) VALUES (?, ?, ?, ?, ?)");
    const now = new Date().toISOString();
    for (let i = 0; i < TARGET_COUNT; i++) {
        stmtTodos.run(
            now,
            getRandomItem(['test', 'admin', 'user1', 'manager']), // Alphanumeric IDs
            i + 1000, // Offset to avoid ID collision if any
            `Bulk Todo ${i}`,
            `This is a body for todo ${i}`
        );
    }
    stmtTodos.finalize();
    console.log(`Inserted ${TARGET_COUNT} into sync_todos`);

    // 3. sync_cmd
    const stmtCmd = db.prepare("INSERT INTO sync_cmd (_synced_at, Name, DisplayName) VALUES (?, ?, ?)");
    for (let i = 0; i < TARGET_COUNT; i++) {
        stmtCmd.run(
            now,
            `Service_${i}`,
            `Display Service Name ${i}`
        );
    }
    stmtCmd.finalize();
    console.log(`Inserted ${TARGET_COUNT} into sync_cmd`);

    db.run("COMMIT", (err) => {
        if (err) console.error("Error committing:", err);
        else console.log("Seeding Complete!");
        db.close();
    });
});
