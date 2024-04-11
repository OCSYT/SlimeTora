let isActive = false;

let bluetoothEnabled = false;
let gxEnabled = false;
const selectedComPorts: string[] = [];

var fpsMode = 50;
var sensorMode = 2;
var accelerometerEnabled = false;
var gyroscopeEnabled = false;
var magnetometerEnabled = false;

let canLogToFile = false;
let skipSlimeVRCheck = false;

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

    // Get settings from config file
    const settings: { [key: string]: any } = await window.ipc.invoke(
        "get-settings",
        null
    );
    bluetoothEnabled =
        settings.global?.connectionMode?.bluetoothEnabled || false;
    gxEnabled = settings.global?.connectionMode?.gxEnabled || false;
    fpsMode = settings.global?.trackers?.fpsRode || 50;
    sensorMode = settings.global?.trackers?.sensorMode || 2;
    accelerometerEnabled =
        settings.global?.trackers?.accelerometerEnabled || false;
    gyroscopeEnabled = settings.global?.trackers?.gyroscopeEnabled || false;
    magnetometerEnabled =
        settings.global?.trackers?.magnetometerEnabled || false;
    canLogToFile = settings.global?.debug?.canLogToFile || false;
    skipSlimeVRCheck = settings.global?.debug?.skipSlimeVRCheck || false;

    // Get the checkbox elements
    const bluetoothSwitch = document.getElementById(
        "bluetooth-switch"
    ) as HTMLInputElement;
    const gxSwitch = document.getElementById("gx-switch") as HTMLInputElement;
    const accelerometerSwitch = document.getElementById(
        "accelerometer-switch"
    ) as HTMLInputElement;
    const gyroscopeSwitch = document.getElementById(
        "gyroscope-switch"
    ) as HTMLInputElement;
    const magnetometerSwitch = document.getElementById(
        "magnetometer-switch"
    ) as HTMLInputElement;
    const logToFileSwitch = document.getElementById(
        "log-to-file-switch"
    ) as HTMLInputElement;
    const skipSlimeVRSwitch = document.getElementById(
        "skip-slimevr-switch"
    ) as HTMLInputElement;

    // Set the checked property based on the settings
    bluetoothSwitch.checked = bluetoothEnabled;
    gxSwitch.checked = gxEnabled;
    accelerometerSwitch.checked = accelerometerEnabled;
    gyroscopeSwitch.checked = gyroscopeEnabled;
    magnetometerSwitch.checked = magnetometerEnabled;
    logToFileSwitch.checked = canLogToFile;
    skipSlimeVRSwitch.checked = skipSlimeVRCheck;

    // Get the select elements
    const fpsSelect = document.getElementById(
        "fps-mode-select"
    ) as HTMLSelectElement;
    const sensorModeSelect = document.getElementById(
        "sensor-mode-select"
    ) as HTMLSelectElement;

    // Set the selected option based on the settings
    fpsSelect.value = fpsMode.toString();
    sensorModeSelect.value = sensorMode.toString();

    // Set the selected COM ports
    const comPortsSwitches = Array.from(
        document.getElementById("com-ports").querySelectorAll("input")
    );
    const selectedPorts: string[] =
        settings.global?.connectionMode?.comPorts || [];

    comPortsSwitches.forEach((port) => {
        if (selectedPorts.includes(port.id)) {
            port.checked = true;
        }
    });

    selectedComPorts.push(...selectedPorts);

    window.log(`Settings loaded:\r\n${JSON.stringify(settings, null, 4)}`);

    addEventListeners();
});

async function startConnection() {
    window.log("Starting connection...");

    const slimeVRFound: boolean = await window.ipc.invoke(
        "is-slimevr-connected",
        null
    );
    if (!slimeVRFound && !skipSlimeVRCheck) {
        window.error("Tried to start connection while not connected to SlimeVR");
        setStatus("SlimeVR not found");
        return;
    } else if (!slimeVRFound && skipSlimeVRCheck) {
        window.log("SlimeVR check skipped");
    }

    if (bluetoothEnabled && gxEnabled) {
        window.ipc.send("start-connection", { type: "bluetooth" });
        window.ipc.send("start-connection", {
            type: "gx",
            ports: selectedComPorts,
        });
        window.log(
            `Starting bluetooth and gx connection with ports: ${selectedComPorts}`
        );
    } else if (bluetoothEnabled) {
        window.ipc.send("start-connection", { type: "bluetooth" });
        window.log("Starting bluetooth connection");
    } else if (gxEnabled) {
        window.ipc.send("start-connection", {
            type: "gx",
            ports: selectedComPorts,
        });
        window.log(`Starting gx connection with ports: ${selectedComPorts}`);
    } else {
        window.error("No connection mode enabled");
        setStatus("No connection mode enabled");
        return;
    }

    isActive = true;
}

function stopConnection() {
    window.log("Stopping connection(s)...");
    isActive = false;

    if (bluetoothEnabled) window.ipc.send("stop-connection", "bluetooth");
    if (gxEnabled) window.ipc.send("stop-connection", "gx");
    document.getElementById("tracker-count").innerHTML = "0";
    document.getElementById("status").innerHTML = "N/A";
    const deviceList = document.getElementById("device-list");
    deviceList.innerHTML = "";
}

function openLogsFolder() {
    window.log("Opening logs folder...");
    window.ipc.send("open-logs-folder", null);
}

/*
 * Renderer helper functions
 */

function setStatus(status: string) {
    document.getElementById("status").innerHTML = status;
    window.log(`Set status to: ${status}`);
}

async function addDeviceToList(deviceID: string) {
    window.log(`Adding device to device list: ${deviceID}`);

    const settings: { [key: string]: any } = await window.ipc.invoke(
        "get-settings",
        null
    );
    const deviceList = document.getElementById("device-list");

    // Create a new div element
    const newDevice = document.createElement("div");
    newDevice.id = deviceID;
    newDevice.className = "column";

    // Check if device has a user-specified name
    const deviceName: string = settings.trackers?.[deviceID]?.name || deviceID;
    if (deviceName !== deviceID)
        window.log(`Got user-specified name for ${deviceID}: ${deviceName}`);

    // Fill the div with device data
    newDevice.innerHTML = `
    <div class="card">
        <header class="card-header">
            <p class="card-header-title is-centered">
                Device Name:&nbsp;<span id="device-name">${deviceName}</span>
            </p>
            <div class="edit-button-container">
                <button id="edit-button" class="button is-info">Edit</button>
            </div>
        </header>
        <div class="card-content">
            <div class="content">
                <p>Device ID: <span id="device-id">${deviceID}</span></p>
                <p>Rotation Data: <span id="rotation-data">0, 0, 0</span></p>
                <p>Acceleration Data: <span id="acceleration-data">0, 0, 0</span></p>
                <p>Battery: <span id="battery">N/A</span></p>
            </div>
        </div>
        <footer class="card-footer">
            <div class="card-footer-item">
                <button id="tracker-settings-button" onclick="openTrackerSettings('${deviceID}')" class="button is-info">Override tracker settings</button>
            </div>
        </footer>
    </div>
    `;

    const deviceNameElement = newDevice.querySelector("#device-name");
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

    editButton.addEventListener("click", startEditing);
    deviceNameElement.addEventListener("click", startEditing);

    deviceList.appendChild(newDevice);

    // Trigger battery event
    window.ipc.send("get-battery", deviceID);
}

/*
 * Event listeners
 */

window.ipc.on("connect", async (_event, deviceID) => {
    window.log(`Connected to ${deviceID}`);
    addDeviceToList(deviceID);
    document.getElementById("tracker-count").innerHTML = (
        parseInt(document.getElementById("tracker-count").innerHTML) + 1
    ).toString();

    setStatus("connected");

    if (deviceID.startsWith("HaritoraX")) return;

    // set sensorAutoCorrection settings
    const trackerSettings: {
        sensorMode: number;
        fpsMode: number;
        sensorAutoCorrection: string[];
    } = await window.ipc.invoke("get-tracker-settings", deviceID);
    const sensorMode: number = trackerSettings.sensorMode || 1;
    const fpsMode: number = trackerSettings.fpsMode || 50;
    let sensorAutoCorrection: string[] =
        trackerSettings.sensorAutoCorrection || [];

    if (accelerometerEnabled) sensorAutoCorrection.push("accel");
    if (gyroscopeEnabled) sensorAutoCorrection.push("gyro");
    if (magnetometerEnabled) sensorAutoCorrection.push("mag");

    window.log(
        `Set sensor auto correction for ${deviceID} to: ${sensorAutoCorrection}`
    );

    window.ipc.send("set-tracker-settings", {
        deviceID,
        sensorMode,
        fpsMode,
        sensorAutoCorrection,
    });
});

window.ipc.on("disconnect", (_event, deviceID) => {
    window.log(`Disconnected from ${deviceID}`);
    document.getElementById(deviceID).remove();
    document.getElementById("tracker-count").innerHTML = (
        parseInt(document.getElementById("tracker-count").innerHTML) - 1
    ).toString();

    if (document.getElementById("tracker-count").innerHTML === "0")
        setStatus("disconnected");
});

let lastUpdate = Date.now();

window.ipc.on("device-data", (_event: any, arg) => {
    const {
        trackerName,
        rotation,
        gravity,
    }: { trackerName: string; rotation: Rotation; gravity: Gravity } = arg;

    if (
        !isActive ||
        !document.getElementById("device-list").querySelector(`#${trackerName}`)
    )
        return;
    const now = Date.now();

    // Limit updates to every 50ms
    if (now - lastUpdate < 50) {
        return;
    }

    lastUpdate = now;

    const rotationText = `${rotation.x.toFixed(0)}, ${rotation.y.toFixed(
        0
    )}, ${rotation.z.toFixed(0)}`;
    const gravityText = `${gravity.x.toFixed(0)}, ${gravity.y.toFixed(
        0
    )}, ${gravity.z.toFixed(0)}`;

    document
        .getElementById(trackerName)
        .querySelector("#rotation-data").innerHTML = rotationText;
    document
        .getElementById(trackerName)
        .querySelector("#acceleration-data").innerHTML = gravityText;
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
    if (!isActive || !trackerName) return;
    const batteryText: HTMLElement = document
        .getElementById(trackerName)
        .querySelector("#battery");
    if (batteryText === null) return;
    batteryText.innerHTML = `${batteryRemaining}% (${batteryVoltage / 1000}V)`;
    window.log(
        `Battery for ${trackerName}: ${batteryRemaining}% (${
            batteryVoltage / 1000
        }V)`
    );
});

window.ipc.on("error-message", (_event, msg) => {
    setStatus(msg);
});

// Set version number
window.ipc.on("version", (_event, version) => {
    document.getElementById("version").innerHTML = version;
    window.log(`Got app version: ${version}`);
});

function addEventListeners() {
    /*
     * Settings event listeners
     */

    document
        .getElementById("bluetooth-switch")
        .addEventListener("change", function () {
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

    document
        .getElementById("gx-switch")
        .addEventListener("change", function () {
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

    document
        .getElementById("accelerometer-switch")
        .addEventListener("change", async function () {
            accelerometerEnabled = !accelerometerEnabled;
            window.log(`Switched accelerometer to: ${accelerometerEnabled}`);
            window.ipc.send("save-setting", {
                global: {
                    trackers: {
                        accelerometerEnabled: accelerometerEnabled,
                    },
                },
            });

            const activeTrackers: string[] = await window.ipc.invoke(
                "get-active-trackers",
                null
            );
            window.log(`Active trackers: ${activeTrackers}`);

            activeTrackers.forEach(async (deviceID: string) => {
                if (deviceID.startsWith("HaritoraX")) return;
                const trackerSettings: TrackerSettings =
                    await window.ipc.invoke("get-tracker-settings", deviceID);
                const sensorMode: number = trackerSettings.sensorMode;
                const fpsMode: number = trackerSettings.fpsMode || 100;
                let sensorAutoCorrection: string[] =
                    trackerSettings.sensorAutoCorrection || [];

                if (accelerometerEnabled) {
                    sensorAutoCorrection.push("accel");
                } else {
                    sensorAutoCorrection = sensorAutoCorrection.filter(
                        (sensor: string) => sensor !== "accel"
                    );
                }

                window.log(
                    `Set sensor auto correction for ${deviceID} to: ${sensorAutoCorrection}`
                );

                window.ipc.send("set-tracker-settings", {
                    deviceID,
                    sensorMode,
                    fpsMode,
                    sensorAutoCorrection,
                });
            });
        });

    document
        .getElementById("gyroscope-switch")
        .addEventListener("change", async function () {
            gyroscopeEnabled = !gyroscopeEnabled;
            window.log(`Gyroscope enabled: ${gyroscopeEnabled}`);
            window.ipc.send("save-setting", {
                global: {
                    trackers: {
                        gyroscopeEnabled: gyroscopeEnabled,
                    },
                },
            });

            const activeTrackers: string[] = await window.ipc.invoke(
                "get-active-trackers",
                null
            );
            window.log(`Active trackers: ${activeTrackers}`);

            activeTrackers.forEach(async (deviceID: string) => {
                if (deviceID.startsWith("HaritoraX")) return;
                const trackerSettings: TrackerSettings =
                    await window.ipc.invoke("get-tracker-settings", deviceID);
                const sensorMode: number = trackerSettings.sensorMode;
                const fpsMode: number = trackerSettings.fpsMode || 50;
                let sensorAutoCorrection: string[] =
                    trackerSettings.sensorAutoCorrection || [];

                if (gyroscopeEnabled) {
                    sensorAutoCorrection.push("gyro");
                } else {
                    sensorAutoCorrection = sensorAutoCorrection.filter(
                        (sensor: string) => sensor !== "gyro"
                    );
                }

                window.log(
                    `Set sensor auto correction for ${deviceID} to: ${sensorAutoCorrection}`
                );

                window.ipc.send("set-tracker-settings", {
                    deviceID,
                    sensorMode,
                    fpsMode,
                    sensorAutoCorrection,
                });
            });
        });

    document
        .getElementById("magnetometer-switch")
        .addEventListener("change", async function () {
            magnetometerEnabled = !magnetometerEnabled;
            window.log(`Magnetometer enabled: ${magnetometerEnabled}`);
            window.ipc.send("save-setting", {
                global: {
                    trackers: {
                        magnetometerEnabled: magnetometerEnabled,
                    },
                },
            });

            const activeTrackers: string[] = await window.ipc.invoke(
                "get-active-trackers",
                null
            );
            window.log(`Active trackers: ${activeTrackers}`);

            activeTrackers.forEach(async (deviceID: string) => {
                if (deviceID.startsWith("HaritoraX")) return;
                const trackerSettings: TrackerSettings =
                    await window.ipc.invoke("get-tracker-settings", deviceID);
                const sensorMode: number = trackerSettings.sensorMode;
                const fpsMode: number = trackerSettings.fpsMode || 100;
                let sensorAutoCorrection: string[] =
                    trackerSettings.sensorAutoCorrection || [];

                if (magnetometerEnabled) {
                    sensorAutoCorrection.push("mag");
                } else {
                    sensorAutoCorrection = sensorAutoCorrection.filter(
                        (sensor: string) => sensor !== "mag"
                    );
                }

                window.log(
                    `Set sensor auto correction for ${deviceID} to: ${sensorAutoCorrection}`
                );

                window.ipc.send("set-tracker-settings", {
                    deviceID,
                    sensorMode,
                    fpsMode,
                    sensorAutoCorrection,
                });
            });
        });

    document.getElementById("com-ports").addEventListener("change", () => {
        const comPorts: HTMLInputElement[] = Array.from(
            document.getElementById("com-ports").querySelectorAll("input")
        );
        const selectedPorts: string[] = [];

        comPorts.forEach((port) => {
            if (port.checked) {
                selectedPorts.push(port.id);
                if (!selectedComPorts.includes(port.id))
                    selectedComPorts.push(port.id);
            } else {
                selectedComPorts.splice(selectedComPorts.indexOf(port.id), 1);
            }
        });

        window.log(`Selected COM ports: ${selectedPorts}`);
        window.ipc.send("save-setting", {
            global: {
                connectionMode: {
                    comPorts: selectedPorts,
                },
            },
        });

        // If four ports are selected, disable the rest
        if (selectedPorts.length >= 4) {
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

    document
        .getElementById("log-to-file-switch")
        .addEventListener("change", function () {
            canLogToFile = !canLogToFile;
            window.log(`Log to file: ${canLogToFile}`);
            window.ipc.send("set-logging", canLogToFile);
            window.ipc.send("save-setting", {
                global: {
                    debug: {
                        canLogToFile: canLogToFile,
                    },
                },
            });
        });

    document
        .getElementById("skip-slimevr-switch")
        .addEventListener("change", function () {
            skipSlimeVRCheck = !skipSlimeVRCheck;
            window.log(`Skip SlimeVR check: ${skipSlimeVRCheck}`);
            window.ipc.send("save-setting", {
                global: {
                    debug: {
                        skipSlimeVRCheck: skipSlimeVRCheck,
                    },
                },
            });
        });

    document
        .getElementById("fps-mode-select")
        .addEventListener("change", async function () {
            fpsMode = parseInt(
                (
                    document.getElementById(
                        "fps-mode-select"
                    ) as HTMLSelectElement
                ).value
            );
            window.log(`FPS mode: ${fpsMode}`);
            window.ipc.send("save-setting", {
                global: {
                    trackers: {
                        fpsMode: fpsMode,
                    },
                },
            });

            const activeTrackers: string[] = await window.ipc.invoke(
                "get-active-trackers",
                null
            );

            activeTrackers.forEach(async (deviceID: string) => {
                if (deviceID.startsWith("HaritoraX")) return;
                const trackerSettings: TrackerSettings =
                    await window.ipc.invoke("get-tracker-settings", deviceID);
                const sensorMode: number = trackerSettings.sensorMode;
                let sensorAutoCorrection: string[] =
                    trackerSettings.sensorAutoCorrection || [];

                window.log(
                    `Set FPS mode for ${deviceID} to: ${fpsMode}`
                );

                window.ipc.send("set-tracker-settings", {
                    deviceID,
                    sensorMode,
                    fpsMode,
                    sensorAutoCorrection,
                });
            });
        });

    document
        .getElementById("sensor-mode-select")
        .addEventListener("change", async function () {
            sensorMode = parseInt(
                (
                    document.getElementById(
                        "sensor-mode-select"
                    ) as HTMLSelectElement
                ).value
            );
            window.log(`Sensor mode: ${sensorMode}`);
            window.ipc.send("save-setting", {
                global: {
                    trackers: {
                        sensorMode: sensorMode,
                    },
                },
            });

            const activeTrackers: string[] = await window.ipc.invoke(
                "get-active-trackers",
                null
            );

            activeTrackers.forEach(async (deviceID: string) => {
                if (deviceID.startsWith("HaritoraX")) return;
                const trackerSettings: TrackerSettings =
                    await window.ipc.invoke("get-tracker-settings", deviceID);
                const fpsMode: number = trackerSettings.fpsMode || 50;
                let sensorAutoCorrection: string[] =
                    trackerSettings.sensorAutoCorrection || [];

                window.log(
                    `Set sensor mode for ${deviceID} to: ${sensorMode}`
                );

                window.ipc.send("set-tracker-settings", {
                    deviceID,
                    sensorMode,
                    fpsMode,
                    sensorAutoCorrection,
                });
            });
        });
}

window.startConnection = startConnection;
window.stopConnection = stopConnection;
window.openLogsFolder = openLogsFolder;
window.openTrackerSettings = async (deviceID: string) => {
    window.log(`Opening tracker settings for ${deviceID}`);
    window.ipc.send("open-tracker-settings", deviceID);
};

/*
 * TypeScript declarations
 */