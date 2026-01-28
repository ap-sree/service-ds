const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
// const { app } = require('electron'); // Removed: Backend is standalone

const appExpress = express();
const PORT = process.env.PORT || 3000;

// Middleware
appExpress.use(cors());
appExpress.use(bodyParser.json());

// Routes
const apiRoutes = require('./routes/api.routes');
const syncService = require('./services/dynamic-sync.service');

appExpress.use('/api', apiRoutes);

appExpress.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0', timestamp: new Date() });
});

// Initialize Sync Scheduler
// Initialize Sync Scheduler (Wait for DB tables to be created)
setTimeout(() => {
    syncService.init();
}, 1000);

// Start Server
const server = appExpress.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
});

module.exports = appExpress;
