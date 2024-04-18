let deviceID = "";

let settingsFPSMode = 50;
let settingsSensorMode = 2;
let settingsAccelerometerEnabled = false;
let settingsGyroscopeEnabled = false;
let settingsMagnetometerEnabled = false;

document.addEventListener("DOMContentLoaded", async () => {
    // get all elements with data-i18n and get the attribute value. after, replace the textContent with the translation
    const i18nElements = document.querySelectorAll("[data-i18n]");
    i18nElements.forEach(async (element) => {
        const key = element.getAttribute("data-i18n");
        element.textContent = await window.translate(key);
    });
});

// Set tracker name and variable
window.ipc.on("trackerName", (_event, arg) => {
    window.log(`Opened per-tracker settings for: ${arg}`);
    deviceID = arg;

    const trackerNameElement = document.getElementById("tracker-name");

    if (deviceID.startsWith("HaritoraX")) {
        // Check if censor serial numbers is enabled
        const settings = window.ipc.invoke("get-settings", null);
        settings.then((settings) => {
            if (settings.global?.censorSerialNumbers) {
                if (deviceID.startsWith("HaritoraX")) {
                    trackerNameElement.textContent =
                        trackerNameElement.textContent.replace(
                            "{trackerName}",
                            "HaritoraX-XXXXXX"
                        );
                } else if (deviceID.startsWith("HaritoraXW")) {
                    trackerNameElement.textContent =
                        trackerNameElement.textContent.replace(
                            "{trackerName}",
                            "HaritoraXW-XXXXXX"
                        );
                }
            } else {
                trackerNameElement.textContent =
                    trackerNameElement.textContent.replace(
                        "{trackerName}",
                        deviceID
                    );
            }
        });
    } else {
        trackerNameElement.textContent = trackerNameElement.textContent.replace(
            "{trackerName}",
            deviceID
        );
    }

    // Load settings
    loadSettings(deviceID);
});

async function loadSettings(deviceID: string) {
    // Get settings from config file
    const trackerSettings: TrackerSettings = await window.ipc.invoke(
        "get-tracker-settings",
        { trackerName: deviceID }
    );

    settingsFPSMode =
        trackerSettings.fpsMode && trackerSettings.fpsMode !== -1
            ? await getSetting(
                  `trackers.${deviceID}.fpsMode`,
                  trackerSettings.fpsMode || 50
              )
            : settingsFPSMode;
    settingsSensorMode =
        trackerSettings.sensorMode && trackerSettings.sensorMode !== -1
            ? await getSetting(
                  `trackers.${deviceID}.sensorMode`,
                  trackerSettings.sensorMode || 2
              )
            : settingsSensorMode;
    settingsAccelerometerEnabled = await getSetting(
        `trackers.${deviceID}.accelerometerEnabled`,
        trackerSettings.sensorAutoCorrection?.includes("accel") || false
    );
    settingsGyroscopeEnabled = await getSetting(
        `trackers.${deviceID}.gyroscopeEnabled`,
        trackerSettings.sensorAutoCorrection?.includes("gyro") || false
    );
    settingsMagnetometerEnabled = await getSetting(
        `trackers.${deviceID}.magnetometerEnabled`,
        trackerSettings.sensorAutoCorrection?.includes("mag") || false
    );

    // Get the checkbox elements
    const accelerometerSwitch = document.getElementById(
        "accelerometer-switch"
    ) as HTMLInputElement;
    const gyroscopeSwitch = document.getElementById(
        "gyroscope-switch"
    ) as HTMLInputElement;
    const magnetometerSwitch = document.getElementById(
        "magnetometer-switch"
    ) as HTMLInputElement;

    // Set the checked property based on the settings
    accelerometerSwitch.checked = settingsAccelerometerEnabled;
    gyroscopeSwitch.checked = settingsGyroscopeEnabled;
    magnetometerSwitch.checked = settingsMagnetometerEnabled;

    // Get the select elements
    const fpsSelect = document.getElementById(
        "fps-mode-select"
    ) as HTMLSelectElement;
    const sensorModeSelect = document.getElementById(
        "sensor-mode-select"
    ) as HTMLSelectElement;

    // Set the selected option based on the settings
    fpsSelect.value = settingsFPSMode.toString();
    sensorModeSelect.value = settingsSensorMode.toString();
    console.log(
        `Setting sensor mode to: ${settingsSensorMode} for ${sensorModeSelect}`
    );
    console.log(`Setting fps mode to: ${settingsFPSMode} for ${fpsSelect}`);

    document
        .getElementById("accelerometer-switch")
        .addEventListener("change", async function () {
            settingsAccelerometerEnabled = !settingsAccelerometerEnabled;
            window.log(
                `Switched accelerometer to: ${settingsAccelerometerEnabled}`
            );
            window.ipc.send("save-setting", {
                trackers: {
                    [deviceID]: {
                        sensorMode: settingsSensorMode,
                        fpsMode: settingsFPSMode,
                        accelerometerEnabled: settingsAccelerometerEnabled,
                        gyroscopeEnabled: settingsGyroscopeEnabled,
                        magnetometerEnabled: settingsMagnetometerEnabled,
                    },
                },
            });

            settingsUnsavedSettings(true);
        });

    document
        .getElementById("gyroscope-switch")
        .addEventListener("change", async function () {
            settingsGyroscopeEnabled = !settingsGyroscopeEnabled;
            window.log(
                `Switched gyroscope enabled: ${settingsGyroscopeEnabled}`
            );
            window.ipc.send("save-setting", {
                trackers: {
                    [deviceID]: {
                        sensorMode: settingsSensorMode,
                        fpsMode: settingsFPSMode,
                        accelerometerEnabled: settingsAccelerometerEnabled,
                        gyroscopeEnabled: settingsGyroscopeEnabled,
                        magnetometerEnabled: settingsMagnetometerEnabled,
                    },
                },
            });

            settingsUnsavedSettings(true);
        });

    document
        .getElementById("magnetometer-switch")
        .addEventListener("change", async function () {
            settingsMagnetometerEnabled = !settingsMagnetometerEnabled;
            window.log(
                `Switched magnetometer enabled: ${settingsMagnetometerEnabled}`
            );
            window.ipc.send("save-setting", {
                trackers: {
                    [deviceID]: {
                        sensorMode: settingsSensorMode,
                        fpsMode: settingsFPSMode,
                        accelerometerEnabled: settingsAccelerometerEnabled,
                        gyroscopeEnabled: settingsGyroscopeEnabled,
                        magnetometerEnabled: settingsMagnetometerEnabled,
                    },
                },
            });

            settingsUnsavedSettings(true);
        });

    document
        .getElementById("fps-mode-select")
        .addEventListener("change", async function () {
            settingsFPSMode = parseInt(
                (
                    document.getElementById(
                        "fps-mode-select"
                    ) as HTMLSelectElement
                ).value
            );
            window.log(`Changed FPS mode: ${settingsFPSMode}`);
            window.ipc.send("save-setting", {
                trackers: {
                    [deviceID]: {
                        sensorMode: settingsSensorMode,
                        fpsMode: settingsFPSMode,
                        accelerometerEnabled: settingsAccelerometerEnabled,
                        gyroscopeEnabled: settingsGyroscopeEnabled,
                        magnetometerEnabled: settingsMagnetometerEnabled,
                    },
                },
            });

            settingsUnsavedSettings(true);
        });

    document
        .getElementById("sensor-mode-select")
        .addEventListener("change", async function () {
            settingsSensorMode = parseInt(
                (
                    document.getElementById(
                        "sensor-mode-select"
                    ) as HTMLSelectElement
                ).value
            );
            window.log(`Changed sensor mode: ${settingsSensorMode}`);
            window.ipc.send("save-setting", {
                trackers: {
                    [deviceID]: {
                        sensorMode: settingsSensorMode,
                        fpsMode: settingsFPSMode,
                        accelerometerEnabled: settingsAccelerometerEnabled,
                        gyroscopeEnabled: settingsGyroscopeEnabled,
                        magnetometerEnabled: settingsMagnetometerEnabled,
                    },
                },
            });

            settingsUnsavedSettings(true);
        });
}

async function saveTrackerSettings() {
    settingsUnsavedSettings(false);
    window.ipc.send("save-setting", {
        trackers: {
            [deviceID]: {
                sensorMode: settingsSensorMode,
                fpsMode: settingsFPSMode,
                accelerometerEnabled: settingsAccelerometerEnabled,
                gyroscopeEnabled: settingsGyroscopeEnabled,
                magnetometerEnabled: settingsMagnetometerEnabled,
            },
        },
    });

    let sensorAutoCorrection: string[] = [];
    if (settingsAccelerometerEnabled) sensorAutoCorrection.push("accel");
    if (settingsGyroscopeEnabled) sensorAutoCorrection.push("gyro");
    if (settingsMagnetometerEnabled) sensorAutoCorrection.push("mag");

    window.ipc.send("set-tracker-settings", {
        deviceID,
        sensorMode: settingsSensorMode,
        fpsMode: settingsFPSMode,
        sensorAutoCorrection: sensorAutoCorrection,
    });

    window.log(`Saved settings for ${deviceID}`);
}

async function resetSettings() {
    const accelerometerSwitch = document.getElementById(
        "accelerometer-switch"
    ) as HTMLInputElement;
    const gyroscopeSwitch = document.getElementById(
        "gyroscope-switch"
    ) as HTMLInputElement;
    const magnetometerSwitch = document.getElementById(
        "magnetometer-switch"
    ) as HTMLInputElement;
    const fpsSelect = document.getElementById(
        "fps-mode-select"
    ) as HTMLSelectElement;
    const sensorModeSelect = document.getElementById(
        "sensor-mode-select"
    ) as HTMLSelectElement;

    // Grab the global settings from config file and set the values
    const settings: { [key: string]: any } = await window.ipc.invoke(
        "get-settings",
        null
    );

    console.log(`Old settings: ${JSON.stringify(settings)}`);

    settingsFPSMode = settings.global?.trackers?.fpsMode || 50;
    settingsSensorMode = settings.global?.trackers?.sensorMode || 2;
    settingsAccelerometerEnabled =
        settings.global?.trackers?.accelerometerEnabled || false;
    settingsGyroscopeEnabled =
        settings.global?.trackers?.gyroscopeEnabled || false;
    settingsMagnetometerEnabled =
        settings.global?.trackers?.magnetometerEnabled || false;

    accelerometerSwitch.checked = settingsAccelerometerEnabled;
    gyroscopeSwitch.checked = settingsGyroscopeEnabled;
    magnetometerSwitch.checked = settingsMagnetometerEnabled;
    fpsSelect.value = settingsFPSMode.toString();
    sensorModeSelect.value = settingsSensorMode.toString();

    console.log(`New settings: ${JSON.stringify(settings)}`);

    let sensorAutoCorrection: string[] = [];
    if (settingsAccelerometerEnabled) sensorAutoCorrection.push("accel");
    if (settingsGyroscopeEnabled) sensorAutoCorrection.push("gyro");
    if (settingsMagnetometerEnabled) sensorAutoCorrection.push("mag");

    window.ipc.send("save-tracker-settings", {
        deviceID,
        sensorMode,
        fpsMode,
        sensorAutoCorrection: sensorAutoCorrection,
    });

    window.log(`Reset settings for ${deviceID} to default`);
}

async function getSettings() {
    const currentSettings = await window.ipc.invoke("get-tracker-settings", {
        trackerName: deviceID,
    });
    const sensorMode = currentSettings.sensorMode;
    const fpsMode = currentSettings.fpsMode;
    const sensorAutoCorrection = currentSettings.sensorAutoCorrection;

    window.log(
        `Current settings for ${deviceID}: ${JSON.stringify(currentSettings)}`
    );
    window.ipc.send("show-message", {
        title: `Current settings for ${deviceID}`,
        message: `Sensor Mode: ${sensorMode} \nFPS Mode: ${fpsMode} \nSensor Auto Correction: ${sensorAutoCorrection.join(
            ", "
        )}`,
    });
}

// Set settings button indicator
function settingsUnsavedSettings(unsaved: boolean) {
    const saveButton = document.getElementById("save-settings-button");
    if (unsaved && !saveButton.textContent.includes("(!)")) {
        saveButton.textContent += " (!)";
        saveButton.classList.add("is-danger");
        saveButton.classList.remove("is-info");
    } else if (!unsaved && saveButton.textContent.includes("(!)")) {
        saveButton.textContent = saveButton.textContent.replace(" (!)", "");
        saveButton.classList.add("is-info");
        saveButton.classList.remove("is-danger");
    }
}

async function getSetting(key: string, defaultValue: any) {
    const exists = await window.ipc.invoke("has-setting", key);
    window.log(`Setting ${key} exists: ${exists}`);
    return exists ? await window.ipc.invoke("get-setting", key) : defaultValue;
}
