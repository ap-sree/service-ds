const db = require('../database');

class NotificationService {
    constructor() {
        this.pendingNotifications = [];
        this.tasks = new Map(); // Store scheduled tasks: rule_id -> task

        // Initialize scheduler on load
        this.init();
    }

    init() {
        console.log('Initializing Notification Scheduler...');
        db.all("SELECT * FROM notification_rules", (err, rules) => {
            if (err || !rules) return;
            rules.forEach(rule => this.scheduleRule(rule));
        });
    }

    scheduleRule(rule) {
        // Clear existing task
        if (this.tasks.has(rule.id)) {
            const task = this.tasks.get(rule.id);
            if (task.stop) task.stop();
            else if (task.destroy) task.destroy(); // cron
            this.tasks.delete(rule.id);
        }

        if (!rule.schedule_type || rule.schedule_type === 'EVENT') return;

        console.log(`Scheduling Rule ${rule.id} (${rule.schedule_type}): ${rule.schedule_config}`);

        try {
            if (rule.schedule_type === 'CRON') {
                // Require node-cron only if needed
                const cron = require('node-cron');
                const task = cron.schedule(rule.schedule_config, () => {
                    this._evaluateRule(rule);
                });
                this.tasks.set(rule.id, task);

            }
        } catch (e) {
            console.error(`Failed to schedule rule ${rule.id}`, e);
        }
    }

    removeSchedule(id) {
        if (this.tasks.has(id)) {
            const task = this.tasks.get(id);
            if (task.stop) task.stop();
            else if (task.destroy) task.destroy();
            this.tasks.delete(id);
        }
    }

    /**
     * Checks all rules associated with a specific table (Event-based).
     * @param {string} tableName 
     */
    checkRules(tableName) {
        db.all("SELECT * FROM notification_rules WHERE local_table_name = ? AND schedule_type = 'EVENT'", [tableName], (err, rules) => {
            if (err || !rules) return;
            rules.forEach(rule => this._evaluateRule(rule));
        });
    }

    _evaluateRule(rule) {
        try {
            const condition = JSON.parse(rule.condition_json);
            let query = '';
            let params = [];

            // Compatibility: Check for old format (field/operator/value)
            if (condition.field && !condition.operation) {
                // Legacy Migration Logic (InMemory)
                condition.operation = condition.field === 'count' ? 'COUNT' : 'COUNT';
                condition.threshold_operator = condition.operator || '>';
                condition.threshold_value = condition.value || 0;

                if (condition.field !== 'count') {
                    // Legacy "Field=Val" meant "Count rows where Field=Val"
                    condition.condition = `"${condition.field}" = '${condition.value}'`; // Simplified assumption
                    // Actually, legacy had operator field. So: "Field > Val"
                    condition.condition = `"${condition.field}" ${condition.operator} '${condition.value}'`;
                    condition.threshold_operator = '>';
                    condition.threshold_value = 0; // Trigger if ANY match
                } else {
                    condition.condition = "";
                }
                condition.column = '*';
            }



            // Build Base Query Parts
            const op = (condition.operation || 'COUNT').toUpperCase();
            let col = condition.column || '*';
            // Safety
            if (!/^[a-zA-Z0-9_*]+$/.test(col)) col = '*';

            const table = `"${rule.local_table_name}"`;
            const filter = condition.condition ? `WHERE ${condition.condition}` : '';

            // If user grouping is enabled
            if (rule.user_column) {
                // Group by User
                // Query: SELECT user_col as user, {OP}({COL}) as val FROM table WHERE ... GROUP BY user_col

                // Merge filters if needed (if filter already has WHERE, we can't add another)
                // Actually filter variable above has 'WHERE ' prefix if not empty.

                query = `SELECT "${rule.user_column}" as user, ${op}(${col}) as val 
                         FROM ${table} 
                         ${filter} 
                         GROUP BY "${rule.user_column}"`;

                db.all(query, params, (err, rows) => {
                    if (err) return console.error('Rule Eval Error (User Group):', err);
                    if (!rows) return;

                    rows.forEach(row => {
                        if (this._checkThreshold(row.val, condition.threshold_operator, condition.threshold_value)) {
                            this._queueNotification(rule, row.val, row.user);
                        }
                    });
                });

            } else {
                // Global Rule
                query = `SELECT ${op}(${col}) as val FROM ${table} ${filter}`;

                db.get(query, params, (err, row) => {
                    if (err) return console.error('Rule Eval Error:', err);
                    if (!row) return;

                    const val = row.val;
                    if (this._checkThreshold(val, condition.threshold_operator, condition.threshold_value)) {
                        this._queueNotification(rule, val);
                    }
                });
            }
        } catch (e) {
            console.error('Error evaluating rule:', e);
        }
    }

    _queueNotification(rule, value, targetUser = null) {
        const safeValue = value !== undefined ? value : 'N/A';
        const message = rule.message_template
            ? rule.message_template.replace('{{value}}', safeValue)
            : `Alert: Rule for ${rule.local_table_name} triggered. Value: ${safeValue}`;

        // Push to in-memory queue for Frontend to pick up
        this.pendingNotifications.push({
            id: Date.now() + Math.random(), // simple unique id
            title: rule.title_template || 'Service Alert',
            body: message,
            action_type: rule.action_type,
            targetUser: targetUser, // specific user or null for all
            targetRole: rule.target_role, // Role based targeting
            timestamp: new Date()
        });

        console.log(`Notification Queued (User: ${targetUser || 'ALL'}, Role: ${rule.target_role || 'ALL'}):`, message);
    }

    _checkThreshold(actual, op, target) {
        // Loose comparison for numbers/strings
        // Explicitly convert if possible
        const nActual = Number(actual);
        const nTarget = Number(target);
        const isNum = !isNaN(nActual) && !isNaN(nTarget);

        const a = isNum ? nActual : actual;
        const b = isNum ? nTarget : target;

        switch (op) {
            case '>': return a > b;
            case '<': return a < b;
            case '=': return a == b; // weak equality
            case '!=': return a != b;
            case '>=': return a >= b;
            case '<=': return a <= b;
            default: return false;
        }
    }


    async getPendingNotifications(username = null) {
        // Filter notifications for this user OR global ones (null)
        // Also remove them from queue once fetched (simple ack behavior)

        let userRole = null;
        if (username) {
            try {
                // Promisify DB call
                userRole = await new Promise((resolve) => {
                    db.get("SELECT role FROM users WHERE username = ?", [username], (err, row) => {
                        resolve(row ? row.role : null);
                    });
                });
            } catch (e) {
                console.error('Error fetching user role for notifications', e);
            }
        }

        const toReturn = [];
        const remaining = [];

        this.pendingNotifications.forEach(n => {
            let isMatch = false;

            // 1. Target User
            if (n.targetUser) {
                if (n.targetUser === username) isMatch = true;
            }
            // 2. Target Role
            else if (n.targetRole) {
                if (userRole && n.targetRole === userRole) isMatch = true;
            }
            // 3. Global
            else {
                isMatch = true;
            }

            if (isMatch) {
                toReturn.push(n);
            } else {
                remaining.push(n);
            }
        });

        this.pendingNotifications = remaining;
        return toReturn;
    }
}

module.exports = new NotificationService();
