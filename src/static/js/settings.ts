let deviceID = "";

let settingsFPSMode = 50;
let settingsSensorMode = 2;
let settingsAccelerometerEnabled = false;
let settingsGyroscopeEnabled = false;
let settingsMagnetometerEnabled = false;

// Set tracker name and variable
window.ipc.on("trackerName", (_event, arg) => {
    window.localize();
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
        deviceID
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

            const trackerSettings: TrackerSettings = await window.ipc.invoke(
                "get-tracker-settings",
                deviceID
            );

            let sensorAutoCorrection: string[] =
                trackerSettings.sensorAutoCorrection || [];

            if (settingsAccelerometerEnabled) {
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
                sensorMode: settingsSensorMode,
                fpsMode: settingsFPSMode,
                sensorAutoCorrection,
            });
        });

    document
        .getElementById("gyroscope-switch")
        .addEventListener("change", async function () {
            settingsGyroscopeEnabled = !settingsGyroscopeEnabled;
            window.log(`Gyroscope enabled: ${settingsGyroscopeEnabled}`);
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

            const trackerSettings: TrackerSettings = await window.ipc.invoke(
                "get-tracker-settings",
                deviceID
            );

            let sensorAutoCorrection: string[] =
                trackerSettings.sensorAutoCorrection || [];

            if (settingsGyroscopeEnabled) {
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
                sensorMode: settingsSensorMode,
                fpsMode: settingsFPSMode,
                sensorAutoCorrection,
            });
        });

    document
        .getElementById("magnetometer-switch")
        .addEventListener("change", async function () {
            settingsMagnetometerEnabled = !settingsMagnetometerEnabled;
            window.log(`Magnetometer enabled: ${settingsMagnetometerEnabled}`);
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

            const trackerSettings: TrackerSettings = await window.ipc.invoke(
                "get-tracker-settings",
                deviceID
            );

            let sensorAutoCorrection: string[] =
                trackerSettings.sensorAutoCorrection || [];

            if (settingsMagnetometerEnabled) {
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
                sensorMode: settingsSensorMode,
                fpsMode: settingsFPSMode,
                sensorAutoCorrection,
            });
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
            window.log(`FPS mode: ${settingsFPSMode}`);
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

            const trackerSettings: TrackerSettings = await window.ipc.invoke(
                "get-tracker-settings",
                deviceID
            );
            const sensorMode: number = settingsSensorMode;
            let sensorAutoCorrection: string[] =
                trackerSettings.sensorAutoCorrection || [];

            window.log(`Set FPS mode for ${deviceID} to: ${settingsFPSMode}`);

            window.ipc.send("set-tracker-settings", {
                deviceID,
                sensorMode: settingsSensorMode,
                fpsMode: settingsFPSMode,
                sensorAutoCorrection,
            });
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
            window.log(`Sensor mode: ${settingsSensorMode}`);
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

            const trackerSettings: TrackerSettings = await window.ipc.invoke(
                "get-tracker-settings",
                deviceID
            );
            const fpsMode: number = settingsFPSMode;
            let sensorAutoCorrection: string[] =
                trackerSettings.sensorAutoCorrection || [];

            window.log(
                `Set sensor mode for ${deviceID} to: ${settingsSensorMode}`
            );

            window.ipc.send("set-tracker-settings", {
                deviceID,
                sensorMode: settingsSensorMode,
                fpsMode: settingsFPSMode,
                sensorAutoCorrection,
            });
        });
}

async function saveTrackerSettings() {
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

    const trackerSettings: TrackerSettings = await window.ipc.invoke(
        "get-tracker-settings",
        deviceID
    );

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

    console.log(`old settings: ${JSON.stringify(settings)}`);

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

    console.log(`new settings: ${JSON.stringify(settings)}`);

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
    const currentSettings = await window.ipc.invoke(
        "get-tracker-settings",
        deviceID
    );
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

async function getSetting(key: string, defaultValue: any) {
    const exists = await window.ipc.invoke("has-setting", key);
    window.log(`Setting ${key} exists: ${exists}`);
    return exists ? await window.ipc.invoke("get-setting", key) : defaultValue;
}
