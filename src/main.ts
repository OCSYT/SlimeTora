import { app, BrowserWindow, ipcMain, shell, dialog } from "electron";
import { HaritoraXWireless } from "haritorax-interpreter";
import { SerialPort } from "serialport";
import * as dgram from "dgram";
import Quaternion from "quaternion";
import * as fs from "fs";
import * as path from "path";
const _ = require("lodash");

const sock = dgram.createSocket("udp4");

import {
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
} from "@slimevr/firmware-protocol";

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
        const config: { [key: string]: any } = JSON.parse(data.toString());
        if (Object.prototype.hasOwnProperty.call(config, "canLogToFile")) {
            canLogToFile = config.canLogToFile;
        }
    }

    mainWindow = new BrowserWindow({
        title: "SlimeTora",
        autoHideMenuBar: true,
        width: 900,
        height: 700,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
        icon: path.join(__dirname, "icons/icon.ico"),
    });

    mainWindow.loadURL(path.join(__dirname, "index.html"));

    mainWindow.webContents.on("did-finish-load", () => {
        mainWindow.webContents.send("version", app.getVersion());
    });
};

/*
 * Renderer handlers
 */

ipcMain.on("log", (_event, arg: string) => {
    log(arg, "renderer");
});

ipcMain.on("error", (_event, arg: string) => {
    error(arg, "renderer");
});

ipcMain.on("start-connection", (_event, arg) => {
    const { type, ports }: { type: string; ports: string[] } = arg;
    log(`Start connection with: ${JSON.stringify(arg)}`);

    if (
        device.getConnectionModeActive("bluetooth") ||
        device.getConnectionModeActive("gx")
    ) {
        log("Tried to start connection while already active");
        dialog.showErrorBox(
            "Connection already active",
            "Please stop the current connection before starting a new one."
        );
        return false;
    }

    if (type.includes("bluetooth")) {
        connectBluetooth();
    } else if (type.includes("gx") && ports) {
        connectGX(ports);
    }

    const activeTrackers: string[] = device.getActiveTrackers();
    if (!activeTrackers || activeTrackers.length === 0) return;
    activeTrackers.forEach((trackerName) => {
        trackerQueue.push(trackerName);
        handleNextTracker();
        log(`Connected to tracker: ${trackerName}`);
        mainWindow.webContents.send("connect", trackerName);
        log("Connected devices: " + JSON.stringify(trackerName));
    });
});

ipcMain.on("stop-connection", (_event, arg: string) => {
    if (arg.includes("bluetooth")) {
        device.stopConnection("bluetooth");
        log("Stopped bluetooth connection");
    } else if (arg.includes("gx")) {
        device.stopConnection("gx");
        log("Stopped GX connection");
    }
    connectedDevices = [];
});

ipcMain.on("get-battery", (_event, arg: string) => {
    device.getBatteryInfo(arg);
});

ipcMain.handle("get-com-ports", async () => {
    const ports = await SerialPort.list();
    return ports.map((port) => port.path).sort();
});

ipcMain.handle("get-tracker-settings", (_event, arg: string) => {
    return device.getTrackerSettings(arg);
});

ipcMain.handle("get-active-trackers", () => {
    return connectedDevices;
});

ipcMain.handle("is-slimevr-connected", () => {
    return foundSlimeVR;
});

ipcMain.on("set-tracker-settings", (_event, arg) => {
    const {
        deviceID,
        sensorMode,
        fpsMode,
        sensorAutoCorrection,
    }: {
        deviceID: string;
        sensorMode: number;
        fpsMode: number;
        sensorAutoCorrection: string[];
    } = arg;
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

ipcMain.on("set-logging", (_event, arg) => {
    canLogToFile = arg;
    log(`Logging to file set to: ${arg}`);
});

ipcMain.on("open-logs-folder", () => {
    const logDir = path.resolve(mainPath, "logs");
    if (fs.existsSync(logDir)) {
        shell.openPath(logDir);
    } else {
        error("Logs directory does not exist");
        dialog.showErrorBox(
            "No logs!",
            "You should probably enable debug logging first."
        );
    }
});

ipcMain.on("open-tracker-settings", (_event, arg: string) => {
    let trackerSettingsWindow = new BrowserWindow({
        title: `${arg} settings`,
        autoHideMenuBar: true,
        width: 800,
        height: 620,
        webPreferences: {
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
        icon: path.join(__dirname, "icons/icon.ico"),
    });

    trackerSettingsWindow.loadURL(path.join(__dirname, "settings.html"));

    trackerSettingsWindow.webContents.on("did-finish-load", () => {
        trackerSettingsWindow.webContents.send("trackerName", arg);
    });
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

ipcMain.on("save-setting", (_event, data) => {
    const config: { [key: string]: any } = JSON.parse(
        fs.readFileSync(configPath).toString()
    );

    // Use lodash's mergeWith to merge the new data with the existing config (not merge as it doesn't remove old keys if purposely removed by program, e.g. comPorts)
    const mergedConfig = _.mergeWith(
        config,
        data,
        (objValue: any, srcValue: any) => {
            if (_.isArray(objValue)) {
                return srcValue;
            }
        }
    );

    fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 4));
});

ipcMain.handle("has-setting", (_event, name) => {
    const config: { [key: string]: any } = JSON.parse(
        fs.readFileSync(configPath).toString()
    );

    const properties = name.split(".");
    let current = config;

    for (const property of properties) {
        if (!current.hasOwnProperty(property)) {
            return false;
        }
        current = current[property];
    }

    return true;
});

ipcMain.handle("get-setting", (_event, name) => {
    const config: { [key: string]: any } = JSON.parse(
        fs.readFileSync(configPath).toString()
    );

    const properties = name.split(".");
    let current = config;

    for (const property of properties) {
        if (!current.hasOwnProperty(property)) {
            return null;
        }
        current = current[property];
    }

    return current;
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
        if (
            !connectedDevices.includes(trackerName) ||
            !rawRotation ||
            !rawGravity
        )
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
        if (!connectedDevices.includes(trackerName)) return;
        sendBatteryLevel(
            batteryRemaining,
            batteryVoltage,
            connectedDevices.indexOf(trackerName)
        );
        mainWindow.webContents.send("device-battery", {
            trackerName,
            batteryRemaining,
            batteryVoltage,
        });
        log(
            `Received battery data for ${trackerName}: ${batteryRemaining}% (${
                batteryVoltage / 1000
            }V)`
        );
    }
);

function log(msg: string, where = "main") {
    const date = new Date();

    if (canLogToFile) {
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
    console.log(`${date.toTimeString()} -- INFO -- (${where}): ${msg}`);
}

function error(msg: string, where = "main") {
    const date = new Date();
    if (canLogToFile) {
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
    console.error(`${date.toTimeString()} -- ERROR -- (${where}): ${msg}`);
}

/*
 * SlimeVR Forwarding
 */

// TODO: change how the SlimeVR server is found

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
        const sent = (await sendHandshakePacket(trackerName)) as boolean;
        if (sent) {
            connectedDevices.push(trackerName);
            connectedDevices.sort();
        } else {
            error(
                `Failed to send handshake for ${trackerName}, not adding to connected devices`
            );
        }
    } else {
        if (connectedDevices.includes(trackerName)) return;
        const sent = (await sendSensorInfoPacket(trackerName)) as boolean;
        if (sent) {
            connectedDevices.push(trackerName);
            connectedDevices.sort();
        } else {
            error(
                `Failed to send sensor info packet for ${trackerName}, not adding to connected devices`
            );
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
    const buffer = ServerBoundAccelPacket.encode(
        BigInt(packetCount),
        deviceID,
        acceleration
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

    const buffer = ServerBoundRotationDataPacket.encode(
        BigInt(packetCount),
        deviceID,
        RotationDataType.NORMAL,
        rotation,
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
