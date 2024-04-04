import { app, BrowserWindow, ipcMain } from "electron";
import { HaritoraXWireless } from "haritorax-interpreter";
import dgram from "dgram";
const sock = dgram.createSocket("udp4");

let mainWindow: BrowserWindow;
const device = new HaritoraXWireless(0);
let connectedDevices: Array<string> = [];

/*
 * Renderer
 */

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
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

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("version", app.getVersion());
  });
};

setInterval(() => {
  console.log("Connected devices: " + connectedDevices);
}, 1000);

/*
 * Renderer handlers
 */

// TODO: actually handle both connection types (for GX6 trackers and bluetooth elbows for example)
ipcMain.on("start-connection", (event, arg) => {
  console.log("Starting connection for " + arg);
  if (arg.includes("bluetooth")) {
    connectBluetooth();
  } else if (arg.includes("gx6")) {
    connectGX6();
  }
});

ipcMain.on("stop-connection", (event, arg) => {
  console.log("Stopping connection");
  if (arg.includes("bluetooth")) {
    device.stopConnection("bluetooth");
  }
  if (arg.includes("gx6")) {
    device.stopConnection("gx6");
  }
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
 * SlimeVR Forwarding
 */

let slimeIP = "0.0.0.0";
let slimePort = 6969;
let foundSlimeVR = false;
let packetCount = 0;

sock.on("message", (data, src) => {
  if (data.toString("utf-8").includes("Hey OVR =D")) {
    foundSlimeVR = true;
    slimeIP = src.address;
    slimePort = src.port;
    console.log("SlimeVR found at " + slimeIP + ":" + slimePort);
    packetCount += 1;
  }
});

let isHandlingTracker = false;

// Create a queue of tracker names
const trackerQueue: Array<string> = [];

async function handleNextTracker() {
  if (trackerQueue.length === 0 || isHandlingTracker) return;
  isHandlingTracker = true;
  const trackerName = trackerQueue.shift();

  if (connectedDevices.length == 0) {
    console.log("Adding IMU for device 0 // Handshake");

    const handshake = buildHandshake();
    sock.send(handshake, 0, handshake.length, slimePort, slimeIP, (err) => {
      if (err) {
        console.error("Error sending handshake:", err);
      } else {
        console.log("Handshake sent successfully");
        packetCount += 1;
      }
    });

    connectedDevices.push(trackerName);
    connectedDevices.sort();
  } else {
    if (connectedDevices.includes(trackerName)) return;
    console.log(`Adding IMU for device ${connectedDevices.length}`);
    await addIMU(connectedDevices.length);
    connectedDevices.push(trackerName);
    connectedDevices.sort();
  }

  isHandlingTracker = false;

  // Handle the next tracker name in the queue
  handleNextTracker();
}

function addIMU(trackerID: number) {
  return new Promise<void>((resolve, reject) => {
    const buffer = new ArrayBuffer(128);
    const view = new DataView(buffer);
    view.setInt32(0, 15); // packet 15 header
    view.setBigInt64(4, BigInt(packetCount)); // packet counter
    view.setInt8(12, trackerID); // tracker id (shown as IMU Tracker #x in SlimeVR)
    view.setInt8(13, 0); // sensor status
    view.setInt8(14, 0); // imu type
    const imuBuffer = new Uint8Array(buffer);

    sock.send(imuBuffer, slimePort, slimeIP, (err) => {
      if (err) {
        console.error("Error sending IMU packet:", err);
        reject();
      } else {
        console.log(`Add IMU: ${trackerID}`);
        packetCount += 1;
        resolve();
      }
    });
  });
}

/*
 * Interpreter event listeners
 */

device.on("connect", (trackerID: string) => {
  if (connectedDevices.includes(trackerID)) return;
  console.log(JSON.stringify(connectedDevices));
  trackerQueue.push(trackerID);
  handleNextTracker();
  console.log(`Connected to tracker: ${trackerID}`);
  mainWindow.webContents.send("connect", trackerID);
});

device.on("disconnect", (trackerID: string) => {
  if (!connectedDevices.includes(trackerID)) return;
  console.log(`Disconnected from tracker: ${trackerID}`);
  mainWindow.webContents.send("disconnect", trackerID);
  connectedDevices = connectedDevices.filter((name) => name !== trackerID);
});

device.on(
  "imu",
  (
    trackerName: string,
    rotation: Rotation,
    gravity: Acceleration,
    ankle: string
  ) => {
    if (!connectedDevices.includes(trackerName) || (!rotation || !gravity)) return;
    sendRotationPacket(rotation, connectedDevices.indexOf(trackerName));
    sendAccelPacket(gravity, connectedDevices.indexOf(trackerName));
    mainWindow.webContents.send("device-data", trackerName, rotation, gravity);
  }
);

device.on(
  "settings",
  (
    trackerName: string,
    sensorMode: number,
    fpsMode: number,
    sensorAutoCorrection: Array<string>,
    ankleMotionDetection: boolean
  ) => {
    console.log("Settings received from " + trackerName);
    console.log("Sensor mode: " + sensorMode);
    console.log("FPS mode: " + fpsMode);
    console.log("Sensor auto correction: " + sensorAutoCorrection);
    console.log("Ankle motion detection: " + ankleMotionDetection);
  }
);

device.on(
  "button",
  (
    trackerName: string,
    mainButton: number,
    subButton: number,
    isOn: boolean
  ) => {
    console.log("Button data received from " + trackerName);
    console.log("Main button: " + mainButton);
    console.log("Sub button: " + subButton);
    console.log("Is on: " + isOn);
  }
);

device.on(
  "battery",
  (
    trackerName: string,
    batteryRemaining: number,
    batteryVoltage: number,
    chargeStatus: string
  ) => {
    sendBatteryLevel(
      batteryRemaining,
      batteryVoltage,
      connectedDevices.indexOf(trackerName)
    );
  }
);

/*
 * Packet sending
 */

function sendAccelPacket(acceleration: Acceleration, trackerID: number) {
  packetCount += 1;
  const ax = acceleration["x"];
  const ay = acceleration["y"];
  const az = acceleration["z"];
  const buffer = buildAccelPacket(ax, ay, az, trackerID);

  sock.send(buffer, 0, buffer.length, slimePort, slimeIP, (err) => {
    if (err)
      console.error(`Error sending packet for sensor ${trackerID}:`, err);
  });
}

function sendRotationPacket(rotation: Rotation, trackerID: number) {
  packetCount += 1;
  const x = rotation["x"];
  const y = rotation["y"];
  const z = rotation["z"];
  const w = rotation["w"];
  const buffer = buildRotationPacket(x, y, z, w, trackerID);

  sock.send(buffer, 0, buffer.length, slimePort, slimeIP, (err) => {
    if (err)
      console.error(`Error sending packet for sensor ${trackerID}:`, err);
  });
}

// TODO: fix voltage, figure out how to send battery per tracker
function sendBatteryLevel(
  percentage: number,
  voltage: number,
  trackerID: number
) {
  const buffer = new ArrayBuffer(20);
  const view = new DataView(buffer);
  view.setInt32(0, 12);
  view.setBigInt64(4, BigInt(packetCount));
  view.setFloat32(12, voltage / 100); // 0.0v-whateverv
  view.setFloat32(16, percentage / 100); // 0.0-1.0
  const sendBuffer = new Uint8Array(buffer);
  sock.send(sendBuffer, 0, sendBuffer.length, slimePort, slimeIP, (err) => {
    if (err)
      console.error(`Error sending packet for sensor ${trackerID}:`, err);
  });
}

/*
 * Packet building
 */

function buildHandshake() {
  const fw_string = "Haritora";
  const buffer = new ArrayBuffer(128);
  const view = new DataView(buffer);
  let offset = 0;

  view.setInt32(offset, 3); // packet 3 header
  offset += 4;
  view.setBigInt64(offset, BigInt(packetCount)); // packet counter
  offset += 8;
  view.setInt32(offset, 0); // Board type
  offset += 4;
  view.setInt32(offset, 0); // IMU type
  offset += 4;
  view.setInt32(offset, 0); // MCU type
  offset += 4;
  for (let i = 0; i < 3; i++) {
    view.setInt32(offset, 0); // IMU info (unused)
    offset += 4;
  }
  view.setInt32(offset, 0); // Firmware build
  offset += 4;
  view.setInt8(offset, fw_string.length); // Length of fw string
  offset += 1;
  for (let i = 0; i < fw_string.length; i++) {
    view.setInt8(offset, fw_string.charCodeAt(i)); // fw string
    offset += 1;
  }
  const macAddress = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06];
  for (let i = 0; i < macAddress.length; i++) {
    view.setInt8(offset, macAddress[i]); // MAC address
    offset += 1;
  }

  return new Uint8Array(buffer);
}

function buildAccelPacket(
  ax: number,
  ay: number,
  az: number,
  trackerID: number
) {
  const buffer = new Uint8Array(128);
  const view = new DataView(buffer.buffer);

  view.setInt32(0, 4); // packet 4 header
  view.setBigInt64(4, BigInt(packetCount)); // packet counter
  view.setFloat32(12, ax);
  view.setFloat32(16, ay);
  view.setFloat32(20, az);
  view.setUint8(24, trackerID); // tracker id
  return buffer;
}

function buildRotationPacket(
  qx: number,
  qy: number,
  qz: number,
  qw: number,
  trackerID: number
) {
  const buffer = new Uint8Array(128);
  const view = new DataView(buffer.buffer);

  view.setInt32(0, 17);
  view.setBigInt64(4, BigInt(packetCount));
  view.setUint8(12, trackerID);
  view.setUint8(13, 1);

  view.setFloat32(14, qx);
  view.setFloat32(18, qy);
  view.setFloat32(22, qz);
  view.setFloat32(26, qw);

  view.setUint8(30, 0);

  return buffer;
}

/*
 * Interfaces
 */

interface Rotation {
  x: number;
  y: number;
  z: number;
  w: number;
}

interface Acceleration {
  x: number;
  y: number;
  z: number;
}

app.on("ready", createWindow);
