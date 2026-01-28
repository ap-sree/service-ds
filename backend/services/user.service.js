const db = require('../database');

class UserService {

    /**
     * Finds or creates a user. Returns the user object.
     * @param {string} username 
     */
    login(username) {
        return new Promise((resolve, reject) => {
            db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
                if (err) return reject(err);

                if (row) {
                    // Use username as ID per user request ("username and user id are same")
                    resolve({ ...row, id: row.username });
                } else {
                    // Create new user
                    const role = (username.toLowerCase() === 'admin') ? 'ADMIN' : 'USER';
                    db.run("INSERT INTO users (username, role) VALUES (?, ?)", [username, role], function (err) {
                        if (err) return reject(err);
                        resolve({ id: username, username, role, preferences: null });
                    });
                }
            });
        });
    }

    createUser(username, role = 'USER') {
        return new Promise((resolve, reject) => {
            db.run("INSERT INTO users (username, role) VALUES (?, ?)", [username, role], function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return reject(new Error('User already exists'));
                    }
                    return reject(err);
                }
                resolve({ id: username, username, role, preferences: null });
            });
        });
    }

    getUsers() {
        return new Promise((resolve, reject) => {
            db.all("SELECT username, role FROM users", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    updateRole(username, role) {
        return new Promise((resolve, reject) => {
            db.run("UPDATE users SET role = ? WHERE username = ?", [role, username], function (err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    }

    deleteUser(username) {
        return new Promise((resolve, reject) => {
            db.run("DELETE FROM users WHERE username = ?", [username], function (err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    }

    savePreferences(username, preferences) {
        const prefString = JSON.stringify(preferences);
        return new Promise((resolve, reject) => {
            db.run("UPDATE users SET preferences = ? WHERE username = ?", [prefString, username], function (err) {
                if (err) reject(err);
                else resolve({ changes: this.changes });
            });
        });
    }
}

module.exports = new UserService();
