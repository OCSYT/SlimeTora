/*
 * Global imports and variables
 */

import { app, BrowserWindow, ipcMain, shell, dialog, Menu } from "electron";
// @ts-ignore
import { HaritoraX } from "../../haritorax-interpreter/dist/index.js";
import { autoDetect } from "@serialport/bindings-cpp";
const Binding = autoDetect();
import fs, { PathLike } from "fs";
import path, { dirname } from "path";
import { fileURLToPath, format } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mainPath = app.isPackaged ? path.dirname(app.getPath("exe")) : __dirname;
const configPath = path.resolve(mainPath, "config.json");
// don't mess with this or languages will fail to load cause of how the project is structured, lol
const languagesPath = path.resolve(
    mainPath,
    app.isPackaged || process.env.DEVELOPMENT ? "resources/languages" : "languages"
);

let mainWindow: BrowserWindow;
let device: HaritoraX;
let connectedDevices = new Map<string, EmulatedTracker>();
let deviceBattery: {
    [key: string]: { batteryRemaining: number; batteryVoltage: number };
} = {};

/*
 * Renderer variables
 */
let canLogToFile = false;
let loggingMode = 1;
let foundSlimeVR = false;
let heartbeatInterval = 2000;
let wirelessTrackerEnabled = false;
let wiredTrackerEnabled = false;
// this variable is literally only used so i can fix a stupid issue where with both BT+COM enabled, it sometimes connects the BT trackers again directly after again, breaking the program
// why.. i don't god damn know. i need to do a rewrite of the rewrite fr, i'm going crazy
// -jovannmc
let connectionActive = false;

const resources = await loadTranslations();
let comPorts = await Binding.list();

function isDevelopment() {
    return process.env.DEVELOPMENT || !app.isPackaged;
}

/*
 * Translations (i18next)
 */

async function loadTranslations() {
    const files = await fs.promises.readdir(languagesPath);
    const resources: any = {};
    log(`Loading translations from ${languagesPath}`);

    for (const file of files) {
        const lang = path.basename(file, ".json");
        const translations = JSON.parse(await fs.promises.readFile(path.join(languagesPath, file), "utf-8"));

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

function clearTrackers() {
    connectedDevices.forEach((device, deviceId) => {
        if (device === undefined) {
            connectedDevices.delete(deviceId);
        } else {
            try {
                device.deinit();
            } catch (err) {
                error(`Failed to de-initialize device: ${err}`);
            }
        }
    });
    connectedDevices.clear();
}

const createWindow = async () => {
    try {
        // Check if the config file is accessible
        await fs.promises.access(configPath);

        // Read and parse the config file
        const data = await fs.promises.readFile(configPath, "utf8");
        const config: { [key: string]: any } = JSON.parse(data);

        // Set configuration variables
        canLogToFile = config.global?.debug?.canLogToFile || false;
        wirelessTrackerEnabled = config.global?.trackers?.wirelessTrackerEnabled || false;
        wiredTrackerEnabled = config.global?.trackers?.wiredTrackerEnabled || false;
        heartbeatInterval = config.global?.trackers?.heartbeatInterval || 2000;
        loggingMode = config.global?.debug?.loggingMode || 1;
    } catch (err) {
        // If the config file doesn't exist, create it
        await fs.promises.writeFile(configPath, "{}");
        log("Config file not found, creating new one.");
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
        mainWindow.webContents.send("localize", resources);
        mainWindow.webContents.send("version", app.getVersion());
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });
};

const closeApp = () => {
    clearTrackers();

    if (device && device.getConnectionModeActive("bluetooth")) device.stopConnection("bluetooth");
    if (device && device.getConnectionModeActive("com")) device.stopConnection("com");

    device = undefined;
    mainWindow = null;

    app.quit();
};

// Force iGPU if available
app.commandLine.appendSwitch("force_low_power_gpu");

// Don't show the menu bar for performance (this disables the dev tools though, may remove this later)
// could also set this depending on "logging mode" setting in config
if (!isDevelopment) {
    log("Development mode disabled, hiding menu bar");
    Menu.setApplicationMenu(null);
} else {
    log("Development mode enabled, showing menu bar");
}

app.on("ready", createWindow);
app.on("window-all-closed", closeApp);

/*
 * Renderer handlers
 */

async function showMessage(title: string, message: string, translateMessage = true) {
    const translatedTitle = translateMessage ? await translate(title) : title;
    const translatedMessage = translateMessage ? await translate(message) : message;

    dialog.showMessageBox({ title: translatedTitle, message: translatedMessage });
}

async function showError(title: string, message: string, translateMessage = true) {
    const translatedTitle = translateMessage ? await translate(title) : title;
    const translatedMessage = translateMessage ? await translate(message) : message;

    dialog.showErrorBox(translatedTitle, translatedMessage);
}

ipcMain.on("log", (_event, arg: string) => {
    log(arg, "renderer");
});

ipcMain.on("error", (_event, arg: string) => {
    error(arg, "renderer");
});

ipcMain.on("show-message", async (_event, arg) => {
    const {
        title,
        message,
        translateMessage = true,
    }: { title: string; message: string; translateMessage: boolean } = arg;

    await showMessage(title, message, translateMessage);
});

ipcMain.on("show-error", async (_event, arg) => {
    const {
        title,
        message,
        translateMessage = true,
    }: { title: string; message: string; translateMessage: boolean } = arg;

    await showError(title, message, translateMessage);
});

ipcMain.handle("translate", async (_event, arg: string) => {
    return await translate(arg);
});

ipcMain.handle("get-com-ports", async (_event, arg: string) => {
    if (!arg) return comPorts.map((port: any) => port.path).sort();

    if (!device) {
        initializeDevice();
        const ports = await device.getDevicePorts(arg);
        device = undefined;
        return ports;
    }
});

ipcMain.handle("get-active-trackers", () => {
    return connectedDevices;
});

ipcMain.handle("get-languages", async () => {
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
    try {
        await fs.promises.access(logDir);
        await shell.openPath(logDir);
    } catch (err) {
        error(`Logs directory does not exist: ${err}`);
        await showError("dialogs.noLogsFolder.title", "dialogs.noLogsFolder.message");
    }
});

ipcMain.on("open-tracker-settings", (_event, arg: string) => {
    let trackerSettingsWindow = new BrowserWindow({
        title: `${arg} settings`,
        autoHideMenuBar: true,
        width: 850,
        height: 650,
        modal: true, // prevent interaction with "parent" window until closed
        parent: mainWindow,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: true,
            preload: path.join(__dirname, "preload.mjs"),
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

ipcMain.handle("autodetect", async () => {
    log("Starting auto-detection...");
    device = undefined;

    log("Initializing new HaritoraX instance...");
    initializeDevice();

    // @ts-ignore
    const devices = await device.getAvailableDevices();
    device.removeAllListeners();
    device = undefined;

    return devices;
});

ipcMain.on("start-connection", async (_event, arg) => {
    const { types, ports, isActive }: { types: string[]; ports?: string[]; isActive: boolean } = arg;
    log(`Start connection with: ${JSON.stringify(arg)}`);

    if (isActive) {
        error("Tried to start connection while already active");
        return false;
    }

    if (!isValidDeviceConfiguration(types, ports)) {
        error("Invalid device configuration");
        return false;
    }

    if (shouldInitializeNewDevice()) {
        initializeDevice();
        startDeviceListeners();
    }

    mainWindow.webContents.send("set-status", "main.status.searching");
    if (types.includes("bluetooth")) device.startConnection("bluetooth");
    // @ts-ignore
    if (types.includes("com") && ports) device.startConnection("com", ports, heartbeatInterval);
    connectionActive = true;

    await notifyConnectedDevices();
});

function isValidDeviceConfiguration(types: string[], ports?: string[]): boolean {
    if (
        (!wirelessTrackerEnabled && !wiredTrackerEnabled) ||
        (types.includes("COM") && (!ports || ports.length === 0))
    ) {
        return false;
    }
    return true;
}

function shouldInitializeNewDevice(): boolean {
    return (
        !device ||
        (device.getActiveTrackerModel() === "wired" && !wiredTrackerEnabled) ||
        (device.getActiveTrackerModel() === "wireless" && !wirelessTrackerEnabled)
    );
}

function initializeDevice(): void {
    const trackerType = wiredTrackerEnabled ? "wired" : "wireless";
    log(`Creating new HaritoraX ${trackerType} instance with logging mode ${loggingMode}...`);
    const loggingOptions = {
        1: [false, false],
        2: [true, false],
        3: [true, true],
    };
    const [logging, imuProcessing] = (loggingOptions as { [key: string]: (boolean | boolean)[] })[
        loggingMode.toString()
    ] || [false, false];
    // @ts-ignore
    device = new HaritoraX(trackerType, logging, imuProcessing);
}

async function notifyConnectedDevices(): Promise<void> {
    const activeTrackers = Array.from(new Set(device.getActiveTrackers()));
    if (activeTrackers.length === 0) return;
    for (const trackerName of activeTrackers) {
        await addTracker(trackerName);
    }
    log("Connected devices: " + JSON.stringify(activeTrackers));
}

ipcMain.on("stop-connection", () => {
    if (!device) {
        error("Device instance wasn't started correctly");
        return;
    }

    const stopConnectionIfActive = (mode: string) => {
        if (!device.getConnectionModeActive(mode)) return;
        device.stopConnection(mode);
        log(`Stopped ${mode} connection`);
    };

    stopConnectionIfActive("bluetooth");
    stopConnectionIfActive("com");

    clearTrackers();

    connectionActive = false;
});

ipcMain.handle("fire-tracker-battery", (_event, trackerName: string) => {
    // For COM wireless trackers, set battery info immediately after connecting
    if (deviceBattery[trackerName]) {
        mainWindow.webContents.send("device-battery", {
            trackerName,
            batteryRemaining: deviceBattery[trackerName]?.batteryRemaining || 0,
            batteryVoltage: deviceBattery[trackerName]?.batteryVoltage || 0,
        });
    }

    // @ts-ignore
    device.fireTrackerBattery(trackerName);
});

ipcMain.handle("fire-tracker-mag", (_event, trackerName: string) => {
    // @ts-ignore
    device.fireTrackerMag(trackerName);
});

ipcMain.handle("get-tracker-settings", async (_event, arg) => {
    const { trackerName, forceBLE }: { trackerName: string; forceBLE: boolean } = arg;
    let settings = await device.getTrackerSettings(trackerName, forceBLE);
    log("Got tracker settings: " + JSON.stringify(settings));
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
    // Validate input parameters
    if (!sensorMode || !fpsMode || !sensorAutoCorrection || sensorAutoCorrection.length === 0) {
        error(`Invalid settings received: ${JSON.stringify(arg)}`);
        return;
    }

    // Log old tracker settings
    const oldSettings = await device.getTrackerSettings(deviceID, true);
    log(`Old tracker settings: ${JSON.stringify(oldSettings)}`);

    // Make sure we get unique entries
    const uniqueSensorAutoCorrection = [...new Set(sensorAutoCorrection)];
    log(`Setting tracker settings for ${deviceID} to:`);
    log(`Sensor mode: ${sensorMode}`);
    log(`FPS mode: ${fpsMode}`);
    log(`Sensor auto correction: ${sensorAutoCorrection}`);

    // Apply the new settings
    device.setTrackerSettings(deviceID, sensorMode, fpsMode, uniqueSensorAutoCorrection, false);

    // Log new tracker settings
    const newSettings = await device.getTrackerSettings(deviceID, true);
    log(`New tracker settings: ${JSON.stringify(newSettings)}`);
});

ipcMain.on("set-all-tracker-settings", async (_event, arg) => {
    const {
        sensorMode,
        fpsMode,
        sensorAutoCorrection,
    }: { sensorMode: number; fpsMode: number; sensorAutoCorrection: string[] } = arg;

    // Validate input settings
    if (!sensorMode || !fpsMode || !sensorAutoCorrection || sensorAutoCorrection.length === 0) {
        error(`Invalid settings received: ${JSON.stringify(arg)}`);
        return;
    }

    // Make sure we get unique entries
    const uniqueSensorAutoCorrection = [...new Set(sensorAutoCorrection)];
    const uniqueActiveTrackers = [...new Set(device.getActiveTrackers())];

    log(
        `Setting all tracker settings to: ${{
            ActiveTrackers: uniqueActiveTrackers,
            SensorMode: sensorMode,
            FPSMode: fpsMode,
            SensorAutoCorrection: uniqueSensorAutoCorrection,
        }}`
    );

    device.setAllTrackerSettings(sensorMode, fpsMode, uniqueSensorAutoCorrection, false);
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

import * as _ from "lodash-es";
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
 * haritorax-interpreter event listeners
 */

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
import BetterQuaternion from "quaternion";

// For haritorax-interpreter
enum ErrorType {
    IMUProcessError = "Error decoding IMU packet",
    MagProcessError = "Error processing mag data",
    SettingsProcessError = "Error processing settings data",
    ButtonProcessError = "Error processing button data",

    BluetoothScanError = "Error starting bluetooth scanning",
    BluetoothDiscoveryError = "Error during discovery/connection process",
    BluetoothCloseError = "Error while closing bluetooth connection",

    SerialWriteError = "Error writing data to serial port",
    SerialUnexpectedError = "Error on port",

    JSONParseError = "JSON",
    SendHeartbeatError = "Error while sending heartbeat",
    UnexpectedError = "An unexpected error occurred",

    TrackerSettingsWriteError = "Error sending tracker settings",
    ConnectionStartError = "Opening COM",
    // TODO: add more error types
}

const lastErrorShownTime: Record<ErrorType, number> = {
    [ErrorType.ConnectionStartError]: 0,
    [ErrorType.TrackerSettingsWriteError]: 0,
    [ErrorType.MagProcessError]: 0,
    [ErrorType.SettingsProcessError]: 0,
    [ErrorType.ButtonProcessError]: 0,
    [ErrorType.SerialWriteError]: 0,
    [ErrorType.BluetoothScanError]: 0,
    [ErrorType.BluetoothDiscoveryError]: 0,
    [ErrorType.JSONParseError]: 0,
    [ErrorType.UnexpectedError]: 0,
    [ErrorType.SendHeartbeatError]: 0,
    [ErrorType.IMUProcessError]: 0,
    [ErrorType.BluetoothCloseError]: 0,
    [ErrorType.SerialUnexpectedError]: 0,
};

const errorCooldownPeriod = 500;

let trackerQueue: string[] = [];
let isProcessingQueue = false;

async function addTracker(trackerName: string) {
    trackerQueue.push(trackerName);
    processQueue();
}

async function processQueue() {
    if (isProcessingQueue || trackerQueue.length === 0) return;
    isProcessingQueue = true;

    const config: { [key: string]: any } = JSON.parse(fs.readFileSync(configPath).toString());

    while (trackerQueue.length > 0) {
        const trackerName = trackerQueue.shift();

        if (connectedDevices.get(trackerName) !== undefined) return;

        // Check if tracker has a MAC address assigned already in the config
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

        await newTracker.init();
        await newTracker.addSensor(SensorType.UNKNOWN, SensorStatus.OK);

        // Set the MAC address in the config
        saveSetting({ trackers: { [trackerName]: { macAddress } } });
        log(`Set MAC address for ${trackerName} to ${macAddress}`);

        connectedDevices.set(trackerName, newTracker);

        setupTrackerEvents(newTracker);

        log(`Connected to tracker: ${trackerName}`);
        mainWindow.webContents.send("connect", trackerName);
    }

    // Sort the connectedDevices map by keys
    connectedDevices = new Map([...connectedDevices.entries()].sort());

    log(
        "Connected devices: " +
            JSON.stringify(Array.from(connectedDevices.keys()).filter((key) => connectedDevices.get(key)))
    );

    isProcessingQueue = false;
}

function startDeviceListeners() {
    device.on("connect", async (deviceID: string) => {
        if (!deviceID || !connectionActive || (connectedDevices.has(deviceID) && connectedDevices.get(deviceID)))
            return;
        await addTracker(deviceID);
    });

    device.on("disconnect", (deviceID: string) => {
        if (!deviceID || !connectedDevices.get(deviceID)) return;
        log(`Disconnected from tracker: ${deviceID}`);

        connectedDevices.get(deviceID).deinit();
        connectedDevices.get(deviceID).removeAllListeners();
        connectedDevices.set(deviceID, undefined);

        mainWindow.webContents.send("disconnect", deviceID);
        log(
            "Connected devices: " +
                JSON.stringify(Array.from(connectedDevices.keys()).filter((key) => connectedDevices.get(key)))
        );
    });

    device.on("mag", (trackerName: string, magStatus: string) => {
        if (!trackerName || !magStatus) return;
        mainWindow.webContents.send("device-mag", { trackerName, magStatus });
    });

    let clickCounts: { [key: string]: number } = {};
    let clickTimeouts: { [key: string]: NodeJS.Timeout } = {};

    device.on("button", (trackerName: string, buttonPressed: string, isOn: boolean) => {
        if (!trackerName || !buttonPressed || !isOn) return;

        let key = `${trackerName}-${buttonPressed}`;

        if (!clickCounts[key]) clickCounts[key] = 0;
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
        if (!trackerName || !rawRotation || !rawGravity || !connectedDevices.has(trackerName)) return;

        // YOU ARE NOT SERIOUS. ALRIGHT.
        // I HAD BEEN TRYING TO SOLVE TRACKING ISSUES FOR AGES, AND IT TURNS OUT BOTH QUATERNIONS WERE USING DIFFERENT LAYOUTS
        // ONE WAS XYZW AND THE OTHER WAS WXYZ. THAT'S WHY THERE WAS TRACKING ISSUES. WHY.
        // -jovannmc

        // Convert rotation to quaternion
        const quaternion = new Quaternion(rawRotation.x, rawRotation.y, rawRotation.z, rawRotation.w);

        // Convert the quaternion to Euler angles
        const eulerRadians = new BetterQuaternion(quaternion.w, quaternion.x, quaternion.y, quaternion.z).toEuler(
            "XYZ"
        );

        // Convert the rotation to degrees
        const rotation = {
            x: eulerRadians[0] * (180 / Math.PI),
            y: eulerRadians[1] * (180 / Math.PI),
            z: eulerRadians[2] * (180 / Math.PI),
        };

        const gravity = new Vector(rawGravity.x, rawGravity.y, rawGravity.z);

        let tracker = connectedDevices.get(trackerName);
        if (!tracker || !rotation || !gravity || !quaternion || !eulerRadians) {
            error(`Error processing IMU data for ${trackerName}, skipping...`);
            return;
        }

        tracker.sendRotationData(0, RotationDataType.NORMAL, quaternion, 0);
        tracker.sendAcceleration(0, gravity);

        mainWindow.webContents.send("device-data", {
            trackerName,
            rotation,
            gravity,
            rawRotation,
            rawGravity,
        });
    });

    const MAX_BATTERY_READINGS = 5;
    const batteryReadingsMap = new Map<string, { percentages: number[]; voltages: number[] }>();
    device.on("battery", (trackerName: string, batteryRemaining: number, batteryVoltage: number) => {
        if (!trackerName || !batteryRemaining) return;

        if (!connectedDevices.has(trackerName) && trackerName !== "HaritoraXWired") {
            // If tracker is not connected, store battery info for COM wireless tracker to be used later when the tracker is connected
            // Doing this because the GX dongles immediately report the last known battery info when the COM port opens
            deviceBattery[trackerName] = { batteryRemaining, batteryVoltage };
        }

        if (!batteryReadingsMap.has(trackerName))
            batteryReadingsMap.set(trackerName, { percentages: [], voltages: [] });
        const readings = batteryReadingsMap.get(trackerName);

        readings.percentages.push(batteryRemaining);
        readings.voltages.push(batteryVoltage);
        if (readings.percentages.length > MAX_BATTERY_READINGS) {
            // Remove oldest readings
            readings.percentages.shift();
            readings.voltages.shift();
        }

        // Calculate the "stable average" battery percentage and voltage
        const averageBatteryRemaining = readings.percentages.reduce((a, b) => a + b, 0) / readings.percentages.length;
        const averageBatteryVoltage = readings.voltages.reduce((a, b) => a + b, 0) / readings.voltages.length;

        // keeping this here just in case i want to switch to it since i need to do testing
        // below is the code for lowest battery remaining and voltage instead of a "stable average"
        // const lowestBatteryRemaining = Math.min(...readings.percentages);
        // const lowestBatteryVoltage = Math.min(...readings.voltages);
        const stableBatteryRemaining = parseFloat(averageBatteryRemaining.toFixed(2));
        const stableBatteryVoltage = parseFloat((averageBatteryVoltage / 1000).toFixed(4));

        if (trackerName === "HaritoraXWired") {
            // Change battery info for all trackers (wired)
            connectedDevices.forEach((tracker) => {
                if (tracker) tracker.changeBatteryLevel(stableBatteryVoltage, stableBatteryRemaining);
            });
        } else {
            // Change battery info for the specific tracker
            const tracker = connectedDevices.get(trackerName);
            if (tracker) tracker.changeBatteryLevel(stableBatteryVoltage, stableBatteryRemaining);
        }

        mainWindow.webContents.send("device-battery", {
            trackerName,
            batteryRemaining: stableBatteryRemaining,
            batteryVoltage: stableBatteryVoltage,
        });

        log(`Received battery data for ${trackerName}: ${stableBatteryRemaining}% (${stableBatteryVoltage}V)`);
    });

    device.on("log", (msg: string) => {
        log(msg, "haritorax-interpreter");
    });

    device.on("error", (msg: string, exceptional: boolean) => {
        if (exceptional) {
            if (msg.includes(ErrorType.ConnectionStartError)) {
                handleError(msg, ErrorType.ConnectionStartError, handleConnectionStartError);
            }

            // TODO: add more error handling
        } else {
            error(msg, "haritorax-interpreter");
        }
    });
}

function handleError(msg: string, errorType: ErrorType, handler: (msg: string) => void) {
    const now = Date.now();
    if (now - lastErrorShownTime[errorType] >= errorCooldownPeriod) {
        lastErrorShownTime[errorType] = now;
        handler(msg);
    }
}

async function handleConnectionStartError(err: any) {
    error(`Failed to start tracker connection: ${err}`, "haritorax-interpreter");
    mainWindow.webContents.send("set-status", "main.status.failed");
    dialog.showErrorBox(
        await translate("dialogs.connectionFailed.title"),
        await translate("dialogs.connectionFailed.message")
    );
}

/*
 * SlimeVR Forwarding
 */

function setupTrackerEvents(tracker: EmulatedTracker, isHeartbeat = false) {
    const trackerName =
        Array.from(connectedDevices.keys()).find((key) => connectedDevices.get(key) === tracker) ||
        (isHeartbeat ? "(HEARTBEAT)" : undefined);

    tracker.on("ready", () => {
        log(`Tracker ${trackerName} is ready to search for SlimeVR server...`, "@slimevr/emulated-tracker");
    });

    tracker.on("searching-for-server", () => {
        log(`Tracker ${trackerName} is searching for SlimeVR server...`, "@slimevr/emulated-tracker");
    });

    tracker.on("connected-to-server", (ip: string, port: number) => {
        log(`Tracker ${trackerName} connected to SlimeVR server on ${ip}:${port}`, "@slimevr/emulated-tracker");
        mainWindow.webContents.send("device-connected-to-server", trackerName);

        tracker.sendTemperature(0, 420.69);
        tracker.sendSignalStrength(0, 69);

        if (!isHeartbeat) return;
        foundSlimeVR = true;
    });

    tracker.on("disconnected-from-server", (reason) => {
        log(`Tracker ${trackerName} disconnected from SlimeVR server due to: ${reason}`, "@slimevr/emulated-tracker");
    });

    tracker.on("error", (err: Error) => {
        error(`Tracker ${trackerName} error: ${err}}`, "@slimevr/emulated-tracker");
    });

    tracker.on("unknown-incoming-packet", (packet: any) => {
        error(`Tracker ${trackerName} unknown packet type ${packet.type}`, "@slimevr/emulated-tracker");
    });

    tracker.on("unknown-incoming-packet", (buf: Buffer) =>
        error(`Tracker ${trackerName} unknown incoming packet: ${buf.toString()}`, "@slimevr/emulated-tracker")
    );

    if (loggingMode === 3) {
        tracker.on("outgoing-packet", (packet: any) => {
            log(`Tracker ${trackerName} outgoing packet: ${packet}`, "@slimevr/emulated-tracker");
        });
    }
}

const heartbeatTracker = new EmulatedTracker(
    new MACAddress([0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
    app.getVersion() + "-heartbeat",
    new FirmwareFeatureFlags(new Map([])),
    BoardType.CUSTOM,
    MCUType.UNKNOWN
);

setupTrackerEvents(heartbeatTracker, true);
await heartbeatTracker.init();

/*
 * Logging
 */

let hasInitializedLogDir = false;

async function logMessage(level: string, msg: string, where: string) {
    const date = new Date();
    const logLevel = level.toUpperCase();
    const consoleLogFn = logLevel === "ERROR" || "SEVERE" ? console.error : console.log;
    const formattedMessage = `${date.toTimeString()} -- ${logLevel} -- (${where}): ${msg}`;

    consoleLogFn(formattedMessage);

    if (!canLogToFile) return;

    const logDir = path.resolve(mainPath, "logs");
    await initializeLogDirectory(logDir);

    const logPath = path.join(logDir, `log-${formatDateForFile(date)}.txt`);
    await logToFile(logPath, `${formattedMessage}\n`);
}

function log(msg: string, where = "main") {
    logMessage("info", msg, where);
}

function error(msg: string, where = "main", exceptional = false) {
    if (exceptional) {
        logMessage("severe", msg, where);
        throw new Error(msg);
    } else {
        logMessage("error", msg, where);
    }
}

async function initializeLogDirectory(logDir: PathLike) {
    if (hasInitializedLogDir) return;
    try {
        await fs.promises.access(logDir);
    } catch {
        await fs.promises.mkdir(logDir, { recursive: true });
    }
    hasInitializedLogDir = true;
}

async function logToFile(logPath: PathLike, message: string) {
    try {
        await fs.promises.appendFile(logPath, message);
    } catch (err) {
        error(`Error logging to file: ${err}`);
    }
}

function formatDateForFile(date: Date): string {
    return `${date.getFullYear()}${("0" + (date.getMonth() + 1)).slice(-2)}${("0" + date.getDate()).slice(-2)}`;
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
