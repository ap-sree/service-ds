const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
// const { fork } = require('child_process');

let mainWindow;
// let backendProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js') // We'll create this next
        }
    });

    // In DEV mode, load Angular from localhost:4200
    // In PROD mode, load from dist folder
    const isDev = !app.isPackaged; // Or based on env var

    if (isDev) {
        mainWindow.loadURL('http://localhost:4200');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../frontend/dist/frontend/browser/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    // IPC Listener for Notifications from Renderer
    ipcMain.on('show-notification', (event, { title, body }) => {
        if (Notification.isSupported()) {
            new Notification({ title, body }).show();
        } else {
            console.log("Notifications not supported on this OS");
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    // Cleanup if needed
});
