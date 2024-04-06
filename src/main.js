const { app, BrowserWindow, ipcMain } = require("electron");
const { HaritoraXWireless } = require("haritorax-interpreter");
const { SerialPort } = require("serialport");
const dgram = require("dgram");
const Quaternion = require("quaternion");
const fs = require("fs");
const path = require("path");
const sock = dgram.createSocket("udp4");

let mainWindow;
const device = new HaritoraXWireless(1);
let connectedDevices = [];

const mainPath = app.isPackaged ? path.dirname(app.getPath("exe")) : __dirname;

const configPath = path.resolve(mainPath, "config.json");

/*
 * Renderer
 */

const createWindow = () => {
    mainWindow = new BrowserWindow({
        autoHideMenuBar: true,
        width: 800,
        height: 600,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
        icon: path.join(__dirname, "icon.png"),
    });

    mainWindow.loadURL(path.join(__dirname, "index.html"));

    mainWindow.webContents.on("did-finish-load", () => {
        mainWindow.webContents.send("version", app.getVersion());
    });
};

/*
 * Renderer handlers
 */

ipcMain.on("start-connection", (event, arg) => {
    console.log(arg);
    console.log(JSON.stringify(arg));
    const { type, ports } = arg;
    console.log("Starting connection for " + type);
    if (type.includes("bluetooth")) {
        connectBluetooth();
    } else if (type.includes("gx") && ports) {
        connectGX(ports);
    }
});

ipcMain.on("stop-connection", (event, arg) => {
    console.log("Stopping connection for " + arg);
    if (arg.includes("bluetooth")) {
        device.stopConnection("bluetooth");
    }
    if (arg.includes("gx")) {
        device.stopConnection("gx");
    }

    connectedDevices = [];
});

ipcMain.handle("get-com-ports", async () => {
    const ports = await SerialPort.list();
    return ports.map((port) => port.path).sort();
});

ipcMain.handle("get-tracker-settings", (event, arg) => {
    return device.getTrackerSettings(arg);
});

ipcMain.handle("get-active-trackers", () => {
    return connectedDevices;
});

ipcMain.on("set-tracker-settings", (event, arg) => {
    const { deviceID, sensorMode, fpsMode, sensorAutoCorrection } = arg;
    if (!sensorMode || !fpsMode || !sensorAutoCorrection) {
        console.error("Invalid settings received: ", arg);
        return;
    }

    console.log("Setting tracker settings for " + deviceID + " to:", arg);
    console.log("Old tracker settings: ", device.getTrackerSettings(deviceID));
    device.setTrackerSettings(deviceID, sensorMode, fpsMode, sensorAutoCorrection, false);
    console.log("New tracker settings: ", device.getTrackerSettings(deviceID));
});

async function connectBluetooth() {
    console.log("Connecting via Bluetooth");
    device.startConnection("bluetooth");
}

async function connectGX(ports) {
    console.log("Connecting via gx");
    device.startConnection("gx", ports);
}

/*
 * Config handlers
 */

ipcMain.handle("get-settings", () => {
    if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath);
        return JSON.parse(data.toString());
    } else {
        fs.writeFileSync(configPath, "{}");
        return {};
    }
});

ipcMain.on("save-setting", (event, data) => {
    const config = JSON.parse(fs.readFileSync(configPath).toString());

    // Iterate over each property in the data object
    for (const key in data) {
        const value = data[key];
        config[key] = value;
        console.log(`Saved setting ${key} with value ${value}`);
    }

    fs.writeFileSync(configPath, JSON.stringify(config));
});

ipcMain.handle("has-setting", (event, name) => {
    const config = JSON.parse(fs.readFileSync(configPath).toString());
    return Object.prototype.hasOwnProperty.call(config, name);
});

/*
 * SlimeVR Forwarding
 */

let slimeIP = "0.0.0.0";
let slimePort = 6969;
let packetCount = 0;

sock.on("message", (data, src) => {
    if (data.toString("utf-8").includes("Hey OVR =D")) {
        slimeIP = src.address;
        slimePort = src.port;
        console.log("SlimeVR found at " + slimeIP + ":" + slimePort);
        packetCount += 1;
    }
});

let isHandlingTracker = false;
const trackerQueue = [];

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
        packetCount += 1;
        console.log(`Adding IMU for device ${connectedDevices.length}`);
        await addIMU(connectedDevices.length);
        connectedDevices.push(trackerName);
        connectedDevices.sort();
    }

    isHandlingTracker = false;

    handleNextTracker();
}

function addIMU(deviceID) {
    return new Promise((resolve, reject) => {
        const buffer = new ArrayBuffer(128);
        const view = new DataView(buffer);
        view.setInt32(0, 15); // packet 15 header
        view.setBigInt64(4, BigInt(packetCount)); // packet counter
        view.setInt8(12, deviceID); // tracker id (shown as IMU Tracker #x in SlimeVR)
        view.setInt8(13, 0); // sensor status
        view.setInt8(14, 0); // imu type
        const imuBuffer = new Uint8Array(buffer);

        sock.send(imuBuffer, slimePort, slimeIP, (err) => {
            if (err) {
                console.error("Error sending IMU packet:", err);
                reject();
            } else {
                console.log(`Add IMU: ${deviceID}`);
                packetCount += 1;
                resolve();
            }
        });
    });
}

/*
 * Interpreter event listeners
 */

device.on("connect", (deviceID) => {
    if (connectedDevices.includes(deviceID)) return;
    console.log("Connected devices: " + JSON.stringify(connectedDevices));
    trackerQueue.push(deviceID);
    handleNextTracker();
    console.log(`Connected to tracker: ${deviceID}`);
    mainWindow.webContents.send("connect", deviceID);
});

device.on("disconnect", (deviceID) => {
    if (!connectedDevices.includes(deviceID)) return;
    console.log(`Disconnected from tracker: ${deviceID}`);
    mainWindow.webContents.send("disconnect", deviceID);
    connectedDevices = connectedDevices.filter((name) => name !== deviceID);
});

device.on("imu", (trackerName, rotation, gravity) => {
    if (!connectedDevices.includes(trackerName) || !rotation || !gravity) return;

    // Convert rotation to quaternion to euler angles in radians
    const quaternion = new Quaternion(
        rotation.w,
        rotation.x,
        rotation.y,
        rotation.z
    );
    const eulerRadians = quaternion.toEuler("XYZ");

    // Convert the Euler angles to degrees
    const eulerDegrees = {
        x: eulerRadians[0] * (180 / Math.PI),
        y: eulerRadians[1] * (180 / Math.PI),
        z: eulerRadians[2] * (180 / Math.PI),
    };

    sendRotationPacket(rotation, connectedDevices.indexOf(trackerName));
    sendAccelPacket(gravity, connectedDevices.indexOf(trackerName));

    mainWindow.webContents.send(
        "device-data",
        trackerName,
        eulerDegrees,
        gravity
    );
});

device.on("battery", (trackerName, batteryRemaining, batteryVoltage) => {
    sendBatteryLevel(
        batteryRemaining,
        batteryVoltage,
        connectedDevices.indexOf(trackerName)
    );
    mainWindow.webContents.send("battery-data", trackerName, batteryRemaining);
});

/*
 * Packet sending
 */

function sendAccelPacket(acceleration, deviceID) {
    packetCount += 1;
    const ax = acceleration["x"];
    const ay = acceleration["y"];
    const az = acceleration["z"];
    const buffer = buildAccelPacket(ax, ay, az, deviceID);

    sock.send(buffer, 0, buffer.length, slimePort, slimeIP, (err) => {
        if (err)
            console.error(`Error sending packet for sensor ${deviceID}:`, err);
    });
}

function sendRotationPacket(rotation, deviceID) {
    packetCount += 1;
    const x = rotation["x"];
    const y = rotation["y"];
    const z = rotation["z"];
    const w = rotation["w"];
    const buffer = buildRotationPacket(x, y, z, w, deviceID);

    sock.send(buffer, 0, buffer.length, slimePort, slimeIP, (err) => {
        if (err)
            console.error(`Error sending packet for sensor ${deviceID}:`, err);
    });
}

// TODO: fix voltage, figure out how to send battery per tracker
function sendBatteryLevel(percentage, voltage, deviceID) {
    const buffer = new ArrayBuffer(20);
    const view = new DataView(buffer);
    view.setInt32(0, 12);
    view.setBigInt64(4, BigInt(packetCount));
    view.setFloat32(12, voltage / 100); // 0.0v-whateverv
    view.setFloat32(16, percentage / 100); // 0.0-1.0
    const sendBuffer = new Uint8Array(buffer);
    sock.send(sendBuffer, 0, sendBuffer.length, slimePort, slimeIP, (err) => {
        if (err)
            console.error(`Error sending packet for sensor ${deviceID}:`, err);
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

function buildAccelPacket(ax, ay, az, deviceID) {
    const buffer = new Uint8Array(128);
    const view = new DataView(buffer.buffer);

    view.setInt32(0, 4); // packet 4 header
    view.setBigInt64(4, BigInt(packetCount)); // packet counter
    view.setFloat32(12, ax);
    view.setFloat32(16, ay);
    view.setFloat32(20, az);
    view.setUint8(24, deviceID); // tracker id
    return buffer;
}

function buildRotationPacket(qx, qy, qz, qw, deviceID) {
    const buffer = new Uint8Array(128);
    const view = new DataView(buffer.buffer);

    view.setInt32(0, 17);
    view.setBigInt64(4, BigInt(packetCount));
    view.setUint8(12, deviceID);
    view.setUint8(13, 1);

    view.setFloat32(14, qx);
    view.setFloat32(18, qy);
    view.setFloat32(22, qz);
    view.setFloat32(26, qw);

    view.setUint8(30, 0);

    return buffer;
}

app.on("ready", createWindow);
