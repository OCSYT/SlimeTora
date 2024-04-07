import { app, BrowserWindow, ipcMain, shell } from "electron";
import { HaritoraXWireless } from "haritorax-interpreter";
import { SerialPort } from "serialport";
import * as dgram from "dgram";
import Quaternion from "quaternion";
import * as fs from "fs";
import * as path from "path";

const sock = dgram.createSocket("udp4");

// TODO: investigate data being sent to SlimeVR server sometimes going from 100fps to 50 fps and vice versa, unknown what's causing it

const {
    BoardType,
    MCUType,
    RotationDataType,
    SensorType,
    SensorStatus,
    ServerBoundAccelPacket,
    ServerBoundBatteryLevelPacket,
    ServerBoundHandshakePacket,
    ServerBoundRotationDataPacket,
    ServerBoundSensorInfoPacket,
} = require("@slimevr/firmware-protocol");

let mainWindow: BrowserWindow | null = null;
const device = new HaritoraXWireless(0);
let connectedDevices: string[] = [];
let canLogToFile = false;
let foundSlimeVR = false;
let lowestBatteryData = { percentage: 100, voltage: 0 };

const mainPath = app.isPackaged ? path.dirname(app.getPath("exe")) : __dirname;
const configPath = path.resolve(mainPath, "config.json");

/*
 * Renderer
 */

const createWindow = () => {
    // check if logToFile is set in the config before creating the window
    if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath);
        const config = JSON.parse(data.toString());
        if (Object.prototype.hasOwnProperty.call(config, "canLogToFile")) {
            canLogToFile = config.canLogToFile;
        }
    }

    mainWindow = new BrowserWindow({
        autoHideMenuBar: true,
        width: 800,
        height: 600,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
        icon: path.join(__dirname, "icon.ico"),
    });

    mainWindow.loadURL(path.join(__dirname, "index.html"));

    mainWindow.webContents.on("did-finish-load", () => {
        mainWindow.webContents.send("version", app.getVersion());
    });
};

/*
 * Renderer handlers
 */

ipcMain.on("log", (event, arg) => {
    log(arg, "renderer");
});

ipcMain.on("error", (event, arg) => {
    error(arg, "renderer");
});

ipcMain.on("start-connection", (event, arg) => {
    log(`Start connection with: ${JSON.stringify(arg)}`);
    const { type, ports } = arg;
    if (type.includes("bluetooth")) {
        connectBluetooth();
    } else if (type.includes("gx") && ports) {
        connectGX(ports);
    }
});

ipcMain.on("stop-connection", (event, arg) => {
    log(`Stop connection with: ${JSON.stringify(arg)}`);
    if (arg.includes("bluetooth")) {
        device.stopConnection("bluetooth");
    } else if (arg.includes("gx")) {
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

ipcMain.handle("is-slimevr-connected", () => {
    return foundSlimeVR;
});

ipcMain.on("set-tracker-settings", (event, arg) => {
    const { deviceID, sensorMode, fpsMode, sensorAutoCorrection } = arg;
    if (!sensorMode || !fpsMode || !sensorAutoCorrection) {
        error(`Invalid settings received: ${arg}`);
        return;
    }

    log(`Setting tracker settings for ${deviceID} to: ${JSON.stringify(arg)}`);
    log(
        `Old tracker settings: ${JSON.stringify(
            device.getTrackerSettings(deviceID)
        )}`
    );
    device.setTrackerSettings(
        deviceID,
        sensorMode,
        fpsMode,
        sensorAutoCorrection,
        false
    );
    log(
        `New tracker settings: ${JSON.stringify(
            device.getTrackerSettings(deviceID)
        )}`
    );
});

ipcMain.on("set-logging", (event, arg) => {
    canLogToFile = arg;
    log(`Logging to file set to: ${arg}`);
});

ipcMain.on("open-logs-folder", () => {
    const logDir = path.resolve(mainPath, "logs");
    if (fs.existsSync(logDir)) {
        shell.openPath(logDir);
    }
});

async function connectBluetooth() {
    log("Connecting via bluetooth");
    device.startConnection("bluetooth");
}

async function connectGX(ports: string[]) {
    log(`Connecting via GX dongles with ports: ${ports}`);
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
        log(`Saved setting ${key} with value ${value}`);
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
});

ipcMain.handle("has-setting", (event, name) => {
    const config = JSON.parse(fs.readFileSync(configPath).toString());
    return Object.prototype.hasOwnProperty.call(config, name);
});

/*
 * Interpreter event listeners
 */

device.on("connect", (deviceID: string) => {
    if (connectedDevices.includes(deviceID)) return;
    trackerQueue.push(deviceID);
    handleNextTracker();
    log(`Connected to tracker: ${deviceID}`);
    mainWindow.webContents.send("connect", deviceID);
    log("Connected devices: " + JSON.stringify(connectedDevices));
});

device.on("disconnect", (deviceID: string) => {
    if (!connectedDevices.includes(deviceID)) return;
    log(`Disconnected from tracker: ${deviceID}`);
    mainWindow.webContents.send("disconnect", deviceID);
    connectedDevices = connectedDevices.filter((name) => name !== deviceID);
    log("Connected devices: " + JSON.stringify(connectedDevices));
});

device.on(
    "imu",
    (trackerName: string, rawRotation: Rotation, rawGravity: Gravity) => {
        if (!connectedDevices.includes(trackerName) || !rawRotation || !rawGravity)
            return;

        // Convert rotation to quaternion to euler angles in radians
        const quaternion = new Quaternion(
            rawRotation.w,
            rawRotation.x,
            rawRotation.y,
            rawRotation.z
        );
        const eulerRadians = quaternion.toEuler("XYZ");

        // Convert the Euler angles to degrees
        const rotation = {
            x: eulerRadians[0] * (180 / Math.PI),
            y: eulerRadians[1] * (180 / Math.PI),
            z: eulerRadians[2] * (180 / Math.PI),
        };

        const gravity = {
            x: rawGravity.x,
            y: rawGravity.y,
            z: rawGravity.z,
        };

        sendRotationPacket(rawRotation, connectedDevices.indexOf(trackerName));
        sendAccelPacket(rawGravity, connectedDevices.indexOf(trackerName));

        mainWindow.webContents.send("device-data", {
            trackerName,
            rotation,
            gravity,
        });
    }
);

device.on(
    "battery",
    (trackerName: string, batteryRemaining: number, batteryVoltage: number) => {
        sendBatteryLevel(
            batteryRemaining,
            batteryVoltage,
            connectedDevices.indexOf(trackerName)
        );
        mainWindow.webContents.send(
            "battery-data",
            trackerName,
            batteryRemaining
        );
        log(
            `Received battery data for ${trackerName}: ${batteryRemaining}% (${
                batteryVoltage / 1000
            }V)`
        );
    }
);

function log(msg: string, where = "main") {
    if (canLogToFile) {
        const date = new Date();
        const logDir = path.resolve(mainPath, "logs");
        const logPath = path.join(
            logDir,
            `log-${date.getFullYear()}${("0" + (date.getMonth() + 1)).slice(
                -2
            )}${("0" + date.getDate()).slice(-2)}.txt`
        );

        // Create the directory if it doesn't exist
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        // Create the file if it doesn't exist
        if (!fs.existsSync(logPath)) {
            fs.writeFileSync(logPath, "");
        }

        fs.appendFileSync(
            logPath,
            `${date.toTimeString()} -- INFO -- (${where}): ${msg}\n`
        );
    }
    console.log(msg);
}

function error(msg: string, where = "main") {
    if (canLogToFile) {
        const date = new Date();
        const logDir = path.resolve(mainPath, "logs");
        const logPath = path.join(
            logDir,
            `log-${date.getFullYear()}${("0" + (date.getMonth() + 1)).slice(
                -2
            )}${("0" + date.getDate()).slice(-2)}.txt`
        );

        // Create the directory if it doesn't exist
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        // Create the file if it doesn't exist
        if (!fs.existsSync(logPath)) {
            fs.writeFileSync(logPath, "");
        }

        fs.appendFileSync(
            logPath,
            `${date.toTimeString()} -- ERROR -- (${where}): ${msg}\n`
        );
    }
    console.error(msg);
}

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
        log("SlimeVR found at " + slimeIP + ":" + slimePort);
        packetCount += 1;
        foundSlimeVR = true;
    }
});

let isHandlingTracker = false;
const trackerQueue: string[] = [];

async function handleNextTracker() {
    if (trackerQueue.length === 0 || isHandlingTracker) return;
    isHandlingTracker = true;
    const trackerName = trackerQueue.shift();

    if (connectedDevices.length === 0) {
        const sent = await sendHandshakePacket(trackerName);
        if (sent) {
            connectedDevices.push(trackerName);
            connectedDevices.sort();
        }
    } else {
        if (connectedDevices.includes(trackerName)) return;
        const sent = await sendSensorInfoPacket(trackerName);
        if (sent) {
            connectedDevices.push(trackerName);
            connectedDevices.sort();
        }
    }

    isHandlingTracker = false;

    handleNextTracker();
}

/*
 * Packet sending
 */

// Sends a handshake packet to SlimeVR Server (first IMU tracker)
async function sendHandshakePacket(trackerName: string) {
    return new Promise((resolve, reject) => {
        packetCount += 1;

        const handshake = ServerBoundHandshakePacket.encode(
            BigInt(packetCount),
            BoardType.CUSTOM,
            SensorType.UNKNOWN,
            MCUType.UNKNOWN,
            1.022,
            "HaritoraX",
            [0x01, 0x02, 0x03, 0x04, 0x05, 0x06]
        );
        sock.send(handshake, 0, handshake.length, slimePort, slimeIP, (err) => {
            if (err) {
                error(`Error sending handshake: ${err}`);
                reject(false);
            } else {
                log(
                    `Added device ${trackerName} to SlimeVR server as IMU ${connectedDevices.length} // Handshake`
                );
                resolve(true);
            }
        });
    });
}

// Adds a new IMU tracker to SlimeVR Server
async function sendSensorInfoPacket(trackerName: string) {
    return new Promise((resolve, reject) => {
        packetCount += 1;

        const buffer = ServerBoundSensorInfoPacket.encode(
            BigInt(packetCount),
            connectedDevices.length,
            SensorStatus.OK,
            SensorType.UNKNOWN
        );

        sock.send(buffer, 0, buffer.length, slimePort, slimeIP, (err) => {
            if (err) {
                error(`Error sending sensor info packet: ${err}`);
                reject(false);
            } else {
                log(
                    `Added device ${trackerName} to SlimeVR server as IMU ${connectedDevices.length}`
                );
                resolve(true);
                packetCount += 1;
            }
        });
    });
}

function sendAccelPacket(acceleration: Gravity, deviceID: number) {
    packetCount += 1;

    // turn acceleration object into array with 3 values
    let accelerationArray = [acceleration.x, acceleration.y, acceleration.z];
    const buffer = ServerBoundAccelPacket.encode(
        BigInt(packetCount),
        deviceID,
        accelerationArray
    );

    sock.send(buffer, 0, buffer.length, slimePort, slimeIP, (err) => {
        if (err)
            error(
                `Error sending acceleration packet for sensor ${deviceID}: ${err}`
            );
    });
}

function sendRotationPacket(rotation: Rotation, deviceID: number) {
    packetCount += 1;

    // turn rotation object into array with 4 values
    let rotationArray = [rotation.x, rotation.y, rotation.z, rotation.w];
    const buffer = ServerBoundRotationDataPacket.encode(
        BigInt(packetCount),
        deviceID,
        RotationDataType.NORMAL,
        rotationArray,
        0
    );

    sock.send(buffer, 0, buffer.length, slimePort, slimeIP, (err) => {
        if (err)
            error(
                `Error sending rotation packet for sensor ${deviceID}: ${err}`
            );
    });
}

function sendBatteryLevel(
    percentage: number,
    voltage: number,
    deviceID: number
) {
    // Send lowest battery data to SlimeVR server (cannot send battery data for individual sensors)
    if (
        percentage < lowestBatteryData.percentage ||
        voltage < lowestBatteryData.voltage
    ) {
        lowestBatteryData.percentage = percentage;
        lowestBatteryData.voltage = voltage;
        log(
            `Set lowest battery data: ${lowestBatteryData.percentage}% (${
                lowestBatteryData.voltage / 1000
            }V)`
        );
    }

    packetCount += 1;
    const buffer = ServerBoundBatteryLevelPacket.encode(
        BigInt(packetCount),
        lowestBatteryData.voltage / 1000,
        lowestBatteryData.percentage
    );

    sock.send(buffer, 0, buffer.length, slimePort, slimeIP, (err) => {
        if (err) {
            error(
                `Error sending battery level packet for sensor ${deviceID}: ${err}`
            );
        } else {
            log(
                `Sent battery data to SlimeVR server: ${
                    lowestBatteryData.percentage
                }% (${lowestBatteryData.voltage / 1000}V)`
            );
        }
    });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
    device.stopConnection("bluetooth");
    device.stopConnection("gx");
    app.quit();
});

/*
 * TypeScript declarations
 */

interface Rotation {
    x: number;
    y: number;
    z: number;
    w: number;
}

interface Gravity {
    x: number;
    y: number;
    z: number;
}
