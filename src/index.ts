import { app, BrowserWindow, ipcMain } from 'electron';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    height: 600,
    width: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

ipcMain.on('start-connection', (event, arg) => {
  console.log('Starting connection');
});

ipcMain.on('stop-connection', (event, arg) => {
  console.log('Stopping connection');
});

async function connectBluetooth() {
  console.log("Connecting via Bluetooth");
}

async function connectGX6() {
  console.log("Connecting via GX6");
}

app.on('ready', createWindow);