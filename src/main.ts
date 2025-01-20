/*
 * Global imports and variables
 */

import { autoDetect } from "@serialport/bindings-cpp";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import fs, { PathLike } from "fs";
import { FPSMode, HaritoraX, MagStatus, SensorAutoCorrection, SensorMode, TrackerModel } from "haritorax-interpreter";
import path, { dirname } from "path";
import { fileURLToPath, format } from "url";
const Binding = autoDetect();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mainPath = app.isPackaged ? path.dirname(app.getPath("exe")) : __dirname;
const configPath = path.resolve(mainPath, "config.json");
const isMac = process.platform === "darwin";
// don't mess with this or languages will fail to load cause of how the project is structured, lol
// i hate how this is done.
const languagesPath = path.resolve(
    mainPath,
    isMac ? ".." : "",
    app.isPackaged ? (isMac ? "Resources/languages" : "resources/languages") : "languages"
);
let mainWindow: BrowserWindow;
let trackerSettingsWindow: BrowserWindow;
let onboardingWindow: BrowserWindow;
let pairingWindow: BrowserWindow;
let device: HaritoraX;
let connectedDevices = new Map<string, EmulatedTracker>();
let deviceBattery: {
    [key: string]: { batteryRemaining: number; batteryVoltage: number };
} = {};

/*
 * Renderer variables
 */

let firstLaunch = false;
let isClosing = false;
let hasInitializedLogDir = false;
let foundSlimeVR = false;
let serverAddress = "255.255.255.255";
let serverPort = 6969;

let canLogToFile = true;
let loggingMode = 1;
let heartbeatInterval = 2000;
let wirelessTrackerEnabled = false;
let wiredTrackerEnabled = false;
let autoOff = false;
let appUpdatesEnabled = true;
let translationsUpdatesEnabled = true;
let updateChannel = "stable";
// this variable is literally only used so i can fix a stupid issue where with both BT+COM enabled, it sometimes connects the BT trackers again directly after again, breaking the program
// why.. i don't god damn know. i need to do a rewrite of the rewrite fr, i'm going crazy
// -jovannmc
let connectionActive = false;

let resources;
let comPorts = await Binding.list();

/*
 * Initialization
 */

// Force iGPU if available
app.commandLine.appendSwitch("force_low_power_gpu");

try {
    await fs.promises.access(configPath);

    // Read and parse the config file
    const data = await fs.promises.readFile(configPath, "utf8");

    // Check if the config file is empty (contains only "{}")
    if (data.trim() === "{}") throw new Error();

    const config: { [key: string]: any } = JSON.parse(data);

    // Set configuration variables
    canLogToFile = config.global?.debug?.canLogToFile ?? true;
    wirelessTrackerEnabled = config.global?.trackers?.wirelessTrackerEnabled ?? false;
    wiredTrackerEnabled = config.global?.trackers?.wiredTrackerEnabled ?? false;
    autoOff = config.global?.autoOff ?? false;
    appUpdatesEnabled = config.global?.updates?.appUpdatesEnabled ?? true;
    translationsUpdatesEnabled = config.global?.updates?.translationsUpdatesEnabled ?? true;
    updateChannel = config.global?.updates?.updateChannel ?? "stable";
    heartbeatInterval = config.global?.trackers?.heartbeatInterval ?? 2000;
    loggingMode = config.global?.debug?.loggingMode ?? 1;

    serverAddress = config.global?.serverAddress ?? "255.255.255.255";
    serverPort = config.global?.serverPort ?? 6969;
} catch (err) {
    // If the config file doesn't exist or is empty, create it
    log("First launch, creating config file and showing onboarding screen (after load)");
    await fs.promises.writeFile(configPath, "{}");
    firstLaunch = true;
}

/*
 * Translations (i18next)
 */

resources = await loadTranslations();

async function loadTranslations() {
    const files = await fs.promises.readdir(languagesPath);
    const resources: any = {};
    log(`Loading translations from "${languagesPath}"`, "i18n");

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
 * Update checking
 */

async function getLatestRelease() {
    log("Fetching the latest release from GitHub...", "updater");
    const response = await fetch("https://api.github.com/repos/OCSYT/SlimeTora/releases");
    if (!response.ok) {
        warn(`Failed to fetch releases: ${response.statusText}`, "updater");
        throw new Error("Failed to fetch releases");
    }
    const releases = await response.json();

    let latestRelease;
    if (updateChannel === "stable") {
        latestRelease = releases.find((release: { prerelease: any }) => !release.prerelease);
    } else if (updateChannel === "beta") {
        latestRelease = releases.find((release: { prerelease: any }) => release.prerelease);
    }

    if (!latestRelease) {
        warn(`No suitable release found for update channel: ${updateChannel}`, "updater");
        throw new Error("No suitable release found");
    }

    log(`Fetched latest "${updateChannel}" release: ${latestRelease.tag_name}`, "updater");
    return latestRelease.tag_name;
}

function isNewerVersion(latestVersion: string, currentVersion: string): boolean {
    const parseVersion = (version: string) => {
        const [main, pre] = version.replace(/^v/, "").split("-");
        const mainParts = main.split(".").map(Number);
        const preParts: any[] | RegExpMatchArray = pre ? pre.match(/\d+|\D+/g) : [];
        return { mainParts, preParts };
    };

    const latest = parseVersion(latestVersion);
    const current = parseVersion(currentVersion);

    for (let i = 0; i < latest.mainParts.length; i++) {
        if (latest.mainParts[i] > current.mainParts[i]) {
            return true;
        }
        if (latest.mainParts[i] < current.mainParts[i]) {
            return false;
        }
    }

    // Compare pre-release version (-betaX) part if main part (vx.y.z) is identical
    // tbh idk how this works, but it does so thanks copilot
    for (let i = 0; i < Math.max(latest.preParts.length, current.preParts.length); i++) {
        if (latest.preParts[i] === undefined) return false;
        if (current.preParts[i] === undefined) return true;
        if (isNaN(Number(latest.preParts[i])) || isNaN(Number(current.preParts[i]))) {
            if (latest.preParts[i] > current.preParts[i]) return true;
            if (latest.preParts[i] < current.preParts[i]) return false;
        } else {
            if (Number(latest.preParts[i]) > Number(current.preParts[i])) return true;
            if (Number(latest.preParts[i]) < Number(current.preParts[i])) return false;
        }
    }

    log("The versions are identical or newer.", "updater");
    return false;
}

async function checkForAppUpdates() {
    try {
        log(`Checking for latest "${updateChannel}" updates...`, "updater");
        const latestVersion = await getLatestRelease();
        const currentVersion = app.getVersion();
        const versionType = currentVersion.includes("beta") ? "beta" : "stable";

        log(
            `Latest "${updateChannel}" version: ${latestVersion}, current "${versionType}" version: ${currentVersion}`,
            "updater"
        );
        if (isNewerVersion(latestVersion, currentVersion)) {
            log("Update available, notifying user...", "updater");

            const translatedTitle = await translate("dialogs.updates.app.available.title");
            const translatedMessage = await translate("dialogs.updates.app.available.message");
            const translatedDetail = await translate("dialogs.updates.app.available.detail");
            const translatedButtonYes = await translate("dialogs.updates.app.available.buttons.yes");
            const translatedButtonNo = await translate("dialogs.updates.app.available.buttons.no");
            const translatedVersionType = await translate(`dialogs.updates.app.available.versionType.${versionType}`);

            const response = await dialog.showMessageBox({
                type: "info",
                buttons: [translatedButtonYes, translatedButtonNo],
                title: translatedTitle,
                message: translatedMessage
                    .replace("{versionType}", translatedVersionType)
                    .replace("{latestVersion}", latestVersion),
                detail: translatedDetail,
                cancelId: 1,
            });

            log(`User response: ${response.response}`, "updater");

            if (response.response === 0) shell.openExternal("https://github.com/OCSYT/SlimeTora/releases/latest");
        } else {
            log("No app updates available.", "updater");
        }
    } catch (err) {
        warn(`Failed to check for updates: ${err}`, "updater");
    }
}

async function fetchTranslationFiles() {
    log(`Fetching translation files from GitHub...`, "updater");
    const response = await fetch("https://api.github.com/repos/OCSYT/SlimeTora/contents/src/languages");
    if (!response.ok) {
        warn(`Failed to fetch translation files: ${response.statusText}`, "updater");
        throw new Error("Failed to fetch translation files");
    }
    const files = await response.json();
    log(`Fetched remote translation files: ${files.map((file: any) => file.name).join(", ")}`, "updater");
    return files;
}

async function downloadTranslationUpdates(updates: any[]) {
    for (const file of updates) {
        log(`Downloading ${file.name}...`, "updater");
        const response = await fetch(file.download_url);
        if (!response.ok) {
            warn(`Failed to download "${file.name}": ${response.statusText}`, "updater");
            throw new Error(`Failed to download "${file.name}"`);
        }
        const content = await response.text();
        fs.writeFileSync(path.join(languagesPath, file.name), content);
        log(`Downloaded and saved "${file.name}" to: ${languagesPath}`, "updater");
    }
}

async function checkForTranslationUpdates() {
    try {
        log(`Checking for translation updates...`, "updater");
        const remoteFiles = await fetchTranslationFiles();
        const localFiles = fs.readdirSync(languagesPath);
        log(`Local translation files: ${localFiles.join(", ")}`, "updater");

        const updates = [];
        for (const remoteFile of remoteFiles) {
            const localFilePath = path.join(languagesPath, remoteFile.name);
            if (!localFiles.includes(remoteFile.name)) {
                log(`New translation file found: ${remoteFile.name}`, "updater");
                updates.push(remoteFile);
                continue;
            }

            let localContent = fs.readFileSync(localFilePath, "utf-8");

            // Normalize newlines to LF for local content
            localContent = localContent.replace(/\r\n/g, "\n");
            const localContentSize = Buffer.byteLength(localContent, "utf-8");

            log(
                `Comparing "${remoteFile.name}" - local size: ${localContentSize}, remote size: ${remoteFile.size}`,
                "updater"
            );
            if (remoteFile.size !== localContentSize) {
                log(`Update available for "${remoteFile.name}"`, "updater");
                updates.push(remoteFile);
            }
        }

        if (updates.length > 0) {
            log(`Translation updates available: ${updates.map((file) => file.name).join(", ")}`, "updater");

            const translatedTitleAvailable = await translate("dialogs.updates.translations.available.title");
            const translatedMessageAvailable = await translate("dialogs.updates.translations.available.message");
            const translatedDetailAvailable = await translate("dialogs.updates.translations.available.detail");
            const translatedButtonYes = await translate("dialogs.updates.translations.available.buttons.yes");
            const translatedButtonNo = await translate("dialogs.updates.translations.available.buttons.no");

            const response = await dialog.showMessageBox({
                type: "info",
                buttons: [translatedButtonYes, translatedButtonNo],
                title: translatedTitleAvailable,
                message: translatedMessageAvailable.replace("{files}", updates.map((file) => file.name).join(", ")),
                detail: translatedDetailAvailable,
                cancelId: 1,
            });

            log(`User response: ${response.response}`, "updater");

            if (response.response === 0) {
                await downloadTranslationUpdates(updates);

                const translatedTitleDownloaded = await translate("dialogs.updates.translations.downloaded.title");
                const translatedMessageDownloaded = await translate("dialogs.updates.translations.downloaded.message");
                const translatedDetailDownloaded = await translate("dialogs.updates.translations.downloaded.detail");

                await dialog.showMessageBox({
                    type: "info",
                    buttons: ["OK"],
                    title: translatedTitleDownloaded,
                    message: translatedMessageDownloaded,
                    detail: translatedDetailDownloaded,
                });

                log(`Translation updates downloaded and applied.`, "updater");
            } else {
                log(`Translation updates download canceled by user.`, "updater");
            }
        } else {
            log(`No translation updates available.`, "updater");
        }
    } catch (err) {
        warn(`Failed to check for translation updates: ${err}`, "updater");
    }
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
                error(`Failed to de-initialize device`, "connection", err);
            }
        }
    });
    connectedDevices.clear();
}

const createWindow = async () => {
    mainWindow = createBrowserWindow("SlimeTora: Main", "index.html", "en", null, 900, 700);

    mainWindow.webContents.on("did-finish-load", async () => {
        mainWindow.webContents.send("localize", resources);
        mainWindow.webContents.send("version", app.getVersion());
        mainWindow.webContents.send("set-switch", { id: "accelerometer-switch", state: true });

        if (firstLaunch) onboarding("en");

        if (appUpdatesEnabled) await checkForAppUpdates();
        if (translationsUpdatesEnabled) await checkForTranslationUpdates();

        if (canLogToFile && loggingMode === 3) {
            showMessage("dialogs.maxLoggingWarning.title", "dialogs.maxLoggingWarning.message");
        }

        mainWindow.setTitle(await translate("main.windowTitle.main"));
    });
};

const closeApp = async () => {
    if (isClosing) return;
    isClosing = true;

    if (autoOff) {
        log("Auto-off is enabled, turning off all trackers (if available)...", "connection");
        const activeTrackers = Array.from(connectedDevices.keys());
        const powerOffPromises = activeTrackers.map(async (tracker) => {
            await device.powerOffTracker(tracker as string);
            log(`Turned off tracker: ${tracker}`, "connection");
        });

        // Wait for all trackers to power off
        await Promise.all(powerOffPromises);
    }

    clearTrackers();

    if (device && device.getConnectionModeActive("bluetooth")) device.stopConnection("bluetooth");
    if (device && device.getConnectionModeActive("com")) device.stopConnection("com");

    device = undefined;
    mainWindow = null;

    app.quit();
};

app.on("ready", createWindow);
app.on("window-all-closed", () => {
    // Don't close the app on macOS when all windows are closed (let user quit via menu bar)
    if (process.platform !== "darwin") {
        closeApp();
    }
});
app.on("before-quit", closeApp);

/*
 * Renderer handlers
 */

function createBrowserWindow(
    title: string,
    htmlFile: string,
    query: string | ParsedUrlQueryInput,
    parent: BrowserWindow,
    width: number = 950,
    height: number = 750
): BrowserWindow {
    let window = new BrowserWindow({
        title: title,
        autoHideMenuBar: true,
        width: width,
        height: height,
        modal: true, // prevent interaction with "parent" window until closed
        parent: parent,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: true,
            preload: path.join(__dirname, "preload.mjs"),
            spellcheck: false,
            sandbox: false, // fixes startup crashes due to GPU process, shouldn't be too large of a security risk as we're not loading any external content/connect to internet
        },
        icon: path.join(__dirname, "static/images/icon.ico"),
    });

    window.loadURL(
        format({
            pathname: path.join(__dirname, `static/html/${htmlFile}`),
            protocol: "file:",
            slashes: true,
            query: query,
        })
    );

    window.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });

    return window;
}

async function onboarding(language: string) {
    log("Showing onboarding screen");
    const title = await translate("main.windowTitle.onboarding");
    onboardingWindow = createBrowserWindow(title, "onboarding.html", { language: language }, mainWindow);
}

async function pairing(ports: string[]) {
    log("Showing pairing screen");
    const title = await translate("main.windowTitle.pairing");
    pairingWindow = createBrowserWindow(title, "pairing.html", { ports: JSON.stringify(ports) }, mainWindow);
}

async function showMessage(
    title: string,
    message: string,
    blocking = false,
    translateTitle = true,
    translateMessage = true,
    buttons = ["OK"]
) {
    if (isClosing) return false;
    const show = blocking ? dialog.showMessageBoxSync : dialog.showMessageBox;
    const translatedTitle = translateTitle ? await translate(title) : title;
    const translatedMessage = translateMessage ? await translate(message) : message;

    const options: Electron.MessageBoxOptions = {
        title: translatedTitle,
        message: translatedMessage,
        buttons: buttons,
    };

    return await show(options);
}

async function showError(
    title: string,
    message: string,
    blocking = true,
    translateTitle = true,
    translateMessage = true
) {
    if (isClosing) return false;
    const translatedTitle = translateTitle ? await translate(title) : title;
    const translatedMessage = translateMessage ? await translate(message) : message;

    if (blocking) {
        dialog.showErrorBox(translatedTitle, translatedMessage);
    } else {
        const options: Electron.MessageBoxOptions = {
            title: translatedTitle,
            message: translatedMessage,
            type: "error",
        };

        dialog.showMessageBox(options);
    }
    return true;
}

ipcMain.on("log", (_event, message: string, where = "renderer") => {
    log(message, where);
});

ipcMain.on("warn", (_event, message: string, where = "renderer") => {
    warn(message, where);
});

ipcMain.on("error", (_event, message: string, where = "renderer") => {
    error(message, where);
});

ipcMain.on("update-titles", async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setTitle(await translate("main.windowTitle.main"));
    }
    if (onboardingWindow && !onboardingWindow.isDestroyed()) {
        onboardingWindow.setTitle(await translate("main.windowTitle.onboarding"));
    }
    if (pairingWindow && !pairingWindow.isDestroyed()) {
        pairingWindow.setTitle(await translate("main.windowTitle.pairing"));
    }
    if (trackerSettingsWindow && !trackerSettingsWindow.isDestroyed()) {
        trackerSettingsWindow.setTitle(await translate("main.windowTitle.settings"));
    }
});

ipcMain.handle("get-os", () => {
    return process.platform;
});

ipcMain.handle("show-message", async (_event, arg) => {
    const {
        title,
        message,
        blocking = false,
        translateTitle = true,
        translateMessage = true,
        buttons = ["OK"],
    }: {
        title: string;
        message: string;
        blocking: boolean;
        translateTitle: boolean;
        translateMessage: boolean;
        buttons: string[];
    } = arg;

    return await showMessage(title, message, blocking, translateTitle, translateMessage, buttons);
});

ipcMain.handle("show-error", async (_event, arg) => {
    const {
        title,
        message,
        blocking = true,
        translateTitle = true,
        translateMessage = true,
    }: { title: string; message: string; blocking: boolean; translateTitle: boolean; translateMessage: boolean } = arg;

    return await showError(title, message, blocking, translateTitle, translateMessage);
});

ipcMain.on("show-onboarding", (_event, language) => {
    onboarding(language);
});

ipcMain.on("show-pairing", (_event, ports) => {
    pairing(ports);
});

ipcMain.handle("translate", async (_event, arg: string) => {
    return await translate(arg);
});

ipcMain.handle("get-com-ports", async (_event, arg: string) => {
    if (!arg) {
        const isLinux = process.platform === "linux";
        return comPorts
            .map((port: any) => port.path)
            .filter((path: string) => (isLinux ? /\/dev\/tty(USB|ACM)\d+/.test(path) : true))
            .sort();
    }

    if (!device) {
        initializeDevice(true);
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

ipcMain.on("set-log-to-file", (_event, arg) => {
    canLogToFile = arg;
    log(`Logging to file set to: ${arg}`, "settings");
});

ipcMain.on("set-logging", (_event, arg) => {
    loggingMode = arg;
    log(`Logging mode set to: ${arg}`, "settings");
});

ipcMain.on("set-wireless-tracker", (_event, arg) => {
    wirelessTrackerEnabled = arg;
    log(`Wireless tracker enabled set to: ${arg}`, "settings");
});

ipcMain.on("set-wired-tracker", (_event, arg) => {
    wiredTrackerEnabled = arg;
    log(`Wired tracker enabled set to: ${arg}`, "settings");
});

ipcMain.on("set-tracker-heartbeat-interval", (_event, arg) => {
    heartbeatInterval = arg;
    log(`Tracker heartbeat interval set to: ${arg}`, "settings");
});

ipcMain.on("set-auto-off", (_event, arg) => {
    autoOff = arg;
    log(`Auto-off set to: ${arg}`, "settings");
});

ipcMain.on("set-server-address", (_event, arg) => {
    serverAddress = arg;
    log(`Server address set to: ${arg}`, "settings");
});

ipcMain.on("set-server-port", (_event, arg) => {
    serverPort = arg;
    log(`Server port set to: ${arg}`, "settings");
});

ipcMain.on("fix-trackers", async () => {
    log("Fixing soft-bricked (boot-looping) trackers...", "connection");

    // @ts-ignore
    const ports: ActivePorts = device.getComInstance().getActivePorts();
    // Sensor mode 2, 50 FPS, Accel sensor auto correction, ankle disabled
    const commands = ["o0:00000000101000", `o1:00000000101000`];

    const dialogOptions: Electron.MessageBoxOptions = {
        type: "info",
        buttons: ["OK"],
        title: await translate("dialogs.fixTrackers.title"),
        message: await translate("dialogs.fixTrackers.message"),
    };

    const startTime = Date.now();
    let commandCount = 0;

    const sendCommands = async () => {
        for (const port in ports) {
            for (const command of commands) {
                ports[port].write(command, (err: any) => {
                    if (err) {
                        error(`Error writing data to serial port ${port}: ${err}`, "connection");
                    }
                });
                commandCount++;
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        }
    };

    const intervalId = setInterval(sendCommands, 100);
    await dialog.showMessageBox(dialogOptions);
    clearInterval(intervalId);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    log(
        `Dialog was open for ${duration} seconds, accounting for ${commandCount} times sent to ports: ${Object.keys(
            ports
        ).join(", ")}`,
        "connection"
    );
});

ipcMain.on("open-support-page", async () => {
    await shell.openExternal("https://github.com/OCSYT/SlimeTora/wiki/FAQ#i-found-an-issuebug");
});

ipcMain.on("open-logs-folder", async () => {
    const logDir = path.resolve(mainPath, "logs");
    try {
        await fs.promises.access(logDir);
        await shell.openPath(logDir);
    } catch (err) {
        error(`Logs directory does not exist`, "main", err);
        await showError("dialogs.noLogsFolder.title", "dialogs.noLogsFolder.message");
    }
});

ipcMain.on("open-tracker-settings", async (_event, arg: string) => {
    const title = await translate("main.windowTitle.settings");
    trackerSettingsWindow = createBrowserWindow(
        title.replace("{trackerName}", arg),
        "settings.html",
        { trackerName: arg },
        mainWindow,
        850,
        650
    );

    trackerSettingsWindow.webContents.on("did-finish-load", () => {
        // send trackerName to window
        trackerSettingsWindow.webContents.send("trackerName", arg);
    });
});

ipcMain.handle("get-tracker-from-info", (_event, arg) => {
    const { port, portId } = arg;
    if (!port || !portId) return null;
    return device.getComInstance().getTrackerFromInfo(port, portId);
});

ipcMain.handle("manage-tracker", async (_event, arg) => {
    const { port, portId, status } = arg;
    log(`Managing tracker for port ${port} (ID ${portId}, status: ${status})`, "pairing");

    if (!device) error("Device instance wasn't started correctly", "pairing");

    if (status === "paired") {
        device.getComInstance().unpair(port, portId);
        log(`Unpaired tracker for port ${port} (ID ${portId})`, "pairing");
        return false;
    } else {
        device.getComInstance().pair(port, portId);
        log(`Started pairing tracker for port ${port} (ID ${portId})`, "pairing");
        return true;
    }
});

/*
 * Renderer tracker/device handlers
 */

ipcMain.handle("autodetect", async () => {
    log("Running auto-detection...", "detect");
    device = undefined;

    log("Initializing new HaritoraX instance...", "detect");
    initializeDevice();

    log("Getting available devices...", "detect");

    let trackerSettingsTimeout: NodeJS.Timeout = null;
    const devices = await device.getAvailableDevices();
    const waitForTrackerSettings = new Promise(async (resolve) => {
        let comPorts;
        if (devices.includes("Bluetooth") && devices.includes("HaritoraX Wireless")) {
            log("Bluetooth & HaritoraX Wireless devices found, starting connection...", "detect");
            device.startConnection("bluetooth");
        }
        if (devices.includes("GX6")) {
            log("GX6 device found, starting connection...", "detect");
            comPorts = await device.getDevicePorts("GX6");
            device.startConnection("com", comPorts, heartbeatInterval);
        }
        if (devices.includes("GX2")) {
            log("GX2 device found, starting connection...", "detect");
            comPorts = await device.getDevicePorts("GX2");
            device.startConnection("com", comPorts, heartbeatInterval);
        }
        if (devices.includes("HaritoraX Wired")) {
            log("HaritoraX Wired device found, starting connection...", "detect");
            comPorts = await device.getDevicePorts("HaritoraX Wired");
            device.startConnection("com", comPorts, heartbeatInterval);
        }

        trackerSettingsTimeout = setTimeout(() => {
            log("No tracker settings received after 5 seconds, resolving with null", "detect");
            device.stopConnection("com");
            device.stopConnection("bluetooth");
            resolve(null);
        }, 5000);

        device.once("connect", async (deviceID: string, connectionMode: string) => {
            log(`Connected to tracker "${deviceID}" via "${connectionMode}", getting settings...`, "detect");
            const trackerSettings = await device.getTrackerSettings(deviceID, true);
            log(`Got tracker settings for "${deviceID}": ${JSON.stringify(trackerSettings)}`, "detect");

            clearTimeout(trackerSettingsTimeout);

            device.stopConnection("com");
            device.stopConnection("bluetooth");

            resolve(trackerSettings);
        });
    });

    let trackerSettings = null;

    if (devices.length !== 0) {
        log("Waiting for tracker settings...", "detect");
        trackerSettings = await waitForTrackerSettings;
    } else {
        log("No devices found", "detect");
        clearTimeout(trackerSettingsTimeout);
    }

    if (device) {
        device.removeAllListeners();
        device = null;
    }

    return { devices, trackerSettings };
});

ipcMain.on("start-connection", async (_event, arg) => {
    const { types, ports, isActive } = arg;

    log(`Start connection with: ${JSON.stringify(arg)}`, "connection");

    if (isActive) {
        warn("Tried to start connection while already active", "connection");
        return false;
    }

    if (!isValidDeviceConfiguration(types, ports)) {
        warn("Invalid device configuration", "connection");
        return false;
    }

    if (shouldInitializeNewDevice()) initializeDevice();

    mainWindow.webContents.send("set-status", "main.status.searching");
    if (types.includes("bluetooth")) await device.startConnection("bluetooth");
    // @ts-ignore
    if (types.includes("com") && ports) await device.startConnection("com", ports, heartbeatInterval);
    connectionActive = true;

    await notifyConnectedDevices();

    // Set a timeout to warn user if the SlimeVR server wasn't found
    setTimeout(() => {
        if (foundSlimeVR || !connectionActive) return;

        warn("SlimeVR server seemingly not found, warning user...", "connection");
        showError("dialogs.slimevrNotFound.title", "dialogs.slimevrNotFound.message", false);
    }, 4000);
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

function initializeDevice(forceDisableLogging: boolean = false) {
    const trackerType = wiredTrackerEnabled ? TrackerModel.Wired : TrackerModel.Wireless;
    const effectiveLoggingMode = forceDisableLogging ? 1 : loggingMode;
    log(`Creating new HaritoraX ${trackerType} instance with logging mode ${effectiveLoggingMode}...`, "connection");
    const loggingOptions = {
        1: [false, false, false, false],
        2: [true, false, false, true],
        3: [true, false, true, true],
    };
    const [logging, imuProcessing, rawData, printWrites] = (loggingOptions as { [key: string]: (boolean | boolean)[] })[
        effectiveLoggingMode.toString()
    ] || [false, false, false, false];
    device = new HaritoraX(trackerType, logging, imuProcessing, rawData, printWrites);

    startDeviceListeners();
}

async function notifyConnectedDevices(): Promise<void> {
    const activeTrackers = Array.from(new Set(device.getActiveTrackers()));
    if (!activeTrackers || activeTrackers.length === 0) return;
    for (const trackerName of activeTrackers) await addTracker(trackerName as string);
    log("Connected devices: " + JSON.stringify(activeTrackers), "connection");
}

ipcMain.on("stop-connection", () => {
    if (!device) {
        error("Device instance wasn't started correctly", "connection");
        return;
    }

    const stopConnectionIfActive = (mode: string) => {
        if (!device.getConnectionModeActive(mode)) return;
        device.stopConnection(mode);
        log(`Stopped ${mode} connection`, "connection");
    };

    stopConnectionIfActive("bluetooth");
    stopConnectionIfActive("com");

    clearTrackers();

    // Clear all timeouts
    for (const key in trackerTimeouts) {
        if (trackerTimeouts.hasOwnProperty(key)) {
            clearTimeout(trackerTimeouts[key]);
        }
    }

    batteryReadingsMap.clear();

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

        deviceBattery[trackerName] = null;
    } else {
        device.fireTrackerBattery(trackerName);
    }
});

ipcMain.handle("fire-tracker-mag", (_event, trackerName: string) => {
    device.fireTrackerMag(trackerName);
});

ipcMain.handle("get-tracker-settings", async (_event, arg) => {
    const { trackerName, forceBLE }: { trackerName: string; forceBLE: boolean } = arg;
    let settings = await device.getTrackerSettings(trackerName, forceBLE);
    log(`Got tracker settings: ${JSON.stringify(settings)}`, "settings");
    return settings;
});

ipcMain.handle("get-channel", async (_event, arg) => {
    const { port }: { port: string } = arg;
    return device.getComInstance().getPortChannel(port);
});

ipcMain.on("set-tracker-settings", async (_event, arg) => {
    const {
        deviceID,
        sensorMode,
        fpsMode,
        sensorAutoCorrection,
    }: {
        deviceID: string;
        sensorMode: SensorMode;
        fpsMode: FPSMode;
        sensorAutoCorrection: SensorAutoCorrection[];
    } = arg;

    // Validate input parameters
    if (!sensorMode || !fpsMode || !sensorAutoCorrection) {
        warn(`Invalid settings received: ${JSON.stringify(arg)}`, "settings");
        return;
    }

    // Log old tracker settings
    const oldSettings = await device.getTrackerSettings(deviceID, true);
    log(`Old tracker settings: ${JSON.stringify(oldSettings)}`, "settings");

    // Make sure we get unique entries
    const uniqueSensorAutoCorrection = [...new Set(sensorAutoCorrection)];

    // Apply the new settings
    await device.setTrackerSettings(deviceID, sensorMode, fpsMode, uniqueSensorAutoCorrection, false);

    log(`Setting "${deviceID}" settings to:`, "settings");
    log(`Sensor mode: ${sensorMode}`, "settings");
    log(`FPS mode: ${fpsMode}`, "settings");
    log(`Sensor auto correction: ${uniqueSensorAutoCorrection.join(", ")}`, "settings");

    // Log new tracker settings
    const newSettings = await device.getTrackerSettings(deviceID, true);
    log(`New tracker settings: ${JSON.stringify(newSettings)}`, "settings");
});

ipcMain.on("set-all-tracker-settings", async (_event, arg) => {
    const {
        sensorMode,
        fpsMode,
        sensorAutoCorrection,
    }: { sensorMode: SensorMode; fpsMode: FPSMode; sensorAutoCorrection: SensorAutoCorrection[] } = arg;

    // Validate input settings
    if (!sensorMode || !fpsMode || !sensorAutoCorrection || sensorAutoCorrection.length === 0) {
        warn(`Invalid settings received: ${JSON.stringify(arg)}`, "settings");
        return;
    }

    // Make sure we get unique entries
    const uniqueSensorAutoCorrection = [...new Set(sensorAutoCorrection)];
    const uniqueActiveTrackers = [...new Set(device.getActiveTrackers())];

    log("Setting all tracker settings to:", "settings");
    log(`Sensor mode: ${sensorMode}`, "settings");
    log(`FPS mode: ${fpsMode}`, "settings");
    log(`Sensor auto correction: ${uniqueSensorAutoCorrection.join(", ")}`, "settings");
    log(`Applied to trackers: ${uniqueActiveTrackers.join(", ")}`, "settings");

    await device.setAllTrackerSettings(sensorMode, fpsMode, uniqueSensorAutoCorrection, false);
});

ipcMain.on("set-channel", async (_event, arg) => {
    const { port, channel } = arg;

    if (!device) {
        error("Device instance wasn't started correctly", "connection");
        return;
    }

    if (!device.getConnectionModeActive("com")) {
        error("COM connection not active", "connection");
        return;
    }

    log(`Changing channel for port ${port} to ${channel}`, "connection");
    device.getComInstance().setChannel(port, channel);
});

ipcMain.on("turn-off-tracker", async (_event, arg) => {
    const trackerName = arg;

    if (!device) {
        error("Device instance wasn't started correctly", "connection");
        return;
    }

    const activeTrackers = device.getActiveTrackers();

    if (trackerName === "all") {
        if (activeTrackers && activeTrackers.length === 0) {
            error("No active trackers found", "connection");
            return;
        }

        log("Manually turning off all trackers", "connection");
        const powerOffPromises = activeTrackers.map(async (tracker) => {
            await device.powerOffTracker(tracker as string);
        });

        // Wait for all trackers to power off
        await Promise.all(powerOffPromises);
    } else {
        if (!activeTrackers.includes(trackerName)) {
            error(`Tracker "${trackerName}" not found`, "connection");
            return;
        }

        log(`Manually turning off tracker "${trackerName}"`, "connection");
        await device.powerOffTracker(trackerName);
    }
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

    // Use lodash's mergeWith() to merge the new data with the existing config (not merge() as it doesn't remove old keys if purposely removed by program, e.g. comPorts)
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
        if (!current.hasOwnProperty(property)) return false;
        current = current[property];
    }

    return true;
});

ipcMain.handle("get-setting", (_event, name) => {
    const config: { [key: string]: any } = JSON.parse(fs.readFileSync(configPath).toString());

    const properties = name.split(".");
    let current = config;

    for (const property of properties) {
        if (!current.hasOwnProperty(property)) return null;
        current = current[property];
    }

    return current;
});

/*
 * haritorax-interpreter event listeners
 */

import { MACAddress, Quaternion, Vector } from "@slimevr/common";
import {
    BoardType,
    FirmwareFeatureFlags,
    MCUType,
    RotationDataType,
    SensorStatus,
    SensorType,
    UserAction,
} from "@slimevr/firmware-protocol";
import { EmulatedTracker } from "@slimevr/tracker-emulation";
import { ActivePorts } from "haritorax-interpreter/dist/mode/com";
import BetterQuaternion from "quaternion";
import { ParsedUrlQueryInput } from "querystring";

// For haritorax-interpreter
// Used to handle errors coming from haritorax-interpreter and display them to the user if wanted
enum ErrorType {
    SerialNotFoundRetryError = "Error while retrying connection",
    SerialNotFoundError = "File not found",
    SerialNotOpenError = "Port is not open",
    SerialOpenError = "Opening COM",
    SerialWriteError = "Error writing data to serial port",
    SendHeartbeatError = "Error while sending heartbeat",
    SerialUnexpectedError = "Error on port",

    BluetoothOpenError = "Bluetooth initialization failed",
    BluetoothScanError = "Error starting bluetooth scanning",
    BluetoothDiscoveryError = "Error during Bluetooth discovery/connection process",
    BluetoothDisconnectError = "Error disconnecting from Bluetooth device",
    BluetoothCloseError = "Error while closing Bluetooth connection",
    BluetoothServiceError = "Error setting up Bluetooth services",
    BluetoothCharacteristicError = "Error reading characteristic",

    IMUProcessError = "Error decoding IMU packet",
    MagProcessError = "Error processing mag data",
    SettingsProcessError = "Error processing settings data",
    ButtonProcessError = "Error processing button data",

    TrackerSettingsReadError = "Cannot get settings for ",
    TrackerSettingsWriteError = "Error sending tracker settings",

    JSONParseError = "JSON",
    TimeoutError = "timeout",
    UnexpectedError = "An unexpected error occurred",
}

const lastErrorShownTime: Record<ErrorType, number> = {
    [ErrorType.SerialNotFoundError]: 0,
    [ErrorType.SerialNotFoundRetryError]: 0,
    [ErrorType.SerialNotOpenError]: 0,
    [ErrorType.SerialOpenError]: 0,
    [ErrorType.SerialWriteError]: 0,
    [ErrorType.SendHeartbeatError]: 0,
    [ErrorType.SerialUnexpectedError]: 0,

    [ErrorType.BluetoothOpenError]: 0,
    [ErrorType.BluetoothScanError]: 0,
    [ErrorType.BluetoothDiscoveryError]: 0,
    [ErrorType.BluetoothDisconnectError]: 0,
    [ErrorType.BluetoothCloseError]: 0,
    [ErrorType.BluetoothServiceError]: 0,
    [ErrorType.BluetoothCharacteristicError]: 0,

    [ErrorType.IMUProcessError]: 0,
    [ErrorType.MagProcessError]: 0,
    [ErrorType.SettingsProcessError]: 0,
    [ErrorType.ButtonProcessError]: 0,

    [ErrorType.TrackerSettingsReadError]: 0,
    [ErrorType.TrackerSettingsWriteError]: 0,

    [ErrorType.JSONParseError]: 0,
    [ErrorType.TimeoutError]: 0,
    [ErrorType.UnexpectedError]: 0,
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
            `SlimeTora v${app.getVersion()}`,
            new FirmwareFeatureFlags(new Map([])),
            BoardType.HARITORA,
            MCUType.HARITORA,
            serverAddress,
            serverPort
        );

        await newTracker.init();
        await newTracker.addSensor(SensorType.UNKNOWN, SensorStatus.OK);

        // Set the MAC address in the config
        saveSetting({ trackers: { [trackerName]: { macAddress } } });
        log(`Set MAC address for "${trackerName}" to: ${macAddress}`, "tracker");

        connectedDevices.set(trackerName, newTracker);

        setupTrackerEvents(newTracker);

        log(`Connected to tracker: ${trackerName}`, "tracker");
        mainWindow.webContents.send("connect", trackerName);
    }

    // Sort the connectedDevices map by keys
    connectedDevices = new Map([...connectedDevices.entries()].sort());

    const trackers = JSON.stringify(Array.from(connectedDevices.keys()).filter((key) => connectedDevices.get(key)));
    log(`Connected devices: ${trackers}`, "tracker");

    isProcessingQueue = false;
}

const trackerTimeouts: { [key: string]: NodeJS.Timeout } = {};

const resetTrackerTimeout = (trackerName: string) => {
    if (trackerTimeouts[trackerName]) clearTimeout(trackerTimeouts[trackerName]);

    trackerTimeouts[trackerName] = setTimeout(() => {
        device.emit("disconnect", trackerName);
        log(`Tracker "${trackerName}" assumed disconnected due to inactivity.`, "tracker");
    }, 5000);
};

const MAX_BATTERY_READINGS = 5;
const batteryReadingsMap = new Map<string, { percentages: number[]; voltages: number[] }>();
function startDeviceListeners() {
    device.on("connect", async (deviceID: string, mode: string, port: string, portId: string) => {
        if (
            !deviceID ||
            !connectionActive ||
            (connectedDevices.has(deviceID) && connectedDevices.get(deviceID)) ||
            isClosing
        )
            return;
        await addTracker(deviceID);

        if (mode !== "com" && !(port && portId)) return;
        if (pairingWindow && !pairingWindow.isDestroyed()) {
            pairingWindow.webContents.send("device-paired", { trackerName: deviceID, port, portId });
        }
    });

    device.on("disconnect", (deviceID: string) => {
        if (!deviceID || !connectedDevices.get(deviceID) || isClosing) return;
        log(`Disconnected from tracker: ${deviceID}`, "tracker");

        clearTimeout(trackerTimeouts[deviceID]);
        connectedDevices.get(deviceID).deinit();
        connectedDevices.get(deviceID).removeAllListeners();
        connectedDevices.set(deviceID, undefined);

        mainWindow.webContents.send("disconnect", deviceID);

        const trackers = JSON.stringify(Array.from(connectedDevices.keys()).filter((key) => connectedDevices.get(key)));
        log(`Connected devices: ${trackers}`, "tracker");
    });

    device.on("mag", (trackerName: string, magStatus: MagStatus) => {
        if (!trackerName || !magStatus || isClosing) return;

        let magStatusColor;

        switch (magStatus) {
            case MagStatus.GREAT:
                magStatusColor = "green";
                break;
            case MagStatus.OKAY:
                magStatusColor = "yellow";
                break;
            case MagStatus.BAD:
                magStatusColor = "red";
                break;
            case MagStatus.VERY_BAD:
                magStatusColor = "darkred";
                break;
            default:
                magStatusColor = "gray";
                break;
        }

        mainWindow.webContents.send("device-mag", { trackerName, magStatus: magStatusColor });
    });

    let clickCounts: { [key: string]: number } = {};
    let clickTimeouts: { [key: string]: NodeJS.Timeout } = {};

    device.on("button", (trackerName: string, buttonPressed: string, isOn: boolean) => {
        if (!trackerName || !buttonPressed || !isOn || isClosing) return;

        let key = `${trackerName}-${buttonPressed}`;

        if (!clickCounts[key]) clickCounts[key] = 0;
        clickCounts[key]++;
        if (clickTimeouts[key] !== undefined) clearTimeout(clickTimeouts[key]);

        clickTimeouts[key] = setTimeout(() => {
            if (clickCounts[key] === 1) {
                log(`Single click ${buttonPressed} button from tracker "${trackerName}"`, "tracker");
                heartbeatTracker.sendUserAction(UserAction.RESET_YAW);
            } else if (clickCounts[key] === 2) {
                log(`Double click ${buttonPressed} button from tracker "${trackerName}"`, "tracker");
                heartbeatTracker.sendUserAction(UserAction.RESET_FULL);
            } else if (clickCounts[key] === 3) {
                log(`Triple click ${buttonPressed} button from tracker "${trackerName}"`, "tracker");
                heartbeatTracker.sendUserAction(UserAction.RESET_MOUNTING);
            } else {
                log(`Four click ${buttonPressed} button from tracker "${trackerName}"`, "tracker");
                heartbeatTracker.sendUserAction(UserAction.PAUSE_TRACKING);
            }

            clickCounts[key] = 0;
        }, 750);
    });

    let imuErrorCount: { [key: string]: number } = {};
    device.on("imu", async (trackerName: string, rawRotation: Rotation, rawGravity: Gravity) => {
        if (!trackerName || !rawRotation || !rawGravity || !connectedDevices.has(trackerName) || isClosing) return;

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
            error(`Error processing IMU data for "${trackerName}", skipping...`, "tracker");
            log(
                `Tracker: ${JSON.stringify(tracker)}, Rotation: ${JSON.stringify(rotation)}, Gravity: ${JSON.stringify(
                    gravity
                )}`,
                "tracker"
            );

            // Prevent spam of IMU errors
            imuErrorCount[trackerName] = imuErrorCount[trackerName] ? imuErrorCount[trackerName] + 1 : 1;
            if (imuErrorCount[trackerName] > 20) {
                error(`Too many errors processing IMU data for "${trackerName}", disconnecting...`, "tracker");
                device.emit("disconnect", trackerName);
                connectedDevices.delete(trackerName);
                imuErrorCount[trackerName] = 0;
                mainWindow.webContents.send("device-error", trackerName);
            }
            return;
        }

        tracker.sendRotationData(0, RotationDataType.NORMAL, quaternion, 0);
        tracker.sendAcceleration(0, gravity);
        resetTrackerTimeout(trackerName);

        mainWindow.webContents.send("device-data", {
            trackerName,
            rotation,
            gravity,
            rawRotation,
            rawGravity,
        });
    });

    device.on("battery", (trackerName: string, batteryRemaining: number, batteryVoltage: number) => {
        if (!trackerName || !batteryRemaining || isClosing) return;

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

        log(
            `Received battery data for "${trackerName}": ${stableBatteryRemaining}% (${stableBatteryVoltage}V)`,
            "tracker"
        );
    });

    device.on("paired", (trackerName: string, port: string, portId: string) => {
        if (!trackerName || !port || !portId || !pairingWindow || isClosing) return;

        device.emit("connect", trackerName, "com", port, portId);
        pairingWindow.webContents.send("device-paired", { trackerName, port, portId });

        log(`Paired tracker "${trackerName}" with port ${port} (ID ${portId})`, "pairing");
    });

    device.on("unpaired", (trackerName: string) => {
        if (!trackerName || isClosing) return;

        device.emit("disconnect", trackerName);

        log(`Unpaired tracker "${trackerName}"`, "pairing");
    });

    device.on("log", (msg: string) => {
        log(msg, "haritorax-interpreter");
    });

    device.on("error", (msg: string, exceptional: boolean) => {
        const handledErrorTypes = [
            ErrorType.SerialNotFoundRetryError,
            ErrorType.SerialNotFoundError,
            ErrorType.SerialNotOpenError,
            ErrorType.SerialOpenError,
            ErrorType.BluetoothOpenError,
            ErrorType.BluetoothScanError,
            ErrorType.BluetoothDiscoveryError,
            ErrorType.BluetoothServiceError,
            ErrorType.TimeoutError,
            ErrorType.SerialWriteError,
            ErrorType.SendHeartbeatError,
            ErrorType.TrackerSettingsWriteError,
            ErrorType.IMUProcessError,
            ErrorType.MagProcessError,
            ErrorType.SettingsProcessError,
            ErrorType.ButtonProcessError,
            ErrorType.BluetoothCharacteristicError,
            ErrorType.UnexpectedError,
            ErrorType.SerialUnexpectedError,
        ];

        let matchedErrorType: ErrorType | null = null;

        for (const errorType of handledErrorTypes) {
            if (msg.includes(errorType)) {
                matchedErrorType = errorType;
                break;
            }
        }

        if (matchedErrorType) {
            switch (matchedErrorType) {
                case ErrorType.SerialNotFoundRetryError:
                case ErrorType.SerialNotOpenError:
                    handleError(msg, matchedErrorType, handleConnectionRetryError);
                    break;
                case ErrorType.SerialNotFoundError:
                case ErrorType.SerialOpenError:
                case ErrorType.BluetoothOpenError:
                case ErrorType.BluetoothScanError:
                case ErrorType.BluetoothDiscoveryError:
                case ErrorType.BluetoothServiceError:
                case ErrorType.TimeoutError:
                    handleError(msg, matchedErrorType, handleConnectionStartError);
                    break;
                case ErrorType.SerialWriteError:
                case ErrorType.SendHeartbeatError:
                case ErrorType.TrackerSettingsWriteError:
                    handleError(msg, matchedErrorType, handleTrackerWriteError);
                    break;
                case ErrorType.IMUProcessError:
                case ErrorType.MagProcessError:
                case ErrorType.SettingsProcessError:
                case ErrorType.ButtonProcessError:
                case ErrorType.BluetoothCharacteristicError:
                    handleError(msg, matchedErrorType, handleTrackerReadError);
                    break;
                case ErrorType.UnexpectedError:
                case ErrorType.SerialUnexpectedError:
                    handleError(msg, matchedErrorType, handleUnexpectedError);
                    break;
                default:
                    warn("Unhandled error type received from haritorax-interpreter");
                    error(msg, "haritorax-interpreter");
                    break;
            }
        } else {
            warn("Unhandled error type received from haritorax-interpreter");
            error(msg, "haritorax-interpreter");
        }

        if (exceptional) {
        } else {
            switch (true) {
                default:
                    error(msg, "haritorax-interpreter");
                    break;
            }
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

async function handleConnectionRetryError(err: any) {
    error(`Failed to retry tracker connection`, "haritorax-interpreter", err);
    connectedDevices.clear();
    mainWindow.webContents.send("disconnect", "connection-error");
}

async function handleConnectionStartError(err: any) {
    error(`Failed to start tracker connection`, "haritorax-interpreter", err);
    mainWindow.webContents.send("set-status", "main.status.failed");
    dialog.showErrorBox(
        await translate("dialogs.connectionFailed.title"),
        await translate("dialogs.connectionFailed.message")
    );

    connectedDevices.clear();
    mainWindow.webContents.send("disconnect", "connection-error");
}

async function handleTrackerReadError(err: any) {
    error(`Failed to read data from a tracker`, "haritorax-interpreter", err);
    dialog.showErrorBox(
        await translate("dialogs.trackerReadError.title"),
        await translate("dialogs.trackerReadError.message")
    );
}

async function handleTrackerWriteError(err: any) {
    error(`Failed to write data to a tracker`, "haritorax-interpreter", err);
    dialog.showErrorBox(
        await translate("dialogs.trackerWriteError.title"),
        await translate("dialogs.trackerWriteError.message")
    );
}

async function handleUnexpectedError(err: any) {
    error(`An unexpected error occurred`, "haritorax-interpreter", err);
    dialog.showErrorBox(
        await translate("dialogs.unexpectedError.title"),
        await translate("dialogs.unexpectedError.message")
    );
}

/*
 * SlimeVR Forwarding
 */

function setupTrackerEvents(tracker: EmulatedTracker, isHeartbeat = false) {
    const trackerName = isHeartbeat
        ? "(HEARTBEAT)"
        : Array.from(connectedDevices.keys()).find((key) => connectedDevices.get(key) === tracker);

    tracker.on("ready", () => {
        log(`Tracker "${trackerName}" is ready to search for SlimeVR server...`, "@slimevr/emulated-tracker");
    });

    tracker.on("searching-for-server", () => {
        log(`Tracker "${trackerName}" is searching for SlimeVR server...`, "@slimevr/emulated-tracker");
    });

    tracker.on("connected-to-server", (ip: string, port: number) => {
        if (isHeartbeat) return;
        log(`Tracker "${trackerName}" connected to SlimeVR server on ${ip}:${port}`, "@slimevr/emulated-tracker");
        mainWindow.webContents.send("device-connected-to-server", trackerName);

        tracker.sendTemperature(0, 420.69);
        tracker.sendSignalStrength(0, 69);

        foundSlimeVR = true;
    });

    tracker.on("disconnected-from-server", (reason) => {
        log(`Tracker "${trackerName}" disconnected from SlimeVR server due to: ${reason}`, "@slimevr/emulated-tracker");
    });

    tracker.on("error", (err) => {
        error(`Tracker "${trackerName}" error`, "@slimevr/emulated-tracker", err);
    });

    tracker.on("unknown-incoming-packet", (packet: any) => {
        warn(`Tracker "${trackerName}" unknown packet type: ${packet.type}`, "@slimevr/emulated-tracker");
    });

    tracker.on("unknown-incoming-packet", (buf: Buffer) =>
        warn(`Tracker "${trackerName}" unknown incoming packet: ${buf.toString()}`, "@slimevr/emulated-tracker")
    );

    if (loggingMode === 3) {
        tracker.on("outgoing-packet", (packet: any) => {
            log(`Tracker "${trackerName}" outgoing packet: ${packet}`, "@slimevr/emulated-tracker");
        });
    }
}

const heartbeatTracker = new EmulatedTracker(
    new MACAddress([0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
    `SlimeTora v${app.getVersion()} heartbeat`,
    new FirmwareFeatureFlags(new Map([])),
    BoardType.HARITORA,
    MCUType.HARITORA,
    serverAddress,
    serverPort
);

setupTrackerEvents(heartbeatTracker, true);
await heartbeatTracker.init();
log(`Looking for SlimeVR server on: ${serverAddress}:${serverPort}`, "connection");

/*
 * Logging
 */

async function logMessage(level: string, msg: string, where: string, err?: Error) {
    const date = new Date();
    const logLevel = level.toUpperCase();
    const consoleLogFn = logLevel === "WARN" ? console.warn : logLevel === "ERROR" ? console.error : console.log;
    let formattedMessage = `${date.toTimeString()} -- ${logLevel} -- (${where}): ${msg}`;

    consoleLogFn(formattedMessage);

    if (!canLogToFile) return;

    const logDir = path.resolve(mainPath, "logs");
    await initializeLogDirectory(logDir);

    const logPath = path.join(logDir, `log-${formatDateForFile(date)}.txt`);
    await logToFile(logPath, `${formattedMessage}\n`);

    if (err) {
        consoleLogFn(err.stack);
        await logToFile(logPath, `${err.stack}\n`);
    }
}

function log(msg: string, where = "main") {
    logMessage("info", msg, where);
}

function warn(msg: string, where = "main") {
    logMessage("warn", msg, where);
}

function error(msg: string, where = "main", err?: any) {
    if (err && !(err instanceof Error)) {
        err = new Error(String(err));
    }
    logMessage("error", msg, where, err);
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
        error(`Error logging to file "${logPath}"`, "main", err);
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
