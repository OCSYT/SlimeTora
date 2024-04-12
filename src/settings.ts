var deviceID = "";

var fpsMode = 50;
var sensorMode = 2;
var accelerometerEnabled = false;
var gyroscopeEnabled = false;
var magnetometerEnabled = false;

// Set tracker name and variable
window.ipc.on("trackerName", (_event, arg) => {
    document.getElementById("tracker-name").innerHTML = arg;
    window.log(`Opened per-tracker settings for: ${arg}`);
    deviceID = arg;

    // Load settings
    loadSettings(deviceID);
});

async function loadSettings(deviceID: string) {
    // Get settings from config file
    const trackerSettings: TrackerSettings = await window.ipc.invoke(
        "get-tracker-settings",
        deviceID
    );

    fpsMode =
        trackerSettings.fpsMode !== -1
            ? await getSetting(
                  `trackers.${deviceID}.fpsMode`,
                  trackerSettings.fpsMode || 50
              )
            : fpsMode;
    sensorMode =
        trackerSettings.sensorMode !== -1
            ? await getSetting(
                  `trackers.${deviceID}.sensorMode`,
                  trackerSettings.sensorMode || 2
              )
            : sensorMode;
    accelerometerEnabled = await getSetting(
        `trackers.${deviceID}.accelerometerEnabled`,
        trackerSettings.sensorAutoCorrection?.includes("accel") || false
    );
    gyroscopeEnabled = await getSetting(
        `trackers.${deviceID}.gyroscopeEnabled`,
        trackerSettings.sensorAutoCorrection?.includes("gyro") || false
    );
    magnetometerEnabled = await getSetting(
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
    accelerometerSwitch.checked = accelerometerEnabled;
    gyroscopeSwitch.checked = gyroscopeEnabled;
    magnetometerSwitch.checked = magnetometerEnabled;

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
    console.log(
        `Setting sensor mode to: ${sensorMode} for ${sensorModeSelect}`
    );
    console.log(`Setting fps mode to: ${fpsMode} for ${fpsSelect}`);

    document
        .getElementById("accelerometer-switch")
        .addEventListener("change", async function () {
            accelerometerEnabled = !accelerometerEnabled;
            window.log(`Switched accelerometer to: ${accelerometerEnabled}`);
            window.ipc.send("save-setting", {
                trackers: {
                    [deviceID]: {
                        accelerometerEnabled: accelerometerEnabled,
                    },
                },
            });

            const trackerSettings: TrackerSettings = await window.ipc.invoke(
                "get-tracker-settings",
                deviceID
            );

            const sensorMode: number = trackerSettings.sensorMode;
            const fpsMode: number = trackerSettings.fpsMode || 50;
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

    document
        .getElementById("gyroscope-switch")
        .addEventListener("change", async function () {
            gyroscopeEnabled = !gyroscopeEnabled;
            window.log(`Gyroscope enabled: ${gyroscopeEnabled}`);
            window.ipc.send("save-setting", {
                trackers: {
                    [deviceID]: {
                        gyroscopeEnabled: gyroscopeEnabled,
                    },
                },
            });

            const trackerSettings: TrackerSettings = await window.ipc.invoke(
                "get-tracker-settings",
                deviceID
            );

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

    document
        .getElementById("magnetometer-switch")
        .addEventListener("change", async function () {
            magnetometerEnabled = !magnetometerEnabled;
            window.log(`Magnetometer enabled: ${magnetometerEnabled}`);
            window.ipc.send("save-setting", {
                trackers: {
                    [deviceID]: {
                        magnetometerEnabled: magnetometerEnabled,
                    },
                },
            });

            const trackerSettings: TrackerSettings = await window.ipc.invoke(
                "get-tracker-settings",
                deviceID
            );

            const sensorMode: number = trackerSettings.sensorMode;
            const fpsMode: number = trackerSettings.fpsMode || 50;
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
                trackers: {
                    [deviceID]: {
                        fpsMode: fpsMode,
                    },
                },
            });

            const trackerSettings: TrackerSettings = await window.ipc.invoke(
                "get-tracker-settings",
                deviceID
            );
            const sensorMode: number = trackerSettings.sensorMode;
            let sensorAutoCorrection: string[] =
                trackerSettings.sensorAutoCorrection || [];

            window.log(`Set FPS mode for ${deviceID} to: ${fpsMode}`);

            window.ipc.send("set-tracker-settings", {
                deviceID,
                sensorMode,
                fpsMode,
                sensorAutoCorrection,
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
                trackers: {
                    [deviceID]: {
                        sensorMode: sensorMode,
                    },
                },
            });

            const trackerSettings: TrackerSettings = await window.ipc.invoke(
                "get-tracker-settings",
                deviceID
            );
            const fpsMode: number = trackerSettings.fpsMode || 50;
            let sensorAutoCorrection: string[] =
                trackerSettings.sensorAutoCorrection || [];

            window.log(`Set sensor mode for ${deviceID} to: ${sensorMode}`);

            window.ipc.send("set-tracker-settings", {
                deviceID,
                sensorMode,
                fpsMode,
                sensorAutoCorrection,
            });
        });
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

    fpsMode = settings.global?.trackers?.fpsMode || 50;
    sensorMode = settings.global?.trackers?.sensorMode || 2;
    accelerometerEnabled =
        settings.global?.trackers?.accelerometerEnabled || false;
    gyroscopeEnabled = settings.global?.trackers?.gyroscopeEnabled || false;
    magnetometerEnabled =
        settings.global?.trackers?.magnetometerEnabled || false;

    accelerometerSwitch.checked = accelerometerEnabled;
    gyroscopeSwitch.checked = gyroscopeEnabled;
    magnetometerSwitch.checked = magnetometerEnabled;
    fpsSelect.value = fpsMode.toString();
    sensorModeSelect.value = sensorMode.toString();

    console.log(`new settings: ${JSON.stringify(settings)}`);

    window.log(`Reset settings for ${deviceID} to default`);
}

async function getSetting(name: string, defaultValue: any) {
    const exists = await window.ipc.invoke("has-setting", name);
    window.log(`Setting ${name} exists: ${exists}`);
    return exists ? await window.ipc.invoke("get-setting", name) : defaultValue;
}
