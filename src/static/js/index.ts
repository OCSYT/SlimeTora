import { CompactCard, NormalCard } from "./templates/device-card.js";

/*
 * Global variables
 */

let isActive = false;
let refreshingDeviceList = false;

let bluetoothEnabled = false;
let comEnabled = false;
const selectedComPorts: string[] = [];

let wirelessTrackerEnabled = false;
let wiredTrackerEnabled = false;

let fpsMode = 50;
let sensorMode = 2;
let accelerometerEnabled = false;
let gyroscopeEnabled = false;
let magnetometerEnabled = false;

let canLogToFile = true;
let bypassCOMPortLimit = false;

let language = "en";
let censorSerialNumbers = false;
let trackerVisualization = false;
let compactView = false;
let autoStart = false;
let autoOff = false;
let trackerVisualizationFPS = 10;
let trackerHeartbeatInterval = 2000;

let serverAddress = "255.255.255.255";
let serverPort = 6969;

let appUpdatesEnabled = true;
let translationsUpdatesEnabled = true;
let updateChannel = "stable";

let loggingMode = 1;

/*
 * Renderer functions
 */

const t = async (key: string) => await window.translate(key);
const l = (key: string, where?: string) => window.log(key, where);
const e = (key: string, where?: string) => window.error(key, where);

async function updateTranslations() {
    const i18nElements = document.querySelectorAll("[data-i18n]");
    const translationPromises: Promise<void>[] = [];

    i18nElements.forEach((element) => {
        const key = element.getAttribute("data-i18n");
        const translationPromise = t(key).then((translation) => {
            if (translation && translation !== key) {
                // could be a slight security risk, but makes it so much easier to format text
                element.innerHTML = translation;
            }
        });
        translationPromises.push(translationPromise);
    });

    return await Promise.all(translationPromises);
}

function appendOptions(selectElement: HTMLElement, options: string[]) {
    const fragment = document.createDocumentFragment();
    options.forEach((optionValue) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.text = optionValue;
        fragment.appendChild(option);
    });
    selectElement.appendChild(fragment);
}

function setSwitchState(switchId: string, state: any) {
    const switchElement = document.getElementById(switchId) as HTMLInputElement;
    if (switchElement) switchElement.checked = state;
}

function setSelectValue(selectId: string, value: string) {
    const selectElement = document.getElementById(selectId) as HTMLSelectElement;
    if (selectElement) selectElement.value = value;
}

document.addEventListener("DOMContentLoaded", async function () {
    l("DOM loaded");

    // Populate COM ports
    const comPortList = document.getElementById("com-ports");
    const comPorts: string[] = await window.ipc.invoke("get-com-ports", null);

    l(`COM ports: ${JSON.stringify(comPorts)}`);

    let rowHTML = '<div class="com-port-row">';
    comPorts.forEach((port: string, index: number) => {
        // Remove /dev/tty from COM ports on Linux
        const prettyPort = port.replace("/dev/tty", "");

        const switchHTML = `
        <div class="switch-container">
            <div class="switch">
            <input type="checkbox" id="${port}" />
            <label for="${port}" class="slider round"></label>
            </div>
            <label for="${port}">${prettyPort}</label>
        </div>
        `;

        rowHTML += switchHTML;

        // If there are two COM ports in the row or if this is the last COM port, add the row to the list
        if ((index + 1) % 2 === 0 || index === comPorts.length - 1) {
            rowHTML += "</div>";
            comPortList.innerHTML += rowHTML;
            rowHTML = '<div class="com-port-row">';
        }
    });

    // Populate language select
    const languageSelect = document.getElementById("language-select") as HTMLSelectElement;
    const languages: string[] = await window.ipc.invoke("get-languages", null);
    appendOptions(languageSelect, languages);

    // Get settings from config file
    const settings: { [key: string]: any } = await window.ipc.invoke("get-settings", null);
    language = settings.global?.language ?? "en";
    compactView = settings.global?.compactView ?? false;
    censorSerialNumbers = settings.global?.censorSerialNumbers ?? false;
    trackerVisualization = settings.global?.trackerVisualization ?? false;
    trackerVisualizationFPS = settings.global?.trackerVisualizationFPS ?? 10;
    trackerHeartbeatInterval = settings.global?.trackerHeartbeatInterval ?? 2000;
    wirelessTrackerEnabled = settings.global?.trackers?.wirelessTrackerEnabled ?? false;
    wiredTrackerEnabled = settings.global?.trackers?.wiredTrackerEnabled ?? false;
    bluetoothEnabled = settings.global?.connectionMode?.bluetoothEnabled ?? false;
    comEnabled = settings.global?.connectionMode?.comEnabled ?? false;
    fpsMode = settings.global?.trackers?.fpsMode ?? 50;
    sensorMode = settings.global?.trackers?.sensorMode ?? 2;
    accelerometerEnabled = settings.global?.trackers?.accelerometerEnabled ?? true;
    gyroscopeEnabled = settings.global?.trackers?.gyroscopeEnabled ?? false;
    magnetometerEnabled = settings.global?.trackers?.magnetometerEnabled ?? false;
    autoStart = settings.global?.autoStart ?? false;
    autoOff = settings.global?.autoOff ?? false;
    appUpdatesEnabled = settings.global?.updates?.appUpdatesEnabled ?? true;
    translationsUpdatesEnabled = settings.global?.updates?.translationsUpdatesEnabled ?? true;
    updateChannel = settings.global?.updates?.updateChannel ?? "stable";
    canLogToFile = settings.global?.debug?.canLogToFile ?? true;
    loggingMode = settings.global?.debug?.loggingMode ?? 1;
    bypassCOMPortLimit = settings.global?.debug?.bypassCOMPortLimit ?? false;
    serverAddress = settings.global?.serverAddress ?? "255.255.255.255";
    serverPort = settings.global?.serverPort ?? 6969;

    // Set switch states based on settings
    setSwitchState("compact-view-switch", compactView);
    setSwitchState("censor-serial-switch", censorSerialNumbers);
    setSwitchState("tracker-visualization-switch", trackerVisualization);
    setSwitchState("wireless-tracker-switch", wirelessTrackerEnabled);
    setSwitchState("wired-tracker-switch", wiredTrackerEnabled);
    setSwitchState("bluetooth-switch", bluetoothEnabled);
    setSwitchState("com-switch", comEnabled);
    setSwitchState("accelerometer-switch", accelerometerEnabled);
    setSwitchState("gyroscope-switch", gyroscopeEnabled);
    setSwitchState("magnetometer-switch", magnetometerEnabled);
    setSwitchState("auto-start-switch", autoStart);
    setSwitchState("auto-off-switch", autoOff);
    setSwitchState("app-updates-switch", appUpdatesEnabled);
    setSwitchState("translations-updates-switch", translationsUpdatesEnabled);
    setSwitchState("log-to-file-switch", canLogToFile);
    setSwitchState("bypass-com-limit-switch", bypassCOMPortLimit);

    // Set select values based on settings
    setSelectValue("fps-mode-select", fpsMode.toString());
    setSelectValue("sensor-mode-select", sensorMode.toString());
    setSelectValue("language-select", language.toString());
    setSelectValue("logging-mode-select", loggingMode.toString());
    setSelectValue("update-channel-select", updateChannel.toString());

    // Set input values based on settings
    const trackerVisualizationFPSInput = document.getElementById("tracker-visualization-fps") as HTMLInputElement;
    trackerVisualizationFPSInput.value = trackerVisualizationFPS.toString();

    const trackerHeartbeatIntervalInput = document.getElementById("tracker-heartbeat-interval") as HTMLInputElement;
    trackerHeartbeatIntervalInput.value = trackerHeartbeatInterval.toString();

    const serverAddressInput = document.getElementById("server-address") as HTMLInputElement;
    serverAddressInput.value = serverAddress;

    const serverPortInput = document.getElementById("server-port") as HTMLInputElement;
    serverPortInput.value = serverPort.toString();

    // Set the selected COM ports
    const comPortsSwitches = Array.from(document.getElementById("com-ports").querySelectorAll("input"));
    const selectedPorts: string[] = settings.global?.connectionMode?.comPorts ?? [];

    comPortsSwitches.forEach((port) => {
        if (selectedPorts.includes(port.id)) port.checked = true;
    });

    // Check if the selected COM ports are still available
    let isMissingPorts = false;
    selectedPorts.forEach((port) => {
        if (!comPorts.includes(port)) {
            l(`COM port ${port} in config was not found in user's available COM ports`);
            selectedPorts.splice(selectedPorts.indexOf(port), 1);
            isMissingPorts = true;
        }
    });

    if (isMissingPorts) {
        setStatus("main.status.comPortsMissing");
        showErrorDialog("dialogs.comPortsMissing.title", "dialogs.comPortsMissing.message");
    }

    selectedComPorts.push(...selectedPorts);

    // Disable unsupported settings
    if (wirelessTrackerEnabled && !wiredTrackerEnabled) {
        setElementDisabledState(document.getElementById("wired-tracker-switch"), true);
    } else if (wiredTrackerEnabled && !wirelessTrackerEnabled) {
        const ids = ["wireless-tracker-switch", "bluetooth-switch"];
        ids.forEach((id) => {
            const element = document.getElementById(id);
            setElementDisabledState(element, wiredTrackerEnabled);
        });
    }

    window.changeLanguage(language);
    await updateTranslations();

    // Set program statuses
    setStatus("main.status.none");
    document.getElementById("tracker-count").textContent = document
        .getElementById("tracker-count")
        .textContent.replace("{trackerCount}", "0");

    l(`Language set to: ${language}`);
    l(`Settings loaded:\r\n${JSON.stringify(settings, null, 4)}`);

    addEventListeners();

    if (autoStart) startConnection();
});

window.addEventListener("storage", (event) => {
    const { key, newValue } = event;
    l(`localStorage event: "${key}" changed to "${newValue}"`);

    if (newValue === "true") {
        if (key === "autodetect") {
            autodetect();
            localStorage.setItem("autodetect", "false");
        } else if (key === "questions") {
            questions();
            localStorage.setItem("questions", "false");
        } else if (key === "startConnection") {
            startConnection();
            localStorage.setItem("startConnection", "false");
        } else if (key === "stopConnection") {
            stopConnection();
            localStorage.setItem("stopConnection", "false");
        }
    } else {
        if (key === "language") {
            selectLanguage(newValue);
        }
    }
});

async function autodetect() {
    showMessageBox("dialogs.autodetect.pre-check.title", "dialogs.autodetect.pre-check.message", true);

    l("Starting auto-detection...", "detect");
    setStatus("main.status.autodetect.running");

    const autodetectObject = await window.ipc.invoke("autodetect", null);
    const devices: Set<string> = new Set(autodetectObject.devices);
    const trackerSettings = autodetectObject.trackerSettings;

    l(`Found devices: ${Array.from(devices).join(", ")}`, "detect");

    let detectedTrackerModel = "";
    let detectedConnectionModes: string[] = [];

    async function handleComPorts(deviceName: string) {
        const comPorts: string[] = await window.ipc.invoke("get-com-ports", deviceName);
        selectedComPorts.length = 0;
        selectedComPorts.push(...comPorts);

        simulateChangeEvent(document.getElementById("com-switch") as HTMLInputElement, true);

        const comPortsParent = document.getElementById("com-ports");
        Array.from(comPortsParent.querySelectorAll("input")).forEach((port) =>
            simulateChangeEvent(port, comPorts.includes(port.id))
        );
        comPortsParent.dispatchEvent(new Event("change")); // simulate it here again since the actual code for handling COM port changes is in the parent element

        l(`Found device: ${deviceName}`, "detect");
        l(`COM ports for device "${deviceName}": ${comPorts}`, "detect");
    }

    const deviceHandlers: { [key: string]: () => Promise<void> } = {
        "HaritoraX Wireless": async () => {
            simulateChangeEvent(document.getElementById("wireless-tracker-switch") as HTMLInputElement, true);
            detectedTrackerModel = "HaritoraX Wireless";
        },
        "HaritoraX Wired": async () => {
            detectedTrackerModel = "HaritoraX Wired (1.1b/1.1/1.0)";
            await handleComPorts("HaritoraX Wired");
        },
        GX6: async () => {
            detectedConnectionModes.push("GX6");
            await handleComPorts("GX6");
        },
        GX2: async () => {
            detectedConnectionModes.push("GX2");
            await handleComPorts("GX2");

            // Enable BT and COM for HaritoraX Wireless w/ GX2 (no GX6)
            if (devices.has("HaritoraX Wireless") && !devices.has("GX6")) {
                simulateChangeEvent(document.getElementById("bluetooth-switch") as HTMLInputElement, true);
                detectedConnectionModes.push("Bluetooth");
                l("Found HaritoraX Wireless and GX2, enabling Bluetooth and COM", "detect");
            }
        },
        Bluetooth: async () => {
            detectedConnectionModes.push("Bluetooth");
            simulateChangeEvent(document.getElementById("bluetooth-switch") as HTMLInputElement, true);
            if (!devices.has("HaritoraX Wireless") || !devices.has("HaritoraX Wired")) {
                // Assume HaritoraX Wireless if no other devices are found
                l("No other devices found with Bluetooth, assuming HaritoraX Wireless", "detect");
                detectedTrackerModel = "HaritoraX Wireless";
                simulateChangeEvent(document.getElementById("wireless-tracker-switch") as HTMLInputElement, true);
            }
        },
    };

    for (const device of devices) if (deviceHandlers[device]) await deviceHandlers[device]();

    if (devices.size === 0) {
        // If somehow, literally nothing is found...
        window.warn("No devices found", "detect");
        await showErrorDialog("dialogs.autodetect.failed.title", "dialogs.autodetect.failed.message");
        setStatus("main.status.autodetect.failed");
    } else {
        const message = await t("dialogs.autodetect.success.message");

        const trackerName = detectedTrackerModel;
        const connectionModes = detectedConnectionModes.join(", ");
        const comPorts = selectedComPorts.join(", ");

        let fps = "N/A";
        let sensorMode = "N/A";
        let sensorAutoCorrectionList = "N/A";
        let ankle = "N/A";

        if (trackerSettings) {
            fps = trackerSettings.fpsMode;
            sensorMode = trackerSettings.sensorMode;
            sensorAutoCorrectionList = trackerSettings.sensorAutoCorrection.join(", ");
            ankle = trackerSettings.ankleMotionDetection;

            // Set tracker settings
            const fpsModeSelect = document.getElementById("fps-mode-select") as HTMLSelectElement;
            const sensorModeSelect = document.getElementById("sensor-mode-select") as HTMLSelectElement;
            const accelerometerSwitch = document.getElementById("accelerometer-switch") as HTMLInputElement;
            const gyroscopeSwitch = document.getElementById("gyroscope-switch") as HTMLInputElement;
            const magnetometerSwitch = document.getElementById("magnetometer-switch") as HTMLInputElement;

            if (fpsModeSelect) {
                fpsModeSelect.value = fps;
                fpsModeSelect.dispatchEvent(new Event("change"));
            }
            if (sensorModeSelect) {
                sensorModeSelect.value = sensorMode;
                sensorModeSelect.dispatchEvent(new Event("change"));
            }
            if (sensorAutoCorrectionList.includes("accel")) simulateChangeEvent(accelerometerSwitch, true);
            if (sensorAutoCorrectionList.includes("gyro")) simulateChangeEvent(gyroscopeSwitch, true);
            if (sensorAutoCorrectionList.includes("mag")) simulateChangeEvent(magnetometerSwitch, true);
        }

        const newMessage = message.replace(
            "{settings}",
            `\n\r\n\r---- Connection settings ----
Tracker model: ${trackerName}
Connection mode: ${connectionModes}
COM ports (if applicable): ${comPorts}

---- Tracker settings ----
FPS transfer rate: ${fps}
Sensor mode: ${sensorMode}
Sensor auto correction: ${sensorAutoCorrectionList}
Ankle motion detection: ${ankle}`
        );

        saveSettings();

        showMessageBox("dialogs.autodetect.success.title", newMessage, false, true, false);
        setStatus("main.status.autodetect.success");
    }

    // Simulate stop connection
    document.getElementById("stop-connection-button").click();
}

async function questions() {
    const dialogs = ["initial", "trackerModel", "connectionMode", "comPorts", "autoStart", "autoOff", "finish"];

    async function getResponse(dialog: string, buttons?: string[]) {
        return await showMessageBox(
            `dialogs.questions.${dialog}.title`,
            `dialogs.questions.${dialog}.message`,
            true,
            true,
            true,
            buttons
        );
    }

    let trackerModel = "HaritoraX Wireless";
    let connectionMode = "Bluetooth (LE)";
    let selectedPorts = [];
    let autoStart = false;
    let autoOff = false;
    for (const dialog of dialogs) {
        if (dialog === "comPorts") {
            selectedPorts = [];
            let done = false;

            while (!done) {
                const comPorts: string[] = await window.ipc.invoke("get-com-ports", null);
                if (comPorts.length === 0) {
                    e("No COM ports found for questions dialog");
                    await showErrorDialog("dialogs.noComPorts.title", "dialogs.noComPorts.message");
                    return;
                }

                const response = await getResponse(dialog, wiredTrackerEnabled ? comPorts : [...comPorts, "Done"]);

                if (response === comPorts.length && trackerModel !== "HaritoraX Wired (1.1b/1.1/1.0)") {
                    done = true;
                } else {
                    const selectedPort = comPorts[response];
                    const index = selectedPorts.indexOf(selectedPort);
                    if (index > -1) {
                        l(`Deselected COM port: ${selectedPort}`, "questions");
                        selectedPorts.splice(index, 1);
                        const portElement = document.getElementById(selectedPort) as HTMLInputElement;
                        if (portElement) portElement.checked = false;
                    } else {
                        l(`Selected COM port: ${selectedPort}`, "questions");
                        selectedPorts.push(selectedPort);
                        // Only allow one selection if wired tracker is enabled
                        if (trackerModel === "HaritoraX Wired (1.1b/1.1/1.0)") done = true;
                    }
                }
                l(`Selected COM ports: ${selectedPorts.join(", ")}`, "questions");
            }

            selectedComPorts.push(...selectedPorts);

            selectedPorts.forEach((portId) => {
                const portElement = document.getElementById(portId) as HTMLInputElement;
                if (portElement) portElement.checked = true;
            });
            continue;
        }

        let response;
        let btns;

        switch (dialog) {
            case "trackerModel":
                btns = [
                    await t("dialogs.questions.trackerModel.wireless"),
                    await t("dialogs.questions.trackerModel.wired"),
                ];
                response = await getResponse(dialog, btns);
                if (response === 0) {
                    simulateChangeEvent(document.getElementById("wireless-tracker-switch") as HTMLInputElement, true);
                    trackerModel = "HaritoraX Wireless";
                } else if (response === 1) {
                    simulateChangeEvent(document.getElementById("wired-tracker-switch") as HTMLInputElement, true);
                    trackerModel = "HaritoraX Wired (1.1b/1.1/1.0)";
                    // Skip connectionMode and autoOff dialogs (not supported)
                    dialogs.splice(dialogs.indexOf("connectionMode"), 1);
                    connectionMode = "COM / GX(6/2)";
                    dialogs.splice(dialogs.indexOf("autoOff"), 1);
                    autoOff = false;
                }
                break;
            case "connectionMode":
                btns = [
                    await t("dialogs.questions.connectionMode.bluetooth"),
                    await t("dialogs.questions.connectionMode.com"),
                    await t("dialogs.questions.connectionMode.both"),
                ];
                response = await getResponse(dialog, btns);
                if (response === 0) {
                    simulateChangeEvent(document.getElementById("bluetooth-switch") as HTMLInputElement, true);
                    connectionMode = "Bluetooth (LE)";
                } else if (response === 1) {
                    simulateChangeEvent(document.getElementById("com-switch") as HTMLInputElement, true);
                    connectionMode = "COM / GX(6/2)";
                } else if (response === 2) {
                    simulateChangeEvent(document.getElementById("bluetooth-switch") as HTMLInputElement, true);
                    simulateChangeEvent(document.getElementById("com-switch") as HTMLInputElement, true);
                    connectionMode = "Bluetooth (LE) & COM / GX(6/2)";
                }
                break;
            case "autoStart":
                btns = [await t("dialogs.questions.autoStart.yes"), await t("dialogs.questions.autoStart.no")];
                response = await getResponse(dialog, btns);
                if (response === 0) {
                    simulateChangeEvent(document.getElementById("auto-start-switch") as HTMLInputElement, true);
                    autoStart = true;
                }
                break;
            case "autoOff":
                btns = [await t("dialogs.questions.autoOff.yes"), await t("dialogs.questions.autoOff.no")];
                response = await getResponse(dialog, btns);
                if (response === 0) {
                    simulateChangeEvent(document.getElementById("auto-off-switch") as HTMLInputElement, true);
                    autoOff = true;
                }
                break;
            case "finish":
                const msg = await t("dialogs.questions.finish.message");
                const newMessage = msg.replace(
                    "{settings}",
                    `\n\r
Tracker model: ${trackerModel}
Connection mode: ${connectionMode}
COM ports (if applicable): ${selectedPorts.join(", ")}
Auto-start: ${autoStart}
Auto-off: ${autoOff}`
                );
                await showMessageBox("dialogs.questions.finish.title", newMessage, true, true, false);
                l(`Finished questions dialog with settings: ${newMessage}`, "questions");
        }
    }
}

/*
 * Connection handling
 */

async function startConnection() {
    l("Starting connection...", "connection");

    try {
        if (!(await handleTrackerModelCheck())) return false;
        if (!(await handleConnectionType())) return false;
    } catch (err) {
        e(`Error starting connection: ${err}`, "connection");
        return false;
    }

    toggleConnectionButtons(true);
}

function stopConnection() {
    if (!isActive) {
        e(
            "No connection to stop.. wait a second, you shouldn't be seeing this - get out of inspect element and stop trying to break the program!",
            "connection"
        );
        return;
    }
    l("Stopping connection(s)...", "connection");

    toggleConnectionButtons(false);

    window.ipc.send("stop-connection", null);

    setStatus("main.status.none");
    document.getElementById("tracker-count").textContent = "0";
    document.getElementById("device-list").textContent = "";

    localStorage.setItem("trackerCount", document.getElementById("tracker-count").textContent);
}

// Helper functions
function toggleConnectionButtons(state: boolean) {
    isActive = state;

    const startButton = document.getElementById("start-connection-button") as HTMLButtonElement;
    const stopButton = document.getElementById("stop-connection-button") as HTMLButtonElement;
    const pairingButton = document.getElementById("pairing-button") as HTMLButtonElement;
    const turnOffTrackersButton = document.getElementById("turn-off-trackers-button") as HTMLButtonElement;
    const fixTrackersButton = document.getElementById("fix-trackers-button") as HTMLButtonElement;

    if (startButton) startButton.disabled = state;
    if (stopButton) stopButton.disabled = !state;

    if (wirelessTrackerEnabled && comEnabled) {
        if (pairingButton) pairingButton.disabled = !state;
        if (turnOffTrackersButton) turnOffTrackersButton.disabled = !state;
        if (fixTrackersButton) fixTrackersButton.disabled = !state;
    }
}

async function handleTrackerModelCheck() {
    if (!wirelessTrackerEnabled && !wiredTrackerEnabled) {
        e("No tracker model enabled");
        setStatus("main.status.noTrackerModel");
        await showErrorDialog("dialogs.noTrackerModel.title", "dialogs.noTrackerModel.message");
        return false;
    }
    return true;
}

async function handleConnectionType() {
    try {
        if (bluetoothEnabled || comEnabled) {
            let types = [];
            if (bluetoothEnabled) types.push("bluetooth");
            if (comEnabled) {
                if (selectedComPorts.length === 0) {
                    e("No COM ports selected");
                    setStatus("main.status.noComPorts");
                    await showErrorDialog("dialogs.noComPorts.title", "dialogs.noComPorts.message");
                    return false;
                }
                types.push("com");
            }
            window.ipc.send("start-connection", { types, ports: selectedComPorts, isActive });
            l(`Starting ${types.join(" and ")} connection with ports: ${selectedComPorts}`, "connection");
            return true;
        } else {
            e("No connection mode enabled");
            setStatus("main.status.noConnectionMode");
            await showErrorDialog("dialogs.noConnectionMode.title", "dialogs.noConnectionMode.message");
            return false;
        }
    } catch (err) {
        return err;
    }
}

/*
 * Renderer helper functions
 */

async function setStatus(status: string, translate: boolean = true) {
    const statusElement = document.getElementById("status");
    if (!statusElement) return;

    const finalStatus = translate ? await t(status) : status;
    statusElement.innerHTML = finalStatus;
    l(`Set status to: ${finalStatus}`);

    if (translate) statusElement.setAttribute("data-i18n", status);

    localStorage.setItem("status", finalStatus);
}

async function showMessageBox(
    titleKey: string,
    messageKey: string,
    blocking: boolean = false,
    translateTitle: boolean = true,
    translateMessage: boolean = true,
    buttons: string[] = ["OK"]
) {
    return await window.ipc.invoke("show-message", {
        title: titleKey,
        message: messageKey,
        blocking,
        translateTitle,
        translateMessage,
        buttons,
    });
}

async function showErrorDialog(
    titleKey: string,
    messageKey: string,
    blocking: boolean = true,
    translateTitle: boolean = true,
    translateMessage: boolean = true
) {
    const title = translateTitle ? await t(titleKey) : titleKey;
    const message = translateMessage ? await t(messageKey) : messageKey;

    return await window.ipc.invoke("show-error", {
        title,
        message,
        blocking,
        translateTitle,
        translateMessage,
    });
}

function setElementDisabledState(element: Element, isDisabled: boolean) {
    if (isDisabled) {
        element.setAttribute("disabled", "true");
    } else {
        element.removeAttribute("disabled");
    }
}

// Set settings button indicator (if changes need a manual save)
function unsavedSettings(unsaved: boolean) {
    const saveButton = document.getElementById("save-button");
    if (unsaved && !saveButton.classList.contains("is-danger")) {
        saveButton.classList.add("is-danger");
        saveButton.classList.remove("is-info");
    } else if (!unsaved && saveButton.classList.contains("is-danger")) {
        saveButton.classList.add("is-info");
        saveButton.classList.remove("is-danger");
    }
}

/*
 * Tracker device (haritorax-interpreter) event listeners
 */

window.ipc.on("connect", async (_event, deviceID) => {
    if (!deviceID || !isActive) return;

    l(`Connected to "${deviceID}"`, "tracker");

    if (!deviceQueue.includes(deviceID)) deviceQueue.push(deviceID);
    await processQueue();

    setStatus("main.status.connected");

    if (wiredTrackerEnabled) return;

    const settings = await window.ipc.invoke("get-settings", null);
    const exists = settings.trackers?.[deviceID].fpsMode !== undefined;
    l(`Tracker settings for "${deviceID}" exists: ${exists}`, "tracker");

    let trackerSettings = undefined;
    if (exists) {
        trackerSettings = settings.trackers[deviceID];
    } else {
        let sensorAutoCorrectionList = [];
        if (accelerometerEnabled) sensorAutoCorrectionList.push("accel");
        if (gyroscopeEnabled) sensorAutoCorrectionList.push("gyro");
        if (magnetometerEnabled) sensorAutoCorrectionList.push("mag");

        trackerSettings = {
            sensorMode: sensorMode,
            fpsMode: fpsMode,
            sensorAutoCorrection: sensorAutoCorrectionList,
        };
    }
    l(`Got tracker settings for "${deviceID}": ${JSON.stringify(trackerSettings)}`, "tracker");

    setTrackerSettings(deviceID, trackerSettings);
});

window.ipc.on("disconnect", (_event, deviceID) => {
    if (!deviceID || !isActive) return;

    if (deviceID === "connection-error") {
        document.getElementById("device-list").textContent = "";
        document.getElementById("tracker-count").textContent = "0";
        setStatus("main.status.failed");
        return;
    }

    l(`Disconnected from "${deviceID}"`, "tracker");
    document.getElementById(deviceID).remove();
    document.getElementById("tracker-count").textContent = (
        parseInt(document.getElementById("tracker-count").textContent) - 1
    ).toString();

    localStorage.setItem("trackerCount", document.getElementById("tracker-count").textContent);

    if (document.getElementById("tracker-count").textContent === "0") setStatus("main.status.searching");
});

window.ipc.on("device-connected-to-server", (_event, deviceID) => {
    if (!deviceID || !isActive) return;

    l(`Tracker "${deviceID}" connected to server, firing battery and mag events...`, "tracker");
    window.ipc.invoke("fire-tracker-battery", deviceID);
    window.ipc.invoke("fire-tracker-mag", deviceID);
});

window.ipc.on("device-error", (_event, deviceID) => {
    if (!deviceID || !isActive) return;

    l(`Too many IMU processing errors with device "${deviceID}"`, "tracker");
    setStatus("main.status.failed");
    showErrorDialog("dialogs.trackerIMUError.title", "dialogs.trackerIMUError.message");
});

window.ipc.on("device-data", async (_event: any, arg) => {
    const { trackerName, rotation, gravity, rawRotation, rawGravity } = arg;

    if (!isActive || refreshingDeviceList) return;

    const trackerElement = document.getElementById(trackerName);
    if (!trackerElement) {
        handleMissingDevice(trackerName);
        return;
    }

    if (compactView) return;
    updateTrackerData(trackerElement, rotation, gravity);
    sendVisualizationData(trackerName, rawRotation, rawGravity);
});

window.ipc.on("device-battery", (_event, arg) => {
    let { trackerName, batteryRemaining, batteryVoltage } = arg;
    if (!isActive || (!batteryRemaining && batteryRemaining !== 0) || (!batteryVoltage && batteryVoltage !== 0)) return;

    if (batteryVoltage > 10) batteryVoltage = batteryVoltage / 1000;

    batteryVoltage = parseFloat(batteryVoltage.toFixed(2));

    if (trackerName === "HaritoraXWired") {
        updateAllTrackerBatteries(batteryRemaining, batteryVoltage);
    } else {
        updateTrackerBattery(trackerName, batteryRemaining, batteryVoltage);
    }

    l(`Battery for "${trackerName}": ${batteryRemaining}% (${batteryVoltage}V)`, "tracker");
});

// TODO: change mag status to text instead of color
window.ipc.on("device-mag", (_event, arg) => {
    const { trackerName, magStatus }: { trackerName: string; magStatus: string } = arg;
    if (!isActive) return;

    const trackerElement = document.getElementById(trackerName);
    if (!trackerElement) return;

    const magStatusElement: HTMLElement = trackerElement.querySelector("#mag-status");
    if (!magStatusElement) return;

    const statuses: { [key: string]: string } = {
        green: "mag-status-green",
        yellow: "mag-status-yellow",
        red: "mag-status-red",
        darkred: "mag-status-darkred",
        unknown: "mag-status-unknown",
    };

    const statusClass = statuses[magStatus] || statuses.unknown;

    Object.values(statuses).forEach((status) => magStatusElement.classList.remove(status));

    magStatusElement.classList.add(statusClass);
});

// Helper functions
const deviceQueue: string[] = [];
let isProcessingQueue = false;
async function processQueue() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (deviceQueue.length > 0) {
        const deviceID = deviceQueue.shift();
        await addDeviceToList(deviceID);
    }
    isProcessingQueue = false;
    return true;
}

async function addDeviceToList(deviceID: string) {
    if (document.getElementById(deviceID)) return;
    l(`Adding device to device list: ${deviceID}`);

    const settings: { [key: string]: any } = await window.ipc.invoke("get-settings", null);
    const deviceList = document.getElementById("device-list");

    // Create a new div element
    const newDevice = document.createElement("div");
    newDevice.id = deviceID;
    newDevice.className = compactView ? "column is-12 compact-mode" : "column is-6 is-flex-grow-1";

    // Check if device has a user-specified name
    const deviceName: string = settings.trackers?.[deviceID]?.name ?? deviceID;
    if (deviceName !== deviceID) l(`Got user-specified name for "${deviceID}": ${deviceName}`);

    // Fill the div with device card data (depending on compactView)
    newDevice.innerHTML = compactView ? CompactCard(deviceID, deviceName) : NormalCard(deviceID, deviceName);

    const deviceNameElement = newDevice.querySelector("#device-name");
    const deviceIDElement = newDevice.querySelector("#device-id");
    const editButton = newDevice.querySelector("#edit-button");

    function startEditing() {
        const originalName = deviceNameElement.textContent;

        const inputElement = document.createElement("input");
        inputElement.type = "text";
        inputElement.value = originalName;
        inputElement.id = "device-name-input";

        deviceNameElement.replaceWith(inputElement);

        inputElement.focus();

        // Add event listeners to handle when the input loses focus or the enter key is pressed
        inputElement.addEventListener("blur", handleNameChange);
        inputElement.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") return;
            handleNameChange();
        });

        function handleNameChange() {
            inputElement.replaceWith(deviceNameElement);

            const newName = inputElement.value;
            deviceNameElement.textContent = newName;

            inputElement.removeEventListener("blur", handleNameChange);
            inputElement.removeEventListener("keydown", handleNameChange);

            window.ipc.send("save-setting", {
                trackers: {
                    [deviceID]: {
                        name: newName,
                    },
                },
            });
        }
    }

    if (!editButton || !deviceNameElement) return;

    editButton.addEventListener("click", startEditing);
    deviceNameElement.addEventListener("click", startEditing);

    // Censor serial if BT tracker and censorSerialNumbers is enabled
    if (censorSerialNumbers) {
        const regex = /^Haritora.*-/;
        if (regex.test(deviceID)) {
            const censoredText = deviceID.replace(/-.*/, "-XXXXXX");
            if (deviceIDElement) deviceIDElement.textContent = censoredText;
            if (deviceName === deviceID) {
                if (deviceNameElement) deviceNameElement.textContent = censoredText;
            }
        }
    }

    // Add visualization iframe if enabled
    if (trackerVisualization) {
        const iframe = document.createElement("iframe");

        iframe.id = `${deviceID}-visualization`;
        iframe.src = `./visualization.html?fps=${trackerVisualizationFPS}`;
        iframe.width = "280px";
        iframe.height = "280px";

        const container = newDevice.querySelector(".content");
        if (container) {
            container.appendChild(document.createElement("br"));
            container.appendChild(iframe);
        }
    }

    // add to tracker count
    const trackerCount = document.getElementById("tracker-count");
    trackerCount.textContent = (parseInt(trackerCount.textContent) + 1).toString();
    localStorage.setItem("trackerCount", document.getElementById("tracker-count").textContent);

    // Disable tracker settings button if wired tracker is enabled
    if (wiredTrackerEnabled) {
        const settingsButton = newDevice.querySelector("#tracker-settings-button");
        if (settingsButton) settingsButton.setAttribute("disabled", "true");
        l(`Disabled tracker settings button for "${deviceID}" (wired tracker)`);
    }

    deviceList.appendChild(newDevice);

    updateTranslations();

    // Manually fire tracker events
    window.ipc.invoke("fire-tracker-battery", deviceID);
    window.ipc.invoke("fire-tracker-mag", deviceID);
}

function setTrackerSettings(deviceID: string, trackerSettings: any) {
    const sensorMode: number = trackerSettings.sensorMode !== -1 ? trackerSettings.sensorMode : 2;
    const fpsMode: number = trackerSettings.fpsMode !== -1 ? trackerSettings.fpsMode : 50;
    let sensorAutoCorrection: Set<string> = new Set(trackerSettings.sensorAutoCorrection);

    if (accelerometerEnabled) {
        sensorAutoCorrection.add("accel");
        l("Added accel to sensor auto correction", "tracker");
    }
    if (gyroscopeEnabled) {
        sensorAutoCorrection.add("gyro");
        l("Added gyro to sensor auto correction", "tracker");
    }
    if (magnetometerEnabled) {
        sensorAutoCorrection.add("mag");
        l("Added mag to sensor auto correction", "tracker");
    }

    l(`Set sensor auto correction for "${deviceID}" to: ${Array.from(sensorAutoCorrection).join(",")}`, "tracker");

    window.ipc.send("set-tracker-settings", {
        deviceID,
        sensorMode,
        fpsMode,
        sensorAutoCorrection: Array.from(sensorAutoCorrection),
    });
}

async function handleMissingDevice(trackerName: string) {
    if (!deviceQueue.includes(trackerName)) {
        window.ipc.send("log", `Device "${trackerName}" not found in DOM, adding to queue`);
        deviceQueue.push(trackerName);
    }
    await processQueue();
}

function updateTrackerData(trackerElement: HTMLElement, rotation: Rotation, gravity: Gravity) {
    if (!rotation || !gravity) return;

    const rotationElement = trackerElement.querySelector("#rotation-data");
    const accelerationElement = trackerElement.querySelector("#acceleration-data");
    const rotationText = formatVector(rotation);
    const gravityText = formatVector(gravity);

    if (rotationElement) trackerElement.querySelector("#rotation-data").textContent = rotationText;
    if (accelerationElement) trackerElement.querySelector("#acceleration-data").textContent = gravityText;
}

function sendVisualizationData(trackerName: string, rawRotation: Rotation, rawGravity: Gravity) {
    const visualizationIframe = document.getElementById(`${trackerName}-visualization`) as HTMLIFrameElement | null;
    if (visualizationIframe === null) return;
    visualizationIframe?.contentWindow?.postMessage({ rotation: rawRotation, gravity: rawGravity }, "*");
}

function updateAllTrackerBatteries(batteryRemaining: number, batteryVoltage: number) {
    const devices = document.querySelectorAll("#device-list .card");
    devices.forEach((device) => {
        const batteryText = device.querySelector("#battery");
        if (batteryText) batteryText.textContent = formatBatteryText(batteryRemaining, batteryVoltage);
    });
}

function updateTrackerBattery(trackerName: string, batteryRemaining: number, batteryVoltage: number) {
    const batteryText = document.querySelector(`#${trackerName} #battery`);
    if (batteryText && trackerName !== "HaritoraXWired") {
        batteryText.textContent = formatBatteryText(batteryRemaining, batteryVoltage);
    }
}

function formatVector({ x, y, z }: { x: number; y: number; z: number }): string {
    return `${x.toFixed(0)}, ${y.toFixed(0)}, ${z.toFixed(0)}`;
}

function formatBatteryText(batteryRemaining: number, batteryVoltage: number): string {
    return `${batteryRemaining}% (${batteryVoltage}V)`;
}

/*
 * Renderer event listeners
 */

window.ipc.on("auto-start", (_event, _arg) => {
    startConnection();
});

window.ipc.on("localize", (_event, resources) => {
    window.localize(resources);
});

window.ipc.on("version", (_event, version) => {
    document.getElementById("version").textContent = version;
    l(`Got app version: ${version}`);
});

window.ipc.on("set-status", (_event, msg) => {
    setStatus(msg);
});

window.ipc.on("set-switch", (_event, { id, state }) => {
    simulateChangeEvent(document.getElementById(id) as HTMLInputElement, state);
});

function addEventListeners() {
    function refreshDeviceList() {
        refreshingDeviceList = true;

        // Store last known tracker info
        const devices = document.getElementById("device-list").querySelectorAll(".card");
        const lastMagStatus: { [key: string]: string } = {};
        const lastBatteryInfo: { [key: string]: string } = {};

        devices.forEach((device) => {
            const magStatusElement = device.querySelector("#mag-status");
            const batteryElement = device.querySelector("#battery");

            if (!magStatusElement || !batteryElement) return;

            // Find the class that starts with "mag-status-"
            // We are doing this because compact-view uses "mr-2" in classList
            const magStatus =
                Array.from(magStatusElement.classList).find((cls) => cls.startsWith("mag-status-")) || "unknown";
            const batteryText = batteryElement.textContent;

            lastBatteryInfo[device.id] = batteryText;
            lastMagStatus[device.id] = magStatus;
        });

        // Reset device list
        document.getElementById("device-list").textContent = "";
        document.getElementById("tracker-count").textContent = "0";
        deviceQueue.length = 0;

        // Re-add devices to the list
        devices.forEach((device) => {
            deviceQueue.push(device.id);
        });

        // After processing queue, restore last known tracker info
        processQueue().then(() => {
            refreshingDeviceList = false;
            l("Refreshed device list");

            // Restore last known mag statuses
            const newDevices = document.getElementById("device-list").querySelectorAll(".card");
            newDevices.forEach((device) => {
                const magStatusElement = device.querySelector("#mag-status");
                const batteryElement = device.querySelector("#battery");

                if (!magStatusElement || !batteryElement) return;

                const magStatus = lastMagStatus[device.id];
                const batteryText = lastBatteryInfo[device.id];

                magStatusElement.classList.add(magStatus);
                batteryElement.innerHTML = batteryText;

                l(`Restored last known mag status for ${device.id}: ${magStatus}`);
                l(`Restored last known battery info for ${device.id}: ${batteryText}`);
            });
        });
    }

    /*
     * "Tracker info" event listeners
     */

    document.getElementById("compact-view-switch").addEventListener("change", function () {
        compactView = !compactView;
        l(`Switched compact mode: ${compactView}`);
        window.ipc.send("save-setting", {
            global: {
                compactView: compactView,
            },
        });

        // Disable unsupported settings
        if (compactView) {
            document.getElementById("tracker-visualization-switch").setAttribute("disabled", "true");
        } else {
            document.getElementById("tracker-visualization-switch").removeAttribute("disabled");
        }

        refreshDeviceList();
    });

    document.getElementById("censor-serial-switch").addEventListener("change", function () {
        censorSerialNumbers = !censorSerialNumbers;
        l(`Switched censor serial numbers: ${censorSerialNumbers}`);
        window.ipc.send("save-setting", {
            global: {
                censorSerialNumbers: censorSerialNumbers,
            },
        });

        if (censorSerialNumbers) {
            const devices = document.getElementById("device-list").querySelectorAll(".card");
            devices.forEach((device) => {
                const deviceNameElement = device.querySelector("#device-name");
                const deviceIDElement = device.querySelector("#device-id");

                const deviceID = deviceIDElement.textContent;
                const regex = /^Haritora.*-/;

                if (regex.test(deviceID)) {
                    const censoredText = deviceID.replace(/-.*/, "-XXXXXX");
                    if (deviceNameElement) deviceNameElement.textContent = censoredText;
                    if (deviceIDElement) deviceIDElement.textContent = censoredText;
                }
            });
        } else {
            const devices = document.getElementById("device-list").querySelectorAll(".card");
            devices.forEach(async (device) => {
                const settings = await window.ipc.invoke("get-settings", null);
                const deviceNameElement = device.querySelector("#device-name");
                const deviceIDElement = device.querySelector("#device-id");
                const originalDeviceName = settings.trackers?.[device.id]?.name ?? device.id;

                if (deviceNameElement) {
                    deviceNameElement.textContent = originalDeviceName;
                }

                if (deviceIDElement) {
                    deviceIDElement.textContent = device.id;
                }
            });
        }
    });

    document.getElementById("tracker-visualization-switch").addEventListener("change", function () {
        trackerVisualization = !trackerVisualization;
        l(`Switched tracker visualization: ${trackerVisualization}`);
        window.ipc.send("save-setting", {
            global: {
                trackerVisualization: trackerVisualization,
            },
        });

        // Disable unsupported settings
        if (trackerVisualization) {
            document.getElementById("compact-view-switch").setAttribute("disabled", "true");
        } else {
            document.getElementById("compact-view-switch").removeAttribute("disabled");
        }

        refreshDeviceList();
    });

    /*
     * "Tracker model" event listeners
     */

    document.getElementById("wireless-tracker-switch").addEventListener("change", function () {
        wirelessTrackerEnabled = !wirelessTrackerEnabled;
        l(`Switched wireless tracker to: ${wirelessTrackerEnabled}`);
        window.ipc.send("save-setting", {
            global: {
                trackers: {
                    wirelessTrackerEnabled: wirelessTrackerEnabled,
                },
            },
        });

        window.ipc.send("set-wireless-tracker", wirelessTrackerEnabled);

        // Disable unsupported settings
        if (wirelessTrackerEnabled || bluetoothEnabled) {
            document.getElementById("wired-tracker-switch").setAttribute("disabled", "true");
        } else {
            document.getElementById("wired-tracker-switch").removeAttribute("disabled");
        }
    });

    document.getElementById("wired-tracker-switch").addEventListener("change", function () {
        wiredTrackerEnabled = !wiredTrackerEnabled;
        l(`Switched wired tracker to: ${wiredTrackerEnabled}`);
        window.ipc.send("save-setting", {
            global: {
                trackers: {
                    wiredTrackerEnabled: wiredTrackerEnabled,
                },
            },
        });

        window.ipc.send("set-wired-tracker", wiredTrackerEnabled);

        // Disable unsupported settings
        const ids = ["wireless-tracker-switch", "bluetooth-switch"];
        ids.forEach((id) => {
            const element = document.getElementById(id);
            setElementDisabledState(element, wiredTrackerEnabled);
        });
    });

    /*
     * "Connection mode" event listeners
     */

    document.getElementById("bluetooth-switch").addEventListener("change", function () {
        bluetoothEnabled = !bluetoothEnabled;
        l(`Switched Bluetooth to: ${bluetoothEnabled}`);
        window.ipc.send("save-setting", {
            global: {
                connectionMode: {
                    bluetoothEnabled: bluetoothEnabled,
                },
            },
        });

        if (!wiredTrackerEnabled && wirelessTrackerEnabled) return;
        setElementDisabledState(document.getElementById("wired-tracker-switch"), bluetoothEnabled);
    });

    document.getElementById("com-switch").addEventListener("change", function () {
        comEnabled = !comEnabled;
        l(`Switched COM to: ${comEnabled}`);
        window.ipc.send("save-setting", {
            global: {
                connectionMode: {
                    comEnabled: comEnabled,
                },
            },
        });
    });

    document.getElementById("com-ports").addEventListener("change", () => {
        const comPorts: HTMLInputElement[] = Array.from(document.getElementById("com-ports").querySelectorAll("input"));
        selectedComPorts.length = 0;
        comPorts.forEach((port) => {
            if (port.checked) {
                selectedComPorts.push(port.id);
            }
        });

        l(`Selected COM ports: ${selectedComPorts}`);
        window.ipc.send("save-setting", {
            global: {
                connectionMode: {
                    comPorts: selectedComPorts,
                },
            },
        });

        // If four ports are selected, disable the rest
        if (selectedComPorts.length >= 4 && !bypassCOMPortLimit) {
            comPorts.forEach((port) => {
                if (!port.checked) {
                    port.disabled = true;
                }
            });
        } else {
            // If less than four ports are selected, enable all ports
            comPorts.forEach((port) => {
                port.disabled = false;
            });
        }
    });

    /*
     * "Other settings" event listeners
     */

    document.getElementById("auto-start-switch").addEventListener("change", function () {
        autoStart = !autoStart;
        l(`Switched auto start to: ${autoStart}`);
        window.ipc.send("save-setting", {
            global: {
                autoStart: autoStart,
            },
        });
        window.ipc.send("set-auto-start", autoStart);
    });

    document.getElementById("auto-off-switch").addEventListener("change", function () {
        autoOff = !autoOff;
        l(`Switched auto off to: ${autoOff}`);
        window.ipc.send("save-setting", {
            global: {
                autoOff: autoOff,
            },
        });
        window.ipc.send("set-auto-off", autoOff);
    });

    document.getElementById("tracker-visualization-fps").addEventListener("change", async function () {
        trackerVisualizationFPS = parseInt(
            (document.getElementById("tracker-visualization-fps") as HTMLInputElement).value
        );
        l(`Selected tracker visualization FPS: ${trackerVisualizationFPS}`);
        window.ipc.send("save-setting", {
            global: {
                trackerVisualizationFPS: trackerVisualizationFPS,
            },
        });

        refreshDeviceList();
    });

    document.getElementById("tracker-heartbeat-interval").addEventListener("change", async function () {
        const heartbeatInterval = parseInt(
            (document.getElementById("tracker-heartbeat-interval") as HTMLInputElement).value
        );
        l(`Selected tracker heartbeat interval: ${heartbeatInterval}`);
        window.ipc.send("save-setting", {
            global: {
                trackers: {
                    heartbeatInterval: heartbeatInterval,
                },
            },
        });

        window.ipc.send("set-tracker-heartbeat-interval", heartbeatInterval);
    });

    document.getElementById("server-address").addEventListener("change", async function () {
        serverAddress = (document.getElementById("server-address") as HTMLInputElement).value;
        l(`Changed server address to: ${serverAddress}`);
        window.ipc.send("save-setting", {
            global: {
                serverAddress: serverAddress,
            },
        });

        window.ipc.send("set-server-address", serverAddress);
    });

    document.getElementById("server-port").addEventListener("change", async function () {
        serverPort = parseInt((document.getElementById("server-port") as HTMLInputElement).value);
        l(`Changed server port to: ${serverPort}`);
        window.ipc.send("save-setting", {
            global: {
                serverPort: serverPort,
            },
        });

        window.ipc.send("set-server-port", serverPort);
    });

    document.getElementById("language-select").addEventListener("change", async function () {
        const language: string = (document.getElementById("language-select") as HTMLSelectElement).value;
        selectLanguage(language);
    });

    document.getElementById("fps-mode-select").addEventListener("change", async function () {
        fpsMode = parseInt((document.getElementById("fps-mode-select") as HTMLSelectElement).value);
        l(`Changed FPS mode: ${fpsMode}`);
        window.ipc.send("save-setting", {
            global: {
                trackers: {
                    fpsMode: fpsMode,
                },
            },
        });

        unsavedSettings(true);
    });

    document.getElementById("sensor-mode-select").addEventListener("change", async function () {
        sensorMode = parseInt((document.getElementById("sensor-mode-select") as HTMLSelectElement).value);
        l(`Selected sensor mode: ${sensorMode}`);
        window.ipc.send("save-setting", {
            global: {
                trackers: {
                    sensorMode: sensorMode,
                },
            },
        });

        unsavedSettings(true);
    });

    /*
     * "Tracker auto correction" event listeners
     */

    document.getElementById("accelerometer-switch").addEventListener("change", async function () {
        accelerometerEnabled = !accelerometerEnabled;
        l(`Switched accelerometer to: ${accelerometerEnabled}`);
        window.ipc.send("save-setting", {
            global: {
                trackers: {
                    accelerometerEnabled: accelerometerEnabled,
                },
            },
        });

        unsavedSettings(true);
    });

    document.getElementById("gyroscope-switch").addEventListener("change", async function () {
        gyroscopeEnabled = !gyroscopeEnabled;
        l(`Switched gyroscope enabled: ${gyroscopeEnabled}`);
        window.ipc.send("save-setting", {
            global: {
                trackers: {
                    gyroscopeEnabled: gyroscopeEnabled,
                },
            },
        });

        unsavedSettings(true);
    });

    document.getElementById("magnetometer-switch").addEventListener("change", async function () {
        magnetometerEnabled = !magnetometerEnabled;
        l(`Switched magnetometer enabled: ${magnetometerEnabled}`);
        window.ipc.send("save-setting", {
            global: {
                trackers: {
                    magnetometerEnabled: magnetometerEnabled,
                },
            },
        });

        unsavedSettings(true);
    });

    /*
     * "Update checking" event listeners
     */

    document.getElementById("app-updates-switch").addEventListener("change", async function () {
        const appUpdatesEnabled = (document.getElementById("app-updates-switch") as HTMLInputElement).checked;
        l(`Switched app updates to: ${appUpdatesEnabled}`);
        window.ipc.send("save-setting", {
            global: {
                updates: {
                    appUpdatesEnabled: appUpdatesEnabled,
                },
            },
        });
    });

    document.getElementById("translations-updates-switch").addEventListener("change", async function () {
        const translationsUpdatesEnabled = (document.getElementById("translations-updates-switch") as HTMLInputElement)
            .checked;
        l(`Switched translations updates to: ${translationsUpdatesEnabled}`);
        window.ipc.send("save-setting", {
            global: {
                updates: {
                    translationsUpdatesEnabled: translationsUpdatesEnabled,
                },
            },
        });
    });

    document.getElementById("update-channel-select").addEventListener("change", async function () {
        const updateChannel = (document.getElementById("update-channel-select") as HTMLSelectElement).value;
        l(`Selected update channel: ${updateChannel}`);
        window.ipc.send("save-setting", {
            global: {
                updates: {
                    updateChannel: updateChannel,
                },
            },
        });
    });

    /*
     * "Debug" event listeners
     */

    document.getElementById("log-to-file-switch").addEventListener("change", function () {
        canLogToFile = !canLogToFile;
        l(`Switched log to file: ${canLogToFile}`);
        window.ipc.send("set-log-to-file", canLogToFile);
        window.ipc.send("save-setting", {
            global: {
                debug: {
                    canLogToFile: canLogToFile,
                },
            },
        });
    });

    document.getElementById("bypass-com-limit-switch").addEventListener("change", function () {
        bypassCOMPortLimit = !bypassCOMPortLimit;
        l(`Switched bypass COM port limit: ${bypassCOMPortLimit}`);
        window.ipc.send("save-setting", {
            global: {
                debug: {
                    bypassCOMPortLimit: bypassCOMPortLimit,
                },
            },
        });

        const comPorts: HTMLInputElement[] = Array.from(document.getElementById("com-ports").querySelectorAll("input"));

        if (bypassCOMPortLimit) {
            comPorts.forEach((port) => {
                if (bluetoothEnabled && !comEnabled) {
                    port.disabled = true;
                    return;
                }
                port.disabled = false;
            });
        } else {
            if (selectedComPorts.length >= 4) {
                comPorts.forEach((port) => {
                    if (!port.checked) {
                        port.disabled = true;
                    }
                });
            }
        }
    });

    document.getElementById("logging-mode-select").addEventListener("change", async function () {
        loggingMode = parseInt((document.getElementById("logging-mode-select") as HTMLSelectElement).value);
        l(`Selected logging mode: ${loggingMode}`);
        window.ipc.send("set-logging", canLogToFile);
        window.ipc.send("save-setting", {
            global: {
                debug: {
                    loggingMode: loggingMode,
                },
            },
        });
    });
}

function selectLanguage(language: string) {
    l(`Changed selected language: ${language}`);
    window.changeLanguage(language);
    const languageSelect = document.getElementById("language-select") as HTMLSelectElement;
    if (languageSelect) languageSelect.value = language;
    window.ipc.send("save-setting", {
        global: {
            language: language,
        },
    });
}

function showOnboarding() {
    l("Opening onboarding screen...");
    const language: string = (document.getElementById("language-select") as HTMLSelectElement).value;
    window.ipc.send("show-onboarding", language);
}

function showPairing() {
    l("Opening pairing screen...");
    window.ipc.send("show-pairing", selectedComPorts);
}

function saveSettings() {
    l("Saving settings...");
    unsavedSettings(false);

    // Grab all com-port inputs
    const comPorts: HTMLInputElement[] = Array.from(document.getElementById("com-ports").querySelectorAll("input"));
    const selectedPorts: string[] = [];

    comPorts.forEach((port) => {
        if (port.checked) {
            selectedPorts.push(port.id);
            if (!selectedComPorts.includes(port.id)) selectedComPorts.push(port.id);
        }
    });

    l(`Selected COM ports: ${selectedPorts}`);

    // Save settings to config file
    window.ipc.send("save-setting", {
        global: {
            language: language,
            censorSerialNumbers: censorSerialNumbers,
            trackerVisualization: trackerVisualization,
            trackerVisualizationFPS: trackerVisualizationFPS,
            trackers: {
                wirelessTrackerEnabled: wirelessTrackerEnabled,
                wiredTrackerEnabled: wiredTrackerEnabled,
                fpsMode: fpsMode,
                sensorMode: sensorMode,
                accelerometerEnabled: accelerometerEnabled,
                gyroscopeEnabled: gyroscopeEnabled,
                magnetometerEnabled: magnetometerEnabled,
            },
            connectionMode: {
                bluetoothEnabled: bluetoothEnabled,
                comEnabled: comEnabled,
                comPorts: selectedPorts,
            },
            debug: {
                canLogToFile: canLogToFile,
                bypassCOMPortLimit: bypassCOMPortLimit,
                loggingMode: loggingMode,
            },
            updates: {
                appUpdatesEnabled: appUpdatesEnabled,
                translationsUpdatesEnabled: translationsUpdatesEnabled,
                updateChannel: updateChannel,
            },
        },
    });

    // Send tracker settings to connected trackers
    let sensorAutoCorrection: string[] = [];
    if (accelerometerEnabled) sensorAutoCorrection.push("accel");
    if (gyroscopeEnabled) sensorAutoCorrection.push("gyro");
    if (magnetometerEnabled) sensorAutoCorrection.push("mag");

    if (isActive) {
        window.ipc.send("set-all-tracker-settings", {
            sensorMode,
            fpsMode,
            sensorAutoCorrection,
        });
    }

    l("Settings saved");
}

function simulateChangeEvent(element: HTMLInputElement, value: boolean) {
    if (element.checked === value) return;
    element.checked = value;
    element.dispatchEvent(new Event("change"));
    l(`${value ? "Enabling" : "Disabling"} element "${element.id}"`);
}

/*
 * Export functions to window
 */

window.startConnection = startConnection;
window.stopConnection = stopConnection;
window.showOnboarding = showOnboarding;
window.showPairing = showPairing;
window.saveSettings = saveSettings;
window.turnOffTrackers = () => {
    l("Turning off all trackers...");
    window.ipc.send("turn-off-tracker", "all");
};

window.fixTrackers = () => {
    l("Fixing soft-bricked (boot-looping) trackers...");
    window.ipc.send("fix-trackers", null);

    // Reset settings
    fpsMode = 50;
    sensorMode = 2;
    accelerometerEnabled = true;
    gyroscopeEnabled = false;
    magnetometerEnabled = false;

    setSwitchState("accelerometer-switch", accelerometerEnabled);
    setSwitchState("gyroscope-switch", gyroscopeEnabled);
    setSwitchState("magnetometer-switch", magnetometerEnabled);
    setSelectValue("fps-mode-select", fpsMode.toString());
    setSelectValue("sensor-mode-select", sensorMode.toString());
};

window.openTrackerSettings = async (deviceID: string) => {
    l(`Opening tracker settings for "${deviceID}"`);
    window.ipc.send("open-tracker-settings", deviceID);
};

window.openLogsFolder = () => {
    l("Opening logs folder...");
    window.ipc.send("open-logs-folder", null);
};

window.openSupport = () => {
    l("Opening support page...");
    window.ipc.send("open-support-page", null);
};

export { };

