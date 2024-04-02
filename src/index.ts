import { app, BrowserWindow, ipcMain } from 'electron';
import { HaritoraXWireless } from 'haritorax-interpreter';

const device = new HaritoraXWireless();

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

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('version', app.getVersion());
  });
};

// TODO: actually handle both connection types (for GX6 trackers and bluetooth elbows for example)
ipcMain.on('start-connection', (event, arg) => {
  console.log('Starting connection for ' + arg);
  if (arg.includes('bluetooth')) {
    connectBluetooth();
  } else if (arg.includes('gx6')) {
    connectGX6();
  }
});

ipcMain.on('stop-connection', (event, arg) => {
  console.log('Stopping connection');
});

async function connectBluetooth() {
  console.log("Connecting via Bluetooth");
  device.startConnection("bluetooth");
}

async function connectGX6() {
  console.log("Connecting via GX6");
  device.startConnection("gx6", ["COM4", "COM5", "COM6"]);
}

/*
 * Interpreter event listeners
*/

device.on('imu', (trackerName: string, rotation: object, gravity: object, ankle: string) => {
  console.log('IMU data received from ' + trackerName);
  console.log('Rotation: ' + JSON.stringify(rotation));
  console.log('Gravity: ' + JSON.stringify(gravity));
  console.log('Ankle: ' + ankle);
});

device.on('tracker', (trackerName: string, data: string) => {
  console.log('Tracker data received from ' + trackerName);
  console.log('Data: ' + data);
});

device.on('settings', (trackerName: string, sensorMode: number, fpsMode: number, sensorAutoCorrection: Array<string>, ankleMotionDetection: boolean) => {
  console.log('Settings received from ' + trackerName);
  console.log('Sensor mode: ' + sensorMode);
  console.log('FPS mode: ' + fpsMode);
  console.log('Sensor auto correction: ' + sensorAutoCorrection);
  console.log('Ankle motion detection: ' + ankleMotionDetection);
});

device.on('button', (trackerName: string, mainButton: number, subButton: number, isOn: boolean) => {
  console.log('Button data received from ' + trackerName);
  console.log('Main button: ' + mainButton);
  console.log('Sub button: ' + subButton);
  console.log('Is on: ' + isOn);
});

device.on('battery', (trackerName: string, batteryRemaining: number, batteryVoltage: number, chargeStatus: string) => {
  console.log('Battery data received from ' + trackerName);
  console.log('Battery remaining: ' + batteryRemaining);
  console.log('Battery voltage: ' + batteryVoltage);
  console.log('Charge status: ' + chargeStatus);
});

device.on('info', (name: string, version: string, model: string, serial: string) => {
  console.log('Info received from ' + name);
  console.log('Version: ' + version);
  console.log('Model: ' + model);
  console.log('Serial: ' + serial);
});

device.on('connect', (trackerName: string) => {
  console.log('Connected to ' + trackerName);
});

device.on('disconnect', (trackerName: string) => {
  console.log('Disconnected from ' + trackerName);
});

app.on('ready', createWindow);