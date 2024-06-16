/*
 * Global imports and variables
 */

import { app, BrowserWindow, ipcMain, shell, dialog } from "electron";
// @ts-ignore
import { HaritoraX } from "../../haritorax-interpreter/dist/index.js";
import { SerialPort } from "serialport";
import BetterQuaternion from "quaternion";
import * as fs from "fs";
import * as path from "path";
import * as _ from "lodash-es";

import { fileURLToPath, format } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { MACAddress, Quaternion, Vector } from "@slimevr/common";
import {
    RotationDataType,
    BoardType,
    MCUType,
    SensorStatus,
    SensorType,
    UserAction,
    FirmwareFeatureFlags,
} from "@slimevr/firmware-protocol";
import { EmulatedTracker } from "@slimevr/tracker-emulation";

let mainWindow: BrowserWindow | null = null;
let device: HaritoraX = undefined;
let connectedDevices: Map<string, [EmulatedTracker, boolean]> = new Map<
    string,
    [EmulatedTracker, boolean]
>();
let canLogToFile = false;
let loggingMode = 1;
let foundSlimeVR = false;

let wirelessTrackerEnabled = false;
let wiredTrackerEnabled = false;
// this variable is literally only used so i can fix a stupid issue where with both BT+COM enabled, it sometimes connects the BT trackers again directly after again, breaking the program
// why.. i don't god damn know. i need to do a rewrite of the rewrite fr, i'm going crazy
// -jovannmc
let connectionActive = false;

const mainPath = app.isPackaged ? path.dirname(app.getPath("exe")) : __dirname;
const configPath = path.resolve(mainPath, "config.json");

/*
 * Translations (i18next)
 * Grabs the available translations in the program directory's "languages" folder to add as an option in renderer process
 */

async function loadTranslations() {
    const languagesDir = path.join(mainPath, "languages");

    if (!fs.existsSync(languagesDir)) {
        fs.mkdirSync(languagesDir);
    }

    const srcLanguagesDir = path.join(__dirname, "static", "languages");
    const srcFiles = fs.readdirSync(srcLanguagesDir);

    for (const file of srcFiles) {
        fs.copyFileSync(path.join(srcLanguagesDir, file), path.join(languagesDir, file));
    }

    const files = fs.readdirSync(languagesDir);
    const resources: any = {};

    for (const file of files) {
        const lang = path.basename(file, ".json");
        const translations = JSON.parse(fs.readFileSync(path.join(languagesDir, file), "utf-8"));

        resources[lang] = { translation: translations };
    }

    return resources;
}

async function translate(key: string) {
    return await mainWindow.webContents.executeJavaScript(`window.i18n.translate("${key}")`);
}

/*
 * Renderer
 */

const createWindow = () => {
    // check if certain settings are set in the config before creating the window
    if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath);
        const config: { [key: string]: any } = JSON.parse(data.toString());
        canLogToFile = config.global?.debug?.canLogToFile || false;
        wirelessTrackerEnabled = config.global?.trackers?.wirelessTrackerEnabled || false;
        wiredTrackerEnabled = config.global?.trackers?.wiredTrackerEnabled || false;
        loggingMode = config.global?.debug?.loggingMode || 1;
    }

    mainWindow = new BrowserWindow({
        title: "SlimeTora",
        autoHideMenuBar: true,
        width: 900,
        height: 700,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: true,
            preload: path.join(__dirname, "preload.mjs"),
            backgroundThrottling: false,
            spellcheck: false,
            sandbox: false, // fixes startup crashes due to GPU process, shouldn't be too large of a security risk as we're not loading any external content/connect to internet
        },
        icon: path.join(__dirname, "static/images/icon.ico"),
    });

    mainWindow.loadURL(
        format({
            pathname: path.join(__dirname, "static/html/index.html"),
            protocol: "file:",
            slashes: true,
        })
    );

    mainWindow.webContents.on("did-finish-load", async () => {
        mainWindow.webContents.send("localize", await loadTranslations());
        mainWindow.webContents.send("version", app.getVersion());
    });
};

app.on("ready", createWindow);

app.on("window-all-closed", () => {
    if (device && device.getConnectionModeActive("bluetooth")) device.stopConnection("bluetooth");
    if (device && device.getConnectionModeActive("com")) device.stopConnection("com");
    app.quit();
});

/*
 * Renderer handlers
 */

ipcMain.on("process-data", () => {
    const dataPath = path.resolve(mainPath, "data.txt");

    log("Processing data from data.txt...");

    fs.readFile(dataPath, "utf8", function (err, data) {
        if (err) {
            return console.log(err);
        }
        let lines = data.split("\n");
        const trackerNames = ["chest", "leftKnee", "leftAnkle", "rightKnee", "rightAnkle", "hip"];

        log(`Processing ${lines.length} lines of data...`);
        let i = 0;
        function processLine() {
            if (i >= lines.length) return;

            const data = lines[i];
            const buffer = Buffer.from(data, "base64");

            if (buffer.length === 84 || buffer.length == 88) {
                trackerNames.forEach((trackerName, index) => {
                    const start = index * 14; // 14 bytes per tracker
                    const trackerBuffer = buffer.slice(start, start + 14);
                    device.parseIMUData(trackerBuffer, trackerName);
                });
            } else {
                console.error("Unexpected data length:", buffer.length);
            }

            i++;
            setTimeout(processLine, 0);
        }

        processLine();
    });
});

ipcMain.on("log", (_event, arg: string) => {
    log(arg, "renderer");
});

ipcMain.on("error", (_event, arg: string) => {
    error(arg, "renderer");
});

ipcMain.on("show-message", (_event, arg) => {
    const { title, message }: { title: string; message: string } = arg;
    dialog.showMessageBox({ title, message });
});

ipcMain.on("show-error", (_event, arg) => {
    const { title, message }: { title: string; message: string } = arg;
    dialog.showErrorBox(title, message);
});

ipcMain.handle("get-active-trackers", () => {
    return connectedDevices;
});

ipcMain.handle("get-com-ports", async () => {
    const ports = await SerialPort.list();
    return ports.map((port: any) => port.path).sort();
});

ipcMain.handle("get-languages", async () => {
    const resources = await loadTranslations();
    return Object.keys(resources);
});

ipcMain.handle("search-for-server", async () => {
    if (foundSlimeVR) return true;

    heartbeatTracker.searchForServer();
    return await new Promise((resolve) => {
        setTimeout(() => {
            resolve(foundSlimeVR);
        }, 2000);
    });
});

ipcMain.on("set-log-to-file", (_event, arg) => {
    canLogToFile = arg;
    log(`Logging to file set to: ${arg}`);
});

ipcMain.on("set-logging", (_event, arg) => {
    loggingMode = arg;
    log(`Logging mode set to: ${arg}`);
});

ipcMain.on("set-wireless-tracker", (_event, arg) => {
    wirelessTrackerEnabled = arg;
    log(`Wireless tracker enabled set to: ${arg}`);
});

ipcMain.on("set-wired-tracker", (_event, arg) => {
    wiredTrackerEnabled = arg;
    log(`Wired tracker enabled set to: ${arg}`);
});

ipcMain.on("open-logs-folder", async () => {
    const logDir = path.resolve(mainPath, "logs");
    if (fs.existsSync(logDir)) {
        shell.openPath(logDir);
    } else {
        error("Logs directory does not exist");
        dialog.showErrorBox(
            await translate("dialogs.noLogsFolder.title"),
            await translate("dialogs.noLogsFolder.message")
        );
    }
});

ipcMain.on("open-tracker-settings", (_event, arg: string) => {
    let trackerSettingsWindow = new BrowserWindow({
        title: `${arg} settings`,
        autoHideMenuBar: true,
        width: 850,
        height: 650,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: true,
            preload: path.join(__dirname, "preload.mjs"),
            backgroundThrottling: true,
            spellcheck: false,
            sandbox: false, // fixes startup crashes due to GPU process, shouldn't be too large of a security risk as we're not loading any external content/connect to internet
        },
        icon: path.join(__dirname, "static/images/icon.ico"),
    });

    trackerSettingsWindow.loadURL(
        format({
            pathname: path.join(__dirname, "static/html/settings.html"),
            protocol: "file:",
            slashes: true,
        })
    );

    trackerSettingsWindow.webContents.on("did-finish-load", () => {
        // send trackerName to window
        trackerSettingsWindow.webContents.send("trackerName", arg);
    });
});

/*
 * Renderer tracker/device handlers
 */

ipcMain.on("start-connection", async (_event, arg) => {
    const { types, ports, isActive }: { types: string[]; ports?: string[]; isActive: boolean } =
        arg;
    log(`Start connection with: ${JSON.stringify(arg)}`);

    if (
        !device ||
        // new device instance if the tracker model is different
        (device.getActiveTrackerModel() === "wired" && !wiredTrackerEnabled) ||
        (device.getActiveTrackerModel() === "wireless" && !wirelessTrackerEnabled)
    ) {
        if (
            (!wirelessTrackerEnabled && !wiredTrackerEnabled) ||
            (types.includes("COM") && ports.length === 0)
        )
            return false;

        const trackerType = wiredTrackerEnabled ? "wired" : "wireless";

        log(`Creating new HaritoraX ${trackerType} instance with logging mode ${loggingMode}...`);

        if (loggingMode === 1) {
            device = new HaritoraX(trackerType, 0, false);
        } else if (loggingMode === 2) {
            device = new HaritoraX(trackerType, 2, false);
        } else if (loggingMode === 3) {
            device = new HaritoraX(trackerType, 2, true);
        }

        startDeviceListeners();
    }

    if (isActive) {
        error("Tried to start connection while already active");
        error(
            "..wait a second, you shouldn't be seeing this! get out of inspect element and stop trying to break the program!"
        );
        return false;
    }

    mainWindow.webContents.send("set-status", await translate("main.status.searching"));

    if (types.includes("bluetooth")) {
        log("Starting Bluetooth connection");
        const connectionStarted = device.startConnection("bluetooth");
        if (!connectionStarted) {
            error("Failed to start BLE connection");
            mainWindow.webContents.send("set-status", await translate("main.status.failed"));
            dialog.showErrorBox(
                await translate("dialogs.connectionFailed.title"),
                await translate("dialogs.connectionFailed.message")
            );
            return false;
        }
    }

    if (types.includes("com") && ports) {
        log("Starting COM connection with ports: " + JSON.stringify(ports));
        const connectionStarted = device.startConnection("com", ports);
        if (!connectionStarted) {
            error("Failed to start COM connection");
            mainWindow.webContents.send("set-status", await translate("main.status.failed"));
            dialog.showErrorBox(
                await translate("dialogs.connectionFailed.title"),
                await translate("dialogs.connectionFailed.message")
            );
            return false;
        }
    }

    connectionActive = true;

    const activeTrackers: string[] = device.getActiveTrackers();
    const uniqueActiveTrackers = Array.from(new Set(activeTrackers)); // Make sure they have unique entries
    if (!uniqueActiveTrackers || uniqueActiveTrackers.length === 0) return;
    uniqueActiveTrackers.forEach(async (trackerName) => {
        await addTracker(trackerName);
        log("Connected devices: " + JSON.stringify(uniqueActiveTrackers));
    });
});

ipcMain.on("stop-connection", (_event, arg: string) => {
    if (device) {
        if (arg.includes("bluetooth") && device.getConnectionModeActive("bluetooth")) {
            device.stopConnection("bluetooth");
            log("Stopped bluetooth connection");
        } else if (arg.includes("com") && device.getConnectionModeActive("com")) {
            device.stopConnection("com");
            log("Stopped COM connection");
        } else {
            log("No connection to stop");
        }
    } else {
        error(`Device instance wasn't started correctly`);
    }

    // For every tracker, de-initialize it
    connectedDevices.forEach((value, _key) => {
        if (value) value[0].deinit();
    });

    connectedDevices.clear();

    connectionActive = false;
});

ipcMain.handle("get-tracker-battery", async (_event, arg: string) => {
    let { batteryRemaining } = await device.getBatteryInfo(arg);
    if (!batteryRemaining) return;
    device.emit("battery", arg, batteryRemaining, 0); // BT doesn't support voltage (afaik)
});

ipcMain.handle("get-tracker-mag", async (_event, arg: string) => {
    let magInfo = await device.getTrackerMag(arg);
    mainWindow.webContents.send("device-mag", {
        trackerName: arg,
        magStatus: magInfo,
    });
    return magInfo;
});

ipcMain.handle("get-tracker-settings", async (_event, arg) => {
    const { trackerName, forceBLE }: { trackerName: string; forceBLE: boolean } = arg;
    let settings = await device.getTrackerSettings(trackerName, forceBLE);
    log("Got settings: " + JSON.stringify(settings));
    return settings;
});

ipcMain.on("set-tracker-settings", async (_event, arg) => {
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
        error(`Invalid settings received: ${JSON.stringify(arg)}`);
        return;
    }

    const uniqueSensorAutoCorrection = Array.from(new Set(sensorAutoCorrection));

    log(`Setting tracker settings for ${deviceID} to:`);
    log(`Sensor mode: ${sensorMode}`);
    log(`FPS mode: ${fpsMode}`);
    log(`Sensor auto correction: ${uniqueSensorAutoCorrection}`);
    log(`Old tracker settings: ${JSON.stringify(await device.getTrackerSettings(deviceID, true))}`);

    // Save the settings
    await setTrackerSettings(deviceID, sensorMode, fpsMode, uniqueSensorAutoCorrection);

    log(`New tracker settings: ${JSON.stringify(await device.getTrackerSettings(deviceID, true))}`);
});

// Helper for "set-tracker-settings" event
async function setTrackerSettings(
    deviceID: string,
    sensorMode: number,
    fpsMode: number,
    sensorAutoCorrection: string[]
) {
    const uniqueSensorAutoCorrection = Array.from(new Set(sensorAutoCorrection));

    device.setTrackerSettings(
        deviceID,
        sensorMode,
        fpsMode,
        uniqueSensorAutoCorrection,
        false // we don't support ankle yet
    );
}

ipcMain.on("set-all-tracker-settings", async (_event, arg) => {
    const {
        sensorMode,
        fpsMode,
        sensorAutoCorrection,
    }: {
        sensorMode: number;
        fpsMode: number;
        sensorAutoCorrection: string[];
    } = arg;
    if (!sensorMode || !fpsMode || !sensorAutoCorrection) {
        error(`Invalid settings received: ${JSON.stringify(arg)}`);
        return;
    }

    const uniqueSensorAutoCorrection = Array.from(new Set(sensorAutoCorrection));

    log(`Setting all tracker settings to:`);
    log(`Active trackers: ${connectedDevices}`);
    log(`Sensor mode: ${sensorMode}`);
    log(`FPS mode: ${fpsMode}`);
    log(`Sensor auto correction: ${uniqueSensorAutoCorrection}`);

    // Save the settings
    device.setAllTrackerSettings(
        sensorMode,
        fpsMode,
        uniqueSensorAutoCorrection,
        false // we don't support ankle yet
    );
});

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
    saveSetting(data);
});

function saveSetting(data: { [key: string]: any }) {
    const config: { [key: string]: any } = JSON.parse(fs.readFileSync(configPath).toString());

    // Use lodash's mergeWith to merge the new data with the existing config (not merge as it doesn't remove old keys if purposely removed by program, e.g. comPorts)
    const mergedConfig = _.mergeWith(config, data, (objValue: any, srcValue: any) => {
        if (_.isArray(objValue)) {
            return srcValue;
        }
    });

    fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 4));
}

ipcMain.handle("has-setting", (_event, name) => {
    const config: { [key: string]: any } = JSON.parse(fs.readFileSync(configPath).toString());

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
    const config: { [key: string]: any } = JSON.parse(fs.readFileSync(configPath).toString());

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

let trackerQueue: string[] = [];
let isProcessingQueue = false;

async function addTracker(trackerName: string) {
    trackerQueue.push(trackerName);
    processQueue();
}

async function processQueue() {
    if (isProcessingQueue || trackerQueue.length === 0) return;
    isProcessingQueue = true;

    while (trackerQueue.length > 0) {
        const trackerName = trackerQueue.shift();

        // Check if tracker has a MAC address assigned already in the config
        const config: { [key: string]: any } = JSON.parse(fs.readFileSync(configPath).toString());
        let macAddress = MACAddress.random();
        let macBytes = config.trackers?.[trackerName]?.macAddress?.bytes;
        if (macBytes && macBytes.length === 6) {
            macAddress = new MACAddress(macBytes);
        }

        let newTracker = new EmulatedTracker(
            macAddress,
            app.getVersion(),
            new FirmwareFeatureFlags(new Map([])),
            BoardType.CUSTOM,
            MCUType.UNKNOWN
        );

        if (connectedDevices.has(trackerName) && connectedDevices.get(trackerName)) continue;
        connectedDevices.set(trackerName, [newTracker, false]);

        await newTracker.init();
        await newTracker.addSensor(SensorType.UNKNOWN, SensorStatus.OK);

        // Sort the connectedDevices map by keys
        connectedDevices = new Map([...connectedDevices.entries()].sort());

        // Set the MAC address in the config
        saveSetting({ trackers: { [trackerName]: { macAddress } } });
        log(`Set MAC address for ${trackerName} to ${macAddress}`);

        // Set boolean to true to indicate that the tracker is connected
        connectedDevices.set(trackerName, [newTracker, true]);

        startTrackerListeners(newTracker);

        log(`Connected to tracker: ${trackerName}`);
        log(
            "Connected devices: " +
                JSON.stringify(
                    Array.from(connectedDevices.keys()).filter((key) => connectedDevices.get(key))
                )
        );
        mainWindow.webContents.send("connect", trackerName);
    }

    isProcessingQueue = false;
}

function startTrackerListeners(tracker: EmulatedTracker) {
    tracker.on("error", (err: Error) => error(err.message, "@slimevr/emulated-tracker"));

    tracker.on("unknown-incoming-packet", (packet: any) => {
        log(`Unknown packet type ${packet.type}`, "@slimevr/emulated-tracker");
    });

    tracker.on("unknown-incoming-packet", (buf: Buffer) =>
        log(`Unknown incoming packet: ${buf}`, "@slimevr/emulated-tracker")
    );
}

function startDeviceListeners() {
    device.on("connect", async (deviceID: string) => {
        if ((connectedDevices.has(deviceID) && connectedDevices.get(deviceID)) || !connectionActive)
            return;
        await addTracker(deviceID);
    });

    device.on("disconnect", (deviceID: string) => {
        if (!connectedDevices.get(deviceID)) return;
        log(`Disconnected from tracker: ${deviceID}`);

        connectedDevices.get(deviceID)[0].disconnectFromServer();
        connectedDevices.set(deviceID, undefined);

        mainWindow.webContents.send("disconnect", deviceID);
        log(
            "Connected devices: " +
                JSON.stringify(
                    Array.from(connectedDevices.keys()).filter((key) => connectedDevices.get(key))
                )
        );
    });

    device.on("mag", (trackerName: string, magStatus: string) => {
        mainWindow.webContents.send("device-mag", { trackerName, magStatus });
    });

    let clickCounts: { [key: string]: number } = {};
    let clickTimeouts: { [key: string]: NodeJS.Timeout } = {};

    device.on("button", (trackerName: string, buttonPressed: string, isOn: boolean) => {
        if (!trackerName || !isOn || !buttonPressed) return;

        let key = `${trackerName}-${buttonPressed}`;

        if (!clickCounts[key]) {
            clickCounts[key] = 0;
        }

        clickCounts[key]++;
        if (clickTimeouts[key] !== undefined) clearTimeout(clickTimeouts[key]);

        clickTimeouts[key] = setTimeout(() => {
            if (clickCounts[key] === 1) {
                log(`Single click ${buttonPressed} button from ${trackerName}`);
                heartbeatTracker.sendUserAction(UserAction.RESET_YAW);
            } else if (clickCounts[key] === 2) {
                log(`Double click ${buttonPressed} button from ${trackerName}`);
                heartbeatTracker.sendUserAction(UserAction.RESET_FULL);
            } else if (clickCounts[key] === 3) {
                log(`Triple click ${buttonPressed} button from ${trackerName}`);
                heartbeatTracker.sendUserAction(UserAction.RESET_MOUNTING);
            } else {
                log(`Four click ${buttonPressed} button from ${trackerName}`);
                heartbeatTracker.sendUserAction(UserAction.PAUSE_TRACKING);
            }

            clickCounts[key] = 0;
        }, 500);
    });

    device.on("imu", async (trackerName: string, rawRotation: Rotation, rawGravity: Gravity) => {
        if (!connectedDevices.has(trackerName) || !rawRotation || !rawGravity) return;

        // YOU ARE NOT SERIOUS. ALRIGHT.
        // I HAD BEEN TRYING TO SOLVE TRACKING ISSUES FOR AGES, AND IT TURNS OUT BOTH QUATERNIONS WERE USING DIFFERENT LAYOUTS
        // ONE WAS XYZW AND THE OTHER WAS WXYZ. THAT'S WHY THERE WAS TRACKING ISSUES. WHY.
        // -jovannmc

        // Convert rotation to quaternion
        const quaternion = new Quaternion(
            rawRotation.x,
            rawRotation.y,
            rawRotation.z,
            rawRotation.w
        );

        // Convert the quaternion to Euler angles
        const eulerRadians = new BetterQuaternion(
            quaternion.w,
            quaternion.x,
            quaternion.y,
            quaternion.z
        ).toEuler("XYZ");

        // Convert the rotation to degrees
        const rotation = {
            x: eulerRadians[0] * (180 / Math.PI),
            y: eulerRadians[1] * (180 / Math.PI),
            z: eulerRadians[2] * (180 / Math.PI),
        };

        const gravity = new Vector(rawGravity.x, rawGravity.y, rawGravity.z);

        let trackerData = connectedDevices.get(trackerName);
        if (trackerData) {
            const tracker = trackerData[0];
            const trackerConnected = trackerData[1];

            if (!trackerConnected) return;
            tracker.sendRotationData(0, RotationDataType.NORMAL, quaternion, 0);
            tracker.sendAcceleration(0, gravity);
        } else {
            return false;
        }

        mainWindow.webContents.send("device-data", {
            trackerName,
            rotation,
            gravity,
            rawRotation,
            rawGravity,
        });
    });

    device.on(
        "battery",
        (trackerName: string, batteryRemaining: number, batteryVoltage: number) => {
            let batteryVoltageInVolts = batteryVoltage ? batteryVoltage / 1000 : 0;
            if (!connectedDevices.has(trackerName)) return;
            if (trackerName.startsWith("HaritoraX")) batteryVoltageInVolts = 0;

            let trackerData = connectedDevices.get(trackerName);
            if (trackerData) {
                const tracker = trackerData[0];
                const trackerConnected = trackerData[1];

                if (!trackerConnected) return;
                tracker.changeBatteryLevel(batteryVoltageInVolts, batteryRemaining);
            } else {
                return false;
            }
            mainWindow.webContents.send("device-battery", {
                trackerName,
                batteryRemaining,
                batteryVoltage: batteryVoltageInVolts,
            });
            log(
                `Received battery data for ${trackerName}: ${batteryRemaining}% (${batteryVoltageInVolts}V)`
            );
        }
    );

    device.on("log", (msg: string) => {
        log(msg);
    });

    device.on("error", (msg: string) => {
        error(msg);
    });
}

/*
 * SlimeVR Forwarding
 */

const heartbeatTracker = new EmulatedTracker(
    new MACAddress([0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
    app.getVersion() + "-heartbeat",
    new FirmwareFeatureFlags(new Map([])),
    BoardType.CUSTOM,
    MCUType.UNKNOWN
);

const connectToServer = async () => {
    heartbeatTracker.on("ready", () => {
        log("Ready to search for SlimeVR server...");
    });

    heartbeatTracker.on("connected-to-server", async (ip: string, port: number) => {
        log(`Connected to SlimeVR server on ${ip}:${port}`);
        foundSlimeVR = true;
        mainWindow.webContents.send("set-slimevr-connected", true);
    });

    heartbeatTracker.on("searching-for-server", () => {
        log("Searching for SlimeVR server...");
    });

    heartbeatTracker.on("error", (err: Error) => error(err.message, "@slimevr/emulated-tracker"));

    heartbeatTracker.on("unknown-incoming-packet", (packet: any) => {
        log(`Unknown packet type ${packet.type}`, "@slimevr/emulated-tracker");
    });

    heartbeatTracker.on("unknown-incoming-packet", (buf: Buffer) =>
        log(`Unknown incoming packet: ${buf}`, "@slimevr/emulated-tracker")
    );

    await heartbeatTracker.init();
};

connectToServer();

/*
 * Logging
 */

function log(msg: string, where = "main") {
    const date = new Date();

    if (canLogToFile) {
        const logDir = path.resolve(mainPath, "logs");
        const logPath = path.join(
            logDir,
            `log-${date.getFullYear()}${("0" + (date.getMonth() + 1)).slice(-2)}${(
                "0" + date.getDate()
            ).slice(-2)}.txt`
        );

        // Create the directory if it doesn't exist
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        // Create the file if it doesn't exist
        if (!fs.existsSync(logPath)) {
            fs.writeFileSync(logPath, "");
        }

        fs.appendFileSync(logPath, `${date.toTimeString()} -- INFO -- (${where}): ${msg}\n`);
    }
    console.log(`${date.toTimeString()} -- INFO -- (${where}): ${msg}`);
}

function error(msg: string, where = "main") {
    const date = new Date();
    if (canLogToFile) {
        const logDir = path.resolve(mainPath, "logs");
        const logPath = path.join(
            logDir,
            `log-${date.getFullYear()}${("0" + (date.getMonth() + 1)).slice(-2)}${(
                "0" + date.getDate()
            ).slice(-2)}.txt`
        );

        // Create the directory if it doesn't exist
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        // Create the file if it doesn't exist
        if (!fs.existsSync(logPath)) {
            fs.writeFileSync(logPath, "");
        }

        if (where === "interpreter" && loggingMode === 1) return;

        fs.appendFileSync(logPath, `${date.toTimeString()} -- ERROR -- (${where}): ${msg}\n`);
    }
    console.error(`${date.toTimeString()} -- ERROR -- (${where}): ${msg}`);
}

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
