/*
 * Global variables
 */

let isActive = false;

let bluetoothEnabled = false;
let gxEnabled = false;
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
let debugTrackerConnections = false;

let language = "en";
let censorSerialNumbers = false;
let trackerVisualization = false;
let trackerVisualizationFPS = 10;

/*
 * Renderer functions
 */

document.addEventListener("DOMContentLoaded", async function () {
    window.log("DOM loaded");

    // Populate COM port switches
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

    languages.forEach((language: string) => {
        const option = document.createElement("option");
        option.value = language;
        option.text = language;
        languageSelect.appendChild(option);
    });

    // Get settings from config file
    const settings: { [key: string]: any } = await window.ipc.invoke("get-settings", null);
    language = settings.global?.language || "en";
    censorSerialNumbers = settings.global?.censorSerialNumbers || false;
    trackerVisualization = settings.global?.trackerVisualization || false;
    trackerVisualizationFPS = settings.global?.trackerVisualizationFPS || 10;
    wirelessTrackerEnabled = settings.global?.trackers?.wirelessTrackerEnabled || false;
    wiredTrackerEnabled = settings.global?.trackers?.wiredTrackerEnabled || false;
    bluetoothEnabled = settings.global?.connectionMode?.bluetoothEnabled || false;
    gxEnabled = settings.global?.connectionMode?.gxEnabled || false;
    fpsMode = settings.global?.trackers?.fpsMode || 50;
    sensorMode = settings.global?.trackers?.sensorMode || 2;
    accelerometerEnabled = settings.global?.trackers?.accelerometerEnabled || true;
    gyroscopeEnabled = settings.global?.trackers?.gyroscopeEnabled || false;
    magnetometerEnabled = settings.global?.trackers?.magnetometerEnabled || false;
    canLogToFile = settings.global?.debug?.canLogToFile || false;
    skipSlimeVRCheck = settings.global?.debug?.skipSlimeVRCheck || false;
    bypassCOMPortLimit = settings.global?.debug?.bypassCOMPortLimit || false;
    debugTrackerConnections = settings.global?.debug?.debugTrackerConnections || false;

    // Get the checkbox elements
    const censorSerialNumbersSwitch = document.getElementById(
        "censor-serial-switch"
    ) as HTMLInputElement;
    const trackerVisualizationSwitch = document.getElementById(
        "visualization-switch"
    ) as HTMLInputElement;
    const wirelessTrackerSwitch = document.getElementById(
        "wireless-tracker-switch"
    ) as HTMLInputElement;
    const wiredTrackerSwitch = document.getElementById("wired-tracker-switch") as HTMLInputElement;
    const bluetoothSwitch = document.getElementById("bluetooth-switch") as HTMLInputElement;
    const gxSwitch = document.getElementById("gx-switch") as HTMLInputElement;
    const accelerometerSwitch = document.getElementById("accelerometer-switch") as HTMLInputElement;
    const gyroscopeSwitch = document.getElementById("gyroscope-switch") as HTMLInputElement;
    const magnetometerSwitch = document.getElementById("magnetometer-switch") as HTMLInputElement;
    const logToFileSwitch = document.getElementById("log-to-file-switch") as HTMLInputElement;
    const skipSlimeVRSwitch = document.getElementById("skip-slimevr-switch") as HTMLInputElement;
    const bypassCOMPortLimitSwitch = document.getElementById(
        "bypass-com-limit-switch"
    ) as HTMLInputElement;
    const debugTrackerConnectionsSwitch = document.getElementById(
        "debug-tracker-connections-switch"
    ) as HTMLInputElement;

    // Set the checked property based on the settings
    censorSerialNumbersSwitch.checked = censorSerialNumbers;
    trackerVisualizationSwitch.checked = trackerVisualization;
    wirelessTrackerSwitch.checked = wirelessTrackerEnabled;
    wiredTrackerSwitch.checked = wiredTrackerEnabled;
    bluetoothSwitch.checked = bluetoothEnabled;
    gxSwitch.checked = gxEnabled;
    accelerometerSwitch.checked = accelerometerEnabled;
    gyroscopeSwitch.checked = gyroscopeEnabled;
    magnetometerSwitch.checked = magnetometerEnabled;
    logToFileSwitch.checked = canLogToFile;
    skipSlimeVRSwitch.checked = skipSlimeVRCheck;
    bypassCOMPortLimitSwitch.checked = bypassCOMPortLimit;
    debugTrackerConnectionsSwitch.checked = debugTrackerConnections;

    // Get the select elements
    const fpsSelect = document.getElementById("fps-mode-select") as HTMLSelectElement;
    const sensorModeSelect = document.getElementById("sensor-mode-select") as HTMLSelectElement;

    // Set the selected option based on the settings
    fpsSelect.value = fpsMode.toString();
    sensorModeSelect.value = sensorMode.toString();
    languageSelect.value = language.toString();

    // Set the selected COM ports
    const comPortsSwitches = Array.from(
        document.getElementById("com-ports").querySelectorAll("input")
    );
    const selectedPorts: string[] = settings.global?.connectionMode?.comPorts || [];

    comPortsSwitches.forEach((port) => {
        if (selectedPorts.includes(port.id)) {
            port.checked = true;
        }
    });

    // Set input values
    const trackerVisualizationFPSInput = document.getElementById(
        "tracker-visualization-fps"
    ) as HTMLInputElement;
    trackerVisualizationFPSInput.value = trackerVisualizationFPS.toString();

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
        setStatus(await window.translate("main.status.comPortsMissing"));
        window.ipc.send("show-error", {
            title: await window.translate("dialogs.comPortsMissing.title"),
            message: await window.translate("dialogs.comPortsMissing.message"),
        });
    }

    selectedComPorts.push(...selectedPorts);

    window.log(`Settings loaded:\r\n${JSON.stringify(settings, null, 4)}`);

    setStatus(await window.translate("main.status.none"));
    document.getElementById("tracker-count").textContent = document
        .getElementById("tracker-count")
        .textContent.replace("{trackerCount}", "0");

    window.changeLanguage(language);

    addEventListeners();
});

async function startConnection() {
    window.log("Starting connection...");

    const slimeVRFound: boolean = await window.ipc.invoke("is-slimevr-connected", null);
    if (!slimeVRFound && !skipSlimeVRCheck) {
        window.error("Tried to start connection while not connected to SlimeVR");
        setStatus(await window.translate("main.status.slimeVRMissing"));
        return;
    } else if (!slimeVRFound && skipSlimeVRCheck) {
        window.log("SlimeVR check skipped");
    }

    if (bluetoothEnabled && gxEnabled) {
        window.ipc.send("start-connection", {
            types: ["bluetooth", "com"],
            ports: selectedComPorts,
            isActive,
        });
        window.log(`Starting Bluetooth and GX connection with ports: ${selectedComPorts}`);
    } else if (bluetoothEnabled) {
        window.ipc.send("start-connection", { types: ["bluetooth"], isActive });
        window.log("Starting Bluetooth connection");
    } else if (gxEnabled) {
        window.ipc.send("start-connection", {
            types: ["com"],
            ports: selectedComPorts,
            isActive,
        });
        window.log(`Starting GX connection with ports: ${selectedComPorts}`);
    } else {
        window.error("No connection mode enabled");
        setStatus(await window.translate("main.status.noConnectionMode"));
        window.ipc.send("show-error", {
            title: await window.translate("dialogs.noConnectionMode.title"),
            message: await window.translate("dialogs.noConnectionMode.message"),
        });
        return false;
    }

    // Disable start connection button and enable stop connection button
    document.getElementById("start-connection-button").setAttribute("disabled", "true");
    document.getElementById("stop-connection-button").removeAttribute("disabled");

    isActive = true;
}

async function stopConnection() {
    if (!isActive || (!bluetoothEnabled && !gxEnabled)) {
        window.error("No connection to stop");
        window.error(
            "..wait a second, you shouldn't be seeing this! get out of inspect element and stop trying to break the program!"
        );
        return;
    }
    window.log("Stopping connection(s)...");

    // Enable start connection button and disable stop connection button
    document.getElementById("start-connection-button").removeAttribute("disabled");
    document.getElementById("stop-connection-button").setAttribute("disabled", "true");

    if (bluetoothEnabled) window.ipc.send("stop-connection", "bluetooth");
    if (gxEnabled) window.ipc.send("stop-connection", "com");

    setStatus(await window.translate("main.status.none"));
    document.getElementById("tracker-count").textContent = "0";
    document.getElementById("device-list").textContent = "";
    isActive = false;
}

function openLogsFolder() {
    window.log("Opening logs folder...");
    window.ipc.send("open-logs-folder", null);
}

// "Save settings" (manual save) button
function saveSettings() {
    window.log("Saving settings...");
    unsavedSettings(false);

    // Grab all com-port inputs
    const comPorts: HTMLInputElement[] = Array.from(
        document.getElementById("com-ports").querySelectorAll("input")
    );
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
                gxEnabled: gxEnabled,
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
                debugTrackerConnections: debugTrackerConnections,
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
 * Renderer helper functions
 */

function setStatus(status: string) {
    document.getElementById("status").textContent = status;
    window.log(`Set status to: ${status}`);
}

// Use a queue to handle adding device to the list, prevents async issues
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
    if (deviceName !== deviceID)
        window.log(`Got user-specified name for ${deviceID}: ${deviceName}`);

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
    if (trackerCount)
        trackerCount.textContent = (
            parseInt(document.getElementById("tracker-count").textContent) + 1
        ).toString();

    window.ipc.send("get-tracker-battery", deviceID);

    deviceList.appendChild(newDevice);

    window.localize();
}

/*
 * Event listeners
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

/*
 * Tracker device (haritorax-interpreter) event listeners
 */

window.ipc.on("connect", async (_event, deviceID) => {
    if (!isActive) return;

    window.log(`Connected to ${deviceID}`);

    if (!deviceQueue.includes(deviceID)) deviceQueue.push(deviceID);
    processQueue();

    setStatus(await window.translate("main.status.connected"));

    if (wiredTrackerEnabled) return;

    const settings = await window.ipc.invoke("get-settings", null);
    const exists = settings.trackers?.[deviceID] !== undefined;

    const trackerSettings = exists
        ? settings.trackers[deviceID]
        : await window.ipc.invoke("get-tracker-settings", {
              trackerName: deviceID,
          });
    setTrackerSettings(deviceID, trackerSettings);

    window.ipc.invoke("get-tracker-battery", deviceID);
    window.ipc.invoke("get-tracker-mag", deviceID);
});

// Helper for "connect" event
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

    window.log(
        `Set sensor auto correction for ${deviceID} to: ${Array.from(sensorAutoCorrection).join(
            ","
        )}`
    );

    window.ipc.send("set-tracker-settings", {
        deviceID,
        sensorMode,
        fpsMode,
        sensorAutoCorrection: Array.from(sensorAutoCorrection),
    });
}

window.ipc.on("disconnect", (_event, deviceID) => {
    window.log(`Disconnected from ${deviceID}`);
    document.getElementById(deviceID).remove();
    document.getElementById("tracker-count").textContent = (
        parseInt(document.getElementById("tracker-count").textContent) - 1
    ).toString();

    if (document.getElementById("tracker-count").textContent === "0") setStatus("searching");
});

window.ipc.on("device-data", async (_event: any, arg) => {
    const {
        trackerName,
        rotation,
        gravity,
        rawRotation,
        rawGravity,
    }: {
        trackerName: string;
        rotation: Rotation;
        gravity: Gravity;
        rawRotation: Rotation;
        rawGravity: Gravity;
    } = arg;
    if (!isActive) return;
    if (!document.getElementById(trackerName)) {
        if (!deviceQueue.includes(trackerName)) {
            window.ipc.send("log", `Device ${trackerName} not found in DOM, adding to queue`);
            deviceQueue.push(trackerName);
        }
        await processQueue();
        return;
    }

    console.log(`Rotation for ${trackerName}: ${JSON.stringify(rotation)}`);

    const rotationText = `${rotation.x.toFixed(0)}, ${rotation.y.toFixed(0)}, ${rotation.z.toFixed(
        0
    )}`;
    const gravityText = `${gravity.x.toFixed(0)}, ${gravity.y.toFixed(0)}, ${gravity.z.toFixed(0)}`;

    const rotationDataElement = document
        .getElementById(trackerName)
        .querySelector("#rotation-data");
    const accelerationDataElement = document
        .getElementById(trackerName)
        .querySelector("#acceleration-data");

    if (!rotationDataElement || !accelerationDataElement) return;

    rotationDataElement.textContent = rotationText;
    accelerationDataElement.textContent = gravityText;

    // check if {trackerID}-visualization exists, and if so, send data to it
    const visualizationIframe = document.getElementById(
        `${trackerName}-visualization`
    ) as HTMLIFrameElement;
    if (visualizationIframe)
        visualizationIframe.contentWindow.postMessage(
            { rotation: rawRotation, gravity: rawGravity },
            "*"
        );
});

window.ipc.on("device-battery", (_event, arg) => {
    const {
        trackerName,
        batteryRemaining,
        batteryVoltage,
    }: {
        trackerName: string;
        batteryRemaining: number;
        batteryVoltage: number;
    } = arg;
    if (!isActive || !trackerName || !batteryVoltage) return;
    const batteryText: HTMLElement = document.getElementById(trackerName).querySelector("#battery");
    if (!batteryText) return;
    batteryText.textContent = `${batteryRemaining}% (${batteryVoltage}V)`;
    window.log(`Battery for ${trackerName}: ${batteryRemaining}% (${batteryVoltage}V)`);
});

window.ipc.on("device-mag", (_event, arg) => {
    const { trackerName, magStatus }: { trackerName: string; magStatus: string } = arg;
    if (!isActive || !trackerName) return;

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

    for (let status in statuses) {
        magStatusElement.classList.remove(statuses[status]);
    }

    magStatusElement.classList.add(statuses[magStatus]);
});

// Add event listeners for the document
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

        unsavedSettings(true);
        window.ipc.send("set-wireless-tracker", wirelessTrackerEnabled);
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

        unsavedSettings(true);
        window.ipc.send("set-wired-tracker", wiredTrackerEnabled);
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
    });

    document.getElementById("gx-switch").addEventListener("change", function () {
        gxEnabled = !gxEnabled;
        window.log(`Switched GX to: ${gxEnabled}`);
        window.ipc.send("save-setting", {
            global: {
                connectionMode: {
                    gxEnabled: gxEnabled,
                },
            },
        });
    });

    document.getElementById("com-ports").addEventListener("change", () => {
        const comPorts: HTMLInputElement[] = Array.from(
            document.getElementById("com-ports").querySelectorAll("input")
        );
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

    document
        .getElementById("tracker-visualization-fps")
        .addEventListener("change", async function () {
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
        const language: string = (document.getElementById("language-select") as HTMLSelectElement)
            .value;
        window.log(`Changed selected language: ${language}`);
        window.changeLanguage(language);
        window.ipc.send("save-setting", {
            global: {
                language: language,
            },
        });
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
        sensorMode = parseInt(
            (document.getElementById("sensor-mode-select") as HTMLSelectElement).value
        );
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
        window.ipc.send("set-logging", canLogToFile);
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

        const comPorts: HTMLInputElement[] = Array.from(
            document.getElementById("com-ports").querySelectorAll("input")
        );

        if (bypassCOMPortLimit) {
            comPorts.forEach((port) => {
                if (bluetoothEnabled && !gxEnabled) {
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

    document
        .getElementById("debug-tracker-connections-switch")
        .addEventListener("change", function () {
            debugTrackerConnections = !debugTrackerConnections;
            window.log(`Switched debug tracker connections: ${debugTrackerConnections}`);
            window.ipc.send("set-debug-tracker-connections", debugTrackerConnections);
            window.ipc.send("save-setting", {
                global: {
                    debug: {
                        debugTrackerConnections: debugTrackerConnections,
                    },
                },
            });
        });
}

window.startConnection = startConnection;
window.stopConnection = stopConnection;
window.openLogsFolder = openLogsFolder;
window.saveSettings = saveSettings;
window.openTrackerSettings = async (deviceID: string) => {
    window.log(`Opening tracker settings for ${deviceID}`);
    window.ipc.send("open-tracker-settings", deviceID);
};
