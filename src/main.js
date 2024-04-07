const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { HaritoraXWireless } = require("haritorax-interpreter");
const { SerialPort } = require("serialport");
const dgram = require("dgram");
const Quaternion = require("quaternion");
const fs = require("fs");
const path = require("path");
const sock = dgram.createSocket("udp4");

// ! fix data being sent to slimevr sometimes going from 100 to 50 fps

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

let mainWindow;
const device = new HaritoraXWireless(0);
let connectedDevices = [];
let logToFile = false;
let foundSlimeVR = false;

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
        if (Object.prototype.hasOwnProperty.call(config, "logToFile")) {
            logToFile = config.logToFile;
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
    logToFile = arg;
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

async function connectGX(ports) {
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

device.on("connect", (deviceID) => {
    if (connectedDevices.includes(deviceID)) return;
    log("Connected devices: " + JSON.stringify(connectedDevices));
    trackerQueue.push(deviceID);
    handleNextTracker();
    log(`Connected to tracker: ${deviceID}`);
    mainWindow.webContents.send("connect", deviceID);
});

device.on("disconnect", (deviceID) => {
    if (!connectedDevices.includes(deviceID)) return;
    log(`Disconnected from tracker: ${deviceID}`);
    mainWindow.webContents.send("disconnect", deviceID);
    connectedDevices = connectedDevices.filter((name) => name !== deviceID);
});

device.on("imu", (trackerName, rotation, gravity) => {
    if (!connectedDevices.includes(trackerName) || !rotation || !gravity)
        return;

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
    log(
        `Received battery data for ${trackerName}: ${batteryRemaining}% (${
            batteryVoltage / 1000
        }V)`
    );
});

function log(msg, where = "main") {
    if (logToFile) {
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

function error(msg, where = "main") {
    if (logToFile) {
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
const trackerQueue = [];

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
async function sendHandshakePacket(trackerName) {
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
                log(`Added device ${trackerName} to SlimeVR server as IMU ${connectedDevices.length} // Handshake`);
                resolve(true);
            }
        });
    });
}

// Adds a new IMU tracker to SlimeVR Server
async function sendSensorInfoPacket(trackerName) {
    return new Promise((resolve, reject) => {
        packetCount += 1;

        const buffer = ServerBoundSensorInfoPacket.encode(
            BigInt(packetCount),
            connectedDevices.length,
            SensorStatus.OK,
            SensorType.UNKNOWN,
        );

        sock.send(buffer, 0, buffer.length, slimePort, slimeIP, (err) => {
            if (err) {
                error(`Error sending sensor info packet: ${err}`);
                reject(false);
            } else {
                log(`Added device ${trackerName} to SlimeVR server as IMU ${connectedDevices.length}`);
                resolve(true);
                packetCount += 1;
            }
        });
    });
    
}

function sendAccelPacket(acceleration, deviceID) {
    packetCount += 1;

    // turn acceleration object into array with 3 values
    acceleration = [acceleration.x, acceleration.y, acceleration.z];
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

function sendRotationPacket(rotation, deviceID) {
    packetCount += 1;
    
    // turn rotation object into array with 4 values
    rotation = [rotation.x, rotation.y, rotation.z, rotation.w];
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

// TODO: send lowest battery level
function sendBatteryLevel(percentage, voltage, deviceID) {
    packetCount += 1;
    const buffer = ServerBoundBatteryLevelPacket.encode(
        BigInt(packetCount),
        voltage / 1000,
        percentage
    );
    
    sock.send(buffer, 0, buffer.length, slimePort, slimeIP, (err) => {
        if (err)
            error(
                `Error sending battery level packet for sensor ${deviceID}: ${err}`
            );
    });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
    device.stopConnection("bluetooth");
    device.stopConnection("gx");
    app.quit();
});