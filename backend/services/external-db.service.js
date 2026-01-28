const sql = require('mssql');

class ExternalDbService {
    constructor() {
        this.pools = new Map(); // Cache connection pools by config key
    }

    /**
     * Connects to a SQL Server database based on configuration.
     * @param {object} config - Not the full JSON, but the parsed config object.
     * @returns {Promise<sql.ConnectionPool>}
     */
    async getConnection(config) {
        // Generate a unique key for caching based on connection string details
        const key = JSON.stringify(config);

        if (this.pools.has(key)) {
            const pool = this.pools.get(key);
            if (pool.connected) {
                return pool;
            }
            // If existing pool is closed/broken, remove it
            this.pools.delete(key);
        }

        try {
            const pool = await new sql.ConnectionPool(config).connect();
            this.pools.set(key, pool);

            pool.on('error', err => {
                console.error('SQL Pool Error:', err);
                this.pools.delete(key);
            });

            return pool;
        } catch (err) {
            console.error('Failed to connect to SQL Server:', err);
            throw err;
        }
    }

    /**
     * Executes a query against a specific configuration.
     * @param {object} config - SQL Connection configuration.
     * @param {string} query - The SELECT query to execute.
     * @returns {Promise<any[]>} - Array of recordsets.
     */
    async executeQuery(config, query) {
        const pool = await this.getConnection(config);
        const result = await pool.request().query(query);
        return result.recordset; // Start with single recordset support
    }
}

module.exports = new ExternalDbService();
