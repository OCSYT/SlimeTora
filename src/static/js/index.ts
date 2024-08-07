/*
 * Global variables
 */

let isActive = false;

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

let canLogToFile = false;
let skipSlimeVRCheck = false;
let bypassCOMPortLimit = false;

let language = "en";
let censorSerialNumbers = false;
let trackerVisualization = false;
let trackerVisualizationFPS = 10;
let loggingMode = 1;

/*
 * Renderer functions
 */

document.addEventListener("DOMContentLoaded", async function () {
    window.log("DOM loaded");

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

    // Populate COM ports
    const comPortList = document.getElementById("com-ports");
    const comPorts: string[] = await window.ipc.invoke("get-com-ports", null);
    window.log(`COM ports: ${JSON.stringify(comPorts)}`);

    let rowHTML = '<div class="com-port-row">';
    comPorts.forEach((port: string, index: number) => {
        const switchHTML = `
        <div class="switch-container">
            <div class="switch">
            <input type="checkbox" id="${port}" />
            <label for="${port}" class="slider round"></label>
            </div>
            <label for="${port}">${port}</label>
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
    language = settings.global?.language || "en";
    censorSerialNumbers = settings.global?.censorSerialNumbers || false;
    trackerVisualization = settings.global?.trackerVisualization || false;
    trackerVisualizationFPS = settings.global?.trackerVisualizationFPS || 10;
    wirelessTrackerEnabled = settings.global?.trackers?.wirelessTrackerEnabled || false;
    wiredTrackerEnabled = settings.global?.trackers?.wiredTrackerEnabled || false;
    bluetoothEnabled = settings.global?.connectionMode?.bluetoothEnabled || false;
    comEnabled = settings.global?.connectionMode?.comEnabled || false;
    fpsMode = settings.global?.trackers?.fpsMode || 50;
    sensorMode = settings.global?.trackers?.sensorMode || 2;
    accelerometerEnabled = settings.global?.trackers?.accelerometerEnabled || true;
    gyroscopeEnabled = settings.global?.trackers?.gyroscopeEnabled || false;
    magnetometerEnabled = settings.global?.trackers?.magnetometerEnabled || false;
    canLogToFile = settings.global?.debug?.canLogToFile || false;
    loggingMode = settings.global?.debug?.loggingMode || 1;
    skipSlimeVRCheck = settings.global?.debug?.skipSlimeVRCheck || false;
    bypassCOMPortLimit = settings.global?.debug?.bypassCOMPortLimit || false;

    // Set switch states based on settings
    setSwitchState("censor-serial-switch", censorSerialNumbers);
    setSwitchState("visualization-switch", trackerVisualization);
    setSwitchState("wireless-tracker-switch", wirelessTrackerEnabled);
    setSwitchState("wired-tracker-switch", wiredTrackerEnabled);
    setSwitchState("bluetooth-switch", bluetoothEnabled);
    setSwitchState("com-switch", comEnabled);
    setSwitchState("accelerometer-switch", accelerometerEnabled);
    setSwitchState("gyroscope-switch", gyroscopeEnabled);
    setSwitchState("magnetometer-switch", magnetometerEnabled);
    setSwitchState("log-to-file-switch", canLogToFile);
    setSwitchState("skip-slimevr-switch", skipSlimeVRCheck);
    setSwitchState("bypass-com-limit-switch", bypassCOMPortLimit);

    // Set select values based on settings
    setSelectValue("fps-mode-select", fpsMode.toString());
    setSelectValue("sensor-mode-select", sensorMode.toString());
    setSelectValue("language-select", language.toString());
    setSelectValue("logging-mode-select", loggingMode.toString());

    // Set input values based on settings
    const trackerVisualizationFPSInput = document.getElementById("tracker-visualization-fps") as HTMLInputElement;
    trackerVisualizationFPSInput.value = trackerVisualizationFPS.toString();

    // Set the selected COM ports
    const comPortsSwitches = Array.from(document.getElementById("com-ports").querySelectorAll("input"));
    const selectedPorts: string[] = settings.global?.connectionMode?.comPorts || [];

    comPortsSwitches.forEach((port) => {
        if (selectedPorts.includes(port.id)) port.checked = true;
    });

    // Check if the selected COM ports are still available
    let isMissingPorts = false;
    selectedPorts.forEach((port) => {
        if (!comPorts.includes(port)) {
            window.log(`COM port ${port} in config was not found in user's available COM ports`);
            selectedPorts.splice(selectedPorts.indexOf(port), 1);
            isMissingPorts = true;
        }
    });

    if (isMissingPorts) {
        setStatus("main.status.comPortsMissing");
        window.ipc.invoke("show-error", {
            title: "dialogs.comPortsMissing.title",
            message: "dialogs.comPortsMissing.message",
        });
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

    // Set program statuses
    setStatus("main.status.none");
    document.getElementById("tracker-count").textContent = document
        .getElementById("tracker-count")
        .textContent.replace("{trackerCount}", "0");

    window.log(`Language set to: ${language}`);
    window.log(`Settings loaded:\r\n${JSON.stringify(settings, null, 4)}`);

    addEventListeners();
});

window.addEventListener("storage", (event) => {
    window.log(`Storage event: "${event.key}" changed to "${event.newValue}"`);

    if (event.key === "autodetect" && event.newValue === "true") {
        autodetect();
        localStorage.setItem("autodetect", "false");
    } else if (event.key === "startConnection" && event.newValue === "true") {
        startConnection();
        localStorage.setItem("startConnection", "false");
    } else if (event.key === "stopConnection" && event.newValue === "true") {
        stopConnection();
        localStorage.setItem("stopConnection", "false");
    } else if (event.key === "language") {
        selectLanguage(event.newValue);
    }
});

/*
 * Connection handling
 */

async function autodetect() {
    showMessageBox("dialogs.autodetect.pre-check.title", "dialogs.autodetect.pre-check.message", true);

    window.log("Running auto-detection...");
    setStatus("main.status.autodetect.running");

    const autodetectObject = await window.ipc.invoke("autodetect", null);
    const devices: Set<string> = new Set(autodetectObject.devices);
    const trackerSettings = autodetectObject.trackerSettings;

    window.log(`Auto-detect: found devices: ${Array.from(devices).join(", ")}`);

    let detectedTrackerModel = "";
    let detectedConnectionModes: string[] = [];

    function simulateChangeEvent(element: HTMLInputElement, value: boolean) {
        if (element.checked === value) return;
        element.checked = value;
        element.dispatchEvent(new Event("change"));
        window.log(`Auto-detect: ${value ? "enabling" : "disabling"} element ${element.id}`);
    }

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

        window.log(`Auto-detect: found ${deviceName}`);
        window.log(`Auto-detect: COM ports for ${deviceName}: ${comPorts}`);
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
                window.log("Auto-detect: found HaritoraX Wireless and GX2, enabling Bluetooth and COM");
            }
        },
        Bluetooth: async () => {
            detectedConnectionModes.push("Bluetooth");
            simulateChangeEvent(document.getElementById("bluetooth-switch") as HTMLInputElement, true);
            if (!devices.has("HaritoraX Wireless") || !devices.has("HaritoraX Wired")) {
                // Assume HaritoraX Wireless if no other devices are found
                window.log("Auto-detect: no other devices found, assuming HaritoraX Wireless");
                detectedTrackerModel = "HaritoraX Wireless";
                simulateChangeEvent(document.getElementById("wireless-tracker-switch") as HTMLInputElement, true);
            }
        },
    };

    for (const device of devices) if (deviceHandlers[device]) await deviceHandlers[device]();

    if (devices.size === 0) {
        // If somehow, literally nothing is found...
        window.error("No devices found during auto-detection");
        await showErrorDialog("dialogs.autodetect.failed.title", "dialogs.autodetect.failed.message");
        setStatus("main.status.autodetect.failed");
    } else {
        window.log(`Auto-detect: completed, detected ${Array.from(devices).join(", ")}`);
        const message = await window.translate("dialogs.autodetect.success.message");

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

async function startConnection() {
    window.log("Starting connection...");
    setStatus("main.status.searchingServer");

    try {
        if (!skipSlimeVRCheck) {
            const slimeVRFound: boolean = await window.ipc.invoke("search-for-server", null);
            if (!(await handleSlimeVRCheck(slimeVRFound))) return false;
        }

        if (!(await handleTrackerModelCheck())) return false;
        if (!(await handleConnectionType())) return false;
    } catch (err) {
        window.error(`Error starting connection: ${err}`);
        return false;
    }

    toggleConnectionButtons();
}

function stopConnection() {
    if (!isActive) {
        window.error(
            "No connection to stop.. wait a second, you shouldn't be seeing this - get out of inspect element and stop trying to break the program!"
        );
        return;
    }
    window.log("Stopping connection(s)...");

    toggleConnectionButtons();

    window.ipc.send("stop-connection", null);

    setStatus("main.status.none");
    document.getElementById("tracker-count").textContent = "0";
    document.getElementById("device-list").textContent = "";

    localStorage.setItem("trackerCount", document.getElementById("tracker-count").textContent);
}

// Helper functions
function toggleConnectionButtons() {
    isActive = !isActive;
    document.getElementById("start-connection-button").toggleAttribute("disabled");
    document.getElementById("stop-connection-button").toggleAttribute("disabled");
    localStorage.setItem("toggleConnectionButtons", isActive.toString());
}

async function handleSlimeVRCheck(slimeVRFound: boolean) {
    if (!slimeVRFound) {
        const errorKey = skipSlimeVRCheck
            ? "SlimeVR check skipped"
            : "Tried to start connection while not connected to SlimeVR";
        window.log(errorKey);
        if (!skipSlimeVRCheck) {
            setStatus("main.status.slimeVRMissing");
            return false;
        }
    }
    return true;
}

async function handleTrackerModelCheck() {
    if (!wirelessTrackerEnabled && !wiredTrackerEnabled) {
        window.error("No tracker model enabled");
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
                    window.error("No COM ports selected");
                    setStatus("main.status.noComPorts");
                    await showErrorDialog("dialogs.noComPorts.title", "dialogs.noComPorts.message");
                    return false;
                }
                types.push("com");
            }
            window.ipc.send("start-connection", { types, ports: selectedComPorts, isActive });
            window.log(`Starting ${types.join(" and ")} connection with ports: ${selectedComPorts}`);
            return true;
        } else {
            window.error("No connection mode enabled");
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

    const finalStatus = translate ? await window.translate(status) : status;
    statusElement.textContent = finalStatus;
    window.log(`Set status to: ${finalStatus}`);

    if (translate) statusElement.setAttribute("data-i18n", status);

    localStorage.setItem("status", finalStatus);
}

async function showMessageBox(
    titleKey: string,
    messageKey: string,
    blocking: boolean = false,
    translateTitle: boolean = true,
    translateMessage: boolean = true
) {
    return await window.ipc.invoke("show-message", {
        title: titleKey,
        message: messageKey,
        blocking,
        translateTitle,
        translateMessage,
    });
}

async function showErrorDialog(
    titleKey: string,
    messageKey: string,
    translateTitle: boolean = true,
    translateMessage: boolean = true
) {
    const title = translateTitle ? await window.translate(titleKey) : titleKey;
    const message = translateMessage ? await window.translate(messageKey) : messageKey;

    return await window.ipc.invoke("show-error", {
        title: title,
        message: message,
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

    window.log(`Connected to ${deviceID}`);

    if (!deviceQueue.includes(deviceID)) deviceQueue.push(deviceID);
    await processQueue();

    setStatus("main.status.connected");

    if (wiredTrackerEnabled) return;

    const settings = await window.ipc.invoke("get-settings", null);
    const exists = settings.trackers?.[deviceID].fpsMode !== undefined;
    window.log(`Tracker settings for ${deviceID} exists: ${exists}`);

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
    window.log(`Got tracker settings for ${deviceID}: ${JSON.stringify(trackerSettings)}`);

    setTrackerSettings(deviceID, trackerSettings);
});

window.ipc.on("disconnect", (_event, deviceID) => {
    if (!deviceID || !isActive) return;

    window.log(`Disconnected from ${deviceID}`);
    document.getElementById(deviceID).remove();
    document.getElementById("tracker-count").textContent = (
        parseInt(document.getElementById("tracker-count").textContent) - 1
    ).toString();

    localStorage.setItem("trackerCount", document.getElementById("tracker-count").textContent);

    if (document.getElementById("tracker-count").textContent === "0") setStatus("searching");
});

window.ipc.on("device-connected-to-server", (_event, deviceID) => {
    if (!deviceID || !isActive) return;

    window.log(`Tracker ${deviceID} connected to server, firing battery and mag events...`);
    // TODO: unknown if wired trackers report these immediately when COM port opens, check with users
    window.ipc.invoke("fire-tracker-battery", deviceID);
    window.ipc.invoke("fire-tracker-mag", deviceID);
});

window.ipc.on("device-data", async (_event: any, arg) => {
    const { trackerName, rotation, gravity, rawRotation, rawGravity } = arg;

    if (!isActive) return;

    const trackerElement = document.getElementById(trackerName);
    if (!trackerElement) {
        handleMissingDevice(trackerName);
        return;
    }

    updateTrackerData(trackerElement, rotation, gravity);
    sendVisualizationData(trackerName, rawRotation, rawGravity);
});

window.ipc.on("device-battery", (_event, arg) => {
    let { trackerName, batteryRemaining, batteryVoltage } = arg;
    if (!isActive || (!batteryRemaining && batteryRemaining !== 0) || (!batteryVoltage && batteryVoltage !== 0)) return;

    if (batteryVoltage > 10) batteryVoltage = batteryVoltage / 1000;

    if (trackerName === "HaritoraXWired") {
        updateAllTrackerBatteries(batteryRemaining, batteryVoltage);
    } else {
        updateTrackerBattery(trackerName, batteryRemaining, batteryVoltage);
    }

    window.log(`Battery for ${trackerName}: ${batteryRemaining}% (${batteryVoltage}V)`);
});

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
    window.log(`Adding device to device list: ${deviceID}`);

    const settings: { [key: string]: any } = await window.ipc.invoke("get-settings", null);
    const deviceList = document.getElementById("device-list");

    // Create a new div element
    const newDevice = document.createElement("div");
    newDevice.id = deviceID;
    newDevice.className = "column is-6 is-flex-grow-1";

    // Check if device has a user-specified name
    const deviceName: string = settings.trackers?.[deviceID]?.name || deviceID;
    if (deviceName !== deviceID) window.log(`Got user-specified name for ${deviceID}: ${deviceName}`);

    // Fill the div with device data
    newDevice.innerHTML = `
        <div class="card" id="${deviceID}">
            <header class="card-header">
                <div>
                    <p class="card-header-title is-centered inline-block" data-i18n="trackerInfo.deviceName">
                        Device:
                    </p><span class="has-text-white has-text-weight-bold" id="device-name">${deviceName}</span>
                </div>
                <div class="edit-button-container">
                    <button id="edit-button" class="button is-info" data-i18n="trackerInfo.edit">Edit</button>
                </div>
            </header>
            <div class="card-content">
                <div class="content">
                    <p class="inline-block" data-i18n="trackerInfo.deviceID">Device ID:</p> <span id="device-id">${deviceID}</span><br>
                    <p class="inline-block" data-i18n="trackerInfo.rotationData">Rotation Data:</p> <span id="rotation-data">0, 0, 0</span><br>
                    <p class="inline-block" data-i18n="trackerInfo.accelerationData">Acceleration Data:</p> <span id="acceleration-data">0, 0, 0</span><br>
                    <p class="inline-block" data-i18n="trackerInfo.battery">Battery:</p> <span id="battery">N/A</span><br>
                    <p class="inline-block" data-i18n="trackerInfo.magStatus">Mag status:</p> <span id="mag-status"></span><br>
                </div>
            </div>
            <footer class="card-footer">
                <div class="card-footer-item">
                    <button id="tracker-settings-button" data-i18n="trackerInfo.settings" onclick="openTrackerSettings('${deviceID}')" class="button is-info" data-i18n="trackerInfo.settings">Override tracker settings</button>
                </div>
            </footer>
        </div>
        `;

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
            if (event.key === "Enter") {
                handleNameChange();
            }
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

    if (!editButton || !deviceNameElement || !deviceIDElement) return;

    editButton.addEventListener("click", startEditing);
    deviceNameElement.addEventListener("click", startEditing);

    // Censor serial if BT tracker and censorSerialNumbers is enabled
    if (deviceID.startsWith("HaritoraXW") && censorSerialNumbers) {
        if (deviceName === deviceID) deviceNameElement.textContent = "HaritoraXW-XXXXXX";
        deviceIDElement.textContent = "HaritoraXW-XXXXXX";
    } else if (deviceID.startsWith("HaritoraX") && censorSerialNumbers) {
        if (deviceName === deviceID) deviceNameElement.textContent = "HaritoraX-XXXXXX";
        deviceIDElement.textContent = "HaritoraX-XXXXXX";
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
        window.log(`Disabled tracker settings button for ${deviceID} (wired tracker)`);
    }

    deviceList.appendChild(newDevice);

    window.localize();
}

function setTrackerSettings(deviceID: string, trackerSettings: any) {
    const sensorMode: number = trackerSettings.sensorMode !== -1 ? trackerSettings.sensorMode : 2;
    const fpsMode: number = trackerSettings.fpsMode !== -1 ? trackerSettings.fpsMode : 50;
    let sensorAutoCorrection: Set<string> = new Set(trackerSettings.sensorAutoCorrection);

    if (accelerometerEnabled) {
        sensorAutoCorrection.add("accel");
        window.log("Added accel to sensor auto correction");
    }
    if (gyroscopeEnabled) {
        sensorAutoCorrection.add("gyro");
        window.log("Added gyro to sensor auto correction");
    }
    if (magnetometerEnabled) {
        sensorAutoCorrection.add("mag");
        window.log("Added mag to sensor auto correction");
    }

    window.log(`Set sensor auto correction for ${deviceID} to: ${Array.from(sensorAutoCorrection).join(",")}`);

    window.ipc.send("set-tracker-settings", {
        deviceID,
        sensorMode,
        fpsMode,
        sensorAutoCorrection: Array.from(sensorAutoCorrection),
    });
}

async function handleMissingDevice(trackerName: string) {
    if (!deviceQueue.includes(trackerName)) {
        window.ipc.send("log", `Device ${trackerName} not found in DOM, adding to queue`);
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

window.ipc.on("localize", (_event, resources) => {
    window.localize(resources);
});

window.ipc.on("version", (_event, version) => {
    document.getElementById("version").textContent = version;
    window.log(`Got app version: ${version}`);
});

window.ipc.on("set-status", (_event, msg) => {
    setStatus(msg);
});

function addEventListeners() {
    /*
     * "Tracker info" event listeners
     */

    document.getElementById("censor-serial-switch").addEventListener("change", function () {
        censorSerialNumbers = !censorSerialNumbers;
        window.log(`Switched censor serial numbers: ${censorSerialNumbers}`);
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

                if (!deviceNameElement || !deviceIDElement) return;

                const deviceName = deviceNameElement.textContent;
                const deviceID = deviceIDElement.textContent;

                if (deviceName.includes("HaritoraX") && deviceName === device.id) {
                    deviceNameElement.textContent = "HaritoraX-XXXXXX";
                }

                if (deviceID.includes("HaritoraX")) {
                    deviceIDElement.textContent = "HaritoraX-XXXXXX";
                }

                if (deviceName.includes("HaritoraXW") && deviceName === device.id) {
                    deviceNameElement.textContent = "HaritoraXW-XXXXXX";
                }

                if (deviceID.includes("HaritoraXW")) {
                    deviceIDElement.textContent = "HaritoraXW-XXXXXX";
                }
            });
        } else {
            const devices = document.getElementById("device-list").querySelectorAll(".card");
            devices.forEach(async (device) => {
                const settings = await window.ipc.invoke("get-settings", null);
                const deviceNameElement = device.querySelector("#device-name");
                const deviceIDElement = device.querySelector("#device-id");
                const originalDeviceName = settings.trackers?.[device.id]?.name || device.id;

                if (!deviceNameElement || !deviceIDElement) return;

                deviceNameElement.textContent = originalDeviceName;
                deviceIDElement.textContent = device.id;
            });
        }
    });

    document.getElementById("visualization-switch").addEventListener("change", function () {
        trackerVisualization = !trackerVisualization;
        window.log(`Switched tracker visualization: ${trackerVisualization}`);
        window.ipc.send("save-setting", {
            global: {
                trackerVisualization: trackerVisualization,
            },
        });
    });

    /*
     * "Tracker model" event listeners
     */

    document.getElementById("wireless-tracker-switch").addEventListener("change", function () {
        wirelessTrackerEnabled = !wirelessTrackerEnabled;
        window.log(`Switched wireless tracker to: ${wirelessTrackerEnabled}`);
        window.ipc.send("save-setting", {
            global: {
                trackers: {
                    wirelessTrackerEnabled: wirelessTrackerEnabled,
                },
            },
        });

        window.ipc.send("set-wireless-tracker", wirelessTrackerEnabled);

        // Disable unsupported settings
        if (wirelessTrackerEnabled) {
            document.getElementById("wired-tracker-switch").setAttribute("disabled", "true");
        } else {
            document.getElementById("wired-tracker-switch").removeAttribute("disabled");
        }
    });

    document.getElementById("wired-tracker-switch").addEventListener("change", function () {
        wiredTrackerEnabled = !wiredTrackerEnabled;
        window.log(`Switched wired tracker to: ${wiredTrackerEnabled}`);
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
        window.log(`Switched Bluetooth to: ${bluetoothEnabled}`);
        window.ipc.send("save-setting", {
            global: {
                connectionMode: {
                    bluetoothEnabled: bluetoothEnabled,
                },
            },
        });

        setElementDisabledState(document.getElementById("wired-tracker-switch"), bluetoothEnabled);
    });

    document.getElementById("com-switch").addEventListener("change", function () {
        comEnabled = !comEnabled;
        window.log(`Switched COM to: ${comEnabled}`);
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

        window.log(`Selected COM ports: ${selectedComPorts}`);
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
     * Other settings event listeners
     */

    document.getElementById("tracker-visualization-fps").addEventListener("change", async function () {
        trackerVisualizationFPS = parseInt(
            (document.getElementById("tracker-visualization-fps") as HTMLInputElement).value
        );
        window.log(`Selected tracker visualization FPS: ${trackerVisualizationFPS}`);
        window.ipc.send("save-setting", {
            global: {
                trackerVisualizationFPS: trackerVisualizationFPS,
            },
        });
    });

    document.getElementById("language-select").addEventListener("change", async function () {
        const language: string = (document.getElementById("language-select") as HTMLSelectElement).value;
        selectLanguage(language);
    });

    document.getElementById("fps-mode-select").addEventListener("change", async function () {
        fpsMode = parseInt((document.getElementById("fps-mode-select") as HTMLSelectElement).value);
        window.log(`Changed FPS mode: ${fpsMode}`);
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
        window.log(`Selected sensor mode: ${sensorMode}`);
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
        window.log(`Switched accelerometer to: ${accelerometerEnabled}`);
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
        window.log(`Switched gyroscope enabled: ${gyroscopeEnabled}`);
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
        window.log(`Switched magnetometer enabled: ${magnetometerEnabled}`);
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
     * "Debug" event listeners
     */

    document.getElementById("log-to-file-switch").addEventListener("change", function () {
        canLogToFile = !canLogToFile;
        window.log(`Switched log to file: ${canLogToFile}`);
        window.ipc.send("set-log-to-file", canLogToFile);
        window.ipc.send("save-setting", {
            global: {
                debug: {
                    canLogToFile: canLogToFile,
                },
            },
        });
    });

    document.getElementById("skip-slimevr-switch").addEventListener("change", function () {
        skipSlimeVRCheck = !skipSlimeVRCheck;
        window.log(`Switched skip SlimeVR check: ${skipSlimeVRCheck}`);
        window.ipc.send("save-setting", {
            global: {
                debug: {
                    skipSlimeVRCheck: skipSlimeVRCheck,
                },
            },
        });
    });

    document.getElementById("bypass-com-limit-switch").addEventListener("change", function () {
        bypassCOMPortLimit = !bypassCOMPortLimit;
        window.log(`Switched bypass COM port limit: ${bypassCOMPortLimit}`);
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
        window.log(`Selected logging mode: ${loggingMode}`);
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
    window.log(`Changed selected language: ${language}`);
    window.changeLanguage(language);
    window.ipc.send("save-setting", {
        global: {
            language: language,
        },
    });
}

function showOnboarding() {
    window.log("Reopening onboarding screen...");
    const language: string = (document.getElementById("language-select") as HTMLSelectElement).value;
    window.ipc.send("show-onboarding", language);
}

function saveSettings() {
    window.log("Saving settings...");
    unsavedSettings(false);

    // Grab all com-port inputs
    const comPorts: HTMLInputElement[] = Array.from(document.getElementById("com-ports").querySelectorAll("input"));
    const selectedPorts: string[] = [];

    comPorts.forEach((port) => {
        if (port.checked) {
            selectedPorts.push(port.id);
        }
    });

    window.log(`Selected COM ports: ${selectedPorts}`);

    // Save settings to config file
    window.ipc.send("save-setting", {
        global: {
            censorSerialNumbers: censorSerialNumbers,
            trackerVisualization: trackerVisualization,
            trackerVisualizationFPS: trackerVisualizationFPS,
            connectionMode: {
                bluetoothEnabled: bluetoothEnabled,
                comEnabled: comEnabled,
                comPorts: selectedPorts,
            },
            trackers: {
                fpsMode: fpsMode,
                sensorMode: sensorMode,
                accelerometerEnabled: accelerometerEnabled,
                gyroscopeEnabled: gyroscopeEnabled,
                magnetometerEnabled: magnetometerEnabled,
            },
            debug: {
                canLogToFile: canLogToFile,
                skipSlimeVRCheck: skipSlimeVRCheck,
                bypassCOMPortLimit: bypassCOMPortLimit,
                loggingMode: loggingMode,
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

    window.log("Settings saved");
}

/*
 * Export functions to window
 */

window.startConnection = startConnection;
window.stopConnection = stopConnection;
window.showOnboarding = showOnboarding;
window.saveSettings = saveSettings;

window.openTrackerSettings = async (deviceID: string) => {
    window.log(`Opening tracker settings for ${deviceID}`);
    window.ipc.send("open-tracker-settings", deviceID);
};

window.openLogsFolder = () => {
    window.log("Opening logs folder...");
    window.ipc.send("open-logs-folder", null);
};

export {};
