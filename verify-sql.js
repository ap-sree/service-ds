const sql = require('mssql');

async function testConnection() {
    const config = {
        user: process.env.DB_USER || 'sa',
        password: process.env.DB_PASSWORD || 'yourStrong(!)Password',
        server: process.env.DB_SERVER || 'localhost',
        database: process.env.DB_NAME || 'master',
        options: {
            encrypt: false, // Use true for Azure
            trustServerCertificate: true // Change to true for local dev / self-signed certs
        }
    };

    try {
        console.log(`Connecting to ${config.server}...`);
        await sql.connect(config);
        console.log('Connected!');

        const result = await sql.query`SELECT 1 as val`;
        console.dir(result);

        await sql.close();
        console.log('Connection closed.');
    } catch (err) {
        console.error('Connection Failed:', err);
    }
}

testConnection();
