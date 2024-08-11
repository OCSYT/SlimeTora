let fpsMode = 50;
let sensorMode = 2;
let accelerometerEnabled = false;
let gyroscopeEnabled = false;
let magnetometerEnabled = false;

const params = new URLSearchParams(window.location.search);
const trackerName = params.get("trackerName");

document.addEventListener("DOMContentLoaded", async () => {
    window.log(`Opened per-tracker settings for: ${trackerName}`);

    const i18nElements = document.querySelectorAll("[data-i18n]");
    const translationPromises: Promise<void>[] = [];

    i18nElements.forEach((element) => {
        const key = element.getAttribute("data-i18n");
        const translationPromise = window.translate(key).then((translation) => {
            if (translation && translation !== key) {
                // could be a slight security risk, but makes it so much easier to format text
                element.innerHTML = translation;
            }
        });
        translationPromises.push(translationPromise);
    });

    await Promise.all(translationPromises);

    const trackerNameElement = document.getElementById("tracker-name");
    if (trackerName.startsWith("HaritoraX")) {
        // Check if censor serial numbers is enabled
        const settings = await window.ipc.invoke("get-settings", null);

        if (settings.global?.censorSerialNumbers) {
            if (trackerName.startsWith("HaritoraX")) {
                trackerNameElement.textContent = trackerNameElement.textContent.replace(
                    "{trackerName}",
                    "HaritoraX-XXXXXX"
                );
            } else if (trackerName.startsWith("HaritoraXW")) {
                trackerNameElement.textContent = trackerNameElement.textContent.replace(
                    "{trackerName}",
                    "HaritoraXW-XXXXXX"
                );
            }
        } else {
            trackerNameElement.textContent = trackerNameElement.textContent.replace("{trackerName}", trackerName);
        }
    } else {
        trackerNameElement.textContent = trackerNameElement.textContent.replace("{trackerName}", trackerName);
    }

    // Load settings
    loadConfigSettings(trackerName);
});

async function loadConfigSettings(trackerName: string) {
    // Get settings from config file
    const trackerSettings: TrackerSettings = await window.ipc.invoke("get-tracker-settings", {
        trackerName: trackerName,
    });

    if (trackerSettings) {
        fpsMode =
            trackerSettings.fpsMode && trackerSettings.fpsMode !== -1
                ? await getSetting(`trackers.${trackerName}.fpsMode`, trackerSettings.fpsMode || 50)
                : fpsMode;
        sensorMode =
            trackerSettings.sensorMode && trackerSettings.sensorMode !== -1
                ? await getSetting(`trackers.${trackerName}.sensorMode`, trackerSettings.sensorMode || 2)
                : sensorMode;
        accelerometerEnabled = await getSetting(
            `trackers.${trackerName}.accelerometerEnabled`,
            trackerSettings.sensorAutoCorrection?.includes("accel") || false
        );
        gyroscopeEnabled = await getSetting(
            `trackers.${trackerName}.gyroscopeEnabled`,
            trackerSettings.sensorAutoCorrection?.includes("gyro") || false
        );
        magnetometerEnabled = await getSetting(
            `trackers.${trackerName}.magnetometerEnabled`,
            trackerSettings.sensorAutoCorrection?.includes("mag") || false
        );

        // Get the checkbox elements
        const accelerometerSwitch = document.getElementById("accelerometer-switch") as HTMLInputElement;
        const gyroscopeSwitch = document.getElementById("gyroscope-switch") as HTMLInputElement;
        const magnetometerSwitch = document.getElementById("magnetometer-switch") as HTMLInputElement;

        // Set the checked property based on the settings
        accelerometerSwitch.checked = accelerometerEnabled;
        gyroscopeSwitch.checked = gyroscopeEnabled;
        magnetometerSwitch.checked = magnetometerEnabled;

        // Get the select elements
        const fpsSelect = document.getElementById("fps-mode-select") as HTMLSelectElement;
        const sensorModeSelect = document.getElementById("sensor-mode-select") as HTMLSelectElement;

        // Set the selected option based on the settings
        fpsSelect.value = fpsMode.toString();
        sensorModeSelect.value = sensorMode.toString();
        window.log(`Setting sensor mode to: ${sensorMode}`);
        window.log(`Setting FPS mode to: ${fpsMode}`);
        window.log(`Setting accelerometer to: ${accelerometerEnabled}`);
        window.log(`Setting gyroscope to: ${gyroscopeEnabled}`);
        window.log(`Setting magnetometer to: ${magnetometerEnabled}`);
    } else {
        window.log(`No settings found for ${trackerName}`);
    }

    document.getElementById("accelerometer-switch").addEventListener("change", async function () {
        accelerometerEnabled = !accelerometerEnabled;
        window.log(`Switched accelerometer to: ${accelerometerEnabled}`);
        window.ipc.send("save-setting", {
            trackers: {
                [trackerName]: {
                    sensorMode: sensorMode,
                    fpsMode: fpsMode,
                    accelerometerEnabled: accelerometerEnabled,
                    gyroscopeEnabled: gyroscopeEnabled,
                    magnetometerEnabled: magnetometerEnabled,
                },
            },
        });

        unsavedSettings(true);
    });

    document.getElementById("gyroscope-switch").addEventListener("change", async function () {
        gyroscopeEnabled = !gyroscopeEnabled;
        window.log(`Switched gyroscope enabled: ${gyroscopeEnabled}`);
        window.ipc.send("save-setting", {
            trackers: {
                [trackerName]: {
                    sensorMode: sensorMode,
                    fpsMode: fpsMode,
                    accelerometerEnabled: accelerometerEnabled,
                    gyroscopeEnabled: gyroscopeEnabled,
                    magnetometerEnabled: magnetometerEnabled,
                },
            },
        });

        unsavedSettings(true);
    });

    document.getElementById("magnetometer-switch").addEventListener("change", async function () {
        magnetometerEnabled = !magnetometerEnabled;
        window.log(`Switched magnetometer enabled: ${magnetometerEnabled}`);
        window.ipc.send("save-setting", {
            trackers: {
                [trackerName]: {
                    sensorMode: sensorMode,
                    fpsMode: fpsMode,
                    accelerometerEnabled: accelerometerEnabled,
                    gyroscopeEnabled: gyroscopeEnabled,
                    magnetometerEnabled: magnetometerEnabled,
                },
            },
        });

        unsavedSettings(true);
    });

    document.getElementById("fps-mode-select").addEventListener("change", async function () {
        fpsMode = parseInt((document.getElementById("fps-mode-select") as HTMLSelectElement).value);
        window.log(`Changed FPS mode: ${fpsMode}`);
        window.ipc.send("save-setting", {
            trackers: {
                [trackerName]: {
                    sensorMode: sensorMode,
                    fpsMode: fpsMode,
                    accelerometerEnabled: accelerometerEnabled,
                    gyroscopeEnabled: gyroscopeEnabled,
                    magnetometerEnabled: magnetometerEnabled,
                },
            },
        });

        unsavedSettings(true);
    });

    document.getElementById("sensor-mode-select").addEventListener("change", async function () {
        sensorMode = parseInt((document.getElementById("sensor-mode-select") as HTMLSelectElement).value);
        window.log(`Changed sensor mode: ${sensorMode}`);
        window.ipc.send("save-setting", {
            trackers: {
                [trackerName]: {
                    sensorMode: sensorMode,
                    fpsMode: fpsMode,
                    accelerometerEnabled: accelerometerEnabled,
                    gyroscopeEnabled: gyroscopeEnabled,
                    magnetometerEnabled: magnetometerEnabled,
                },
            },
        });

        unsavedSettings(true);
    });
}

// Exposed to the window object

async function saveTrackerSettings() {
    unsavedSettings(false);
    window.ipc.send("save-setting", {
        trackers: {
            [trackerName]: {
                sensorMode: sensorMode,
                fpsMode: fpsMode,
                accelerometerEnabled: accelerometerEnabled,
                gyroscopeEnabled: gyroscopeEnabled,
                magnetometerEnabled: magnetometerEnabled,
            },
        },
    });

    let sensorAutoCorrection: string[] = [];
    if (accelerometerEnabled) sensorAutoCorrection.push("accel");
    if (gyroscopeEnabled) sensorAutoCorrection.push("gyro");
    if (magnetometerEnabled) sensorAutoCorrection.push("mag");

    window.ipc.send("set-tracker-settings", {
        deviceID: trackerName,
        sensorMode: sensorMode,
        fpsMode: fpsMode,
        sensorAutoCorrection: sensorAutoCorrection,
    });

    window.log(`Saved settings for ${trackerName}`);
}

async function resetTrackerSettings() {
    const accelerometerSwitch = document.getElementById("accelerometer-switch") as HTMLInputElement;
    const gyroscopeSwitch = document.getElementById("gyroscope-switch") as HTMLInputElement;
    const magnetometerSwitch = document.getElementById("magnetometer-switch") as HTMLInputElement;
    const fpsSelect = document.getElementById("fps-mode-select") as HTMLSelectElement;
    const sensorModeSelect = document.getElementById("sensor-mode-select") as HTMLSelectElement;

    // Grab the global settings from config file and set the values
    const settings: { [key: string]: any } = await window.ipc.invoke("get-settings", null);

    window.log(`Old settings: ${JSON.stringify(settings)}`);

    fpsMode = settings.global?.trackers?.fpsMode || 50;
    sensorMode = settings.global?.trackers?.sensorMode || 2;
    accelerometerEnabled = settings.global?.trackers?.accelerometerEnabled || false;
    gyroscopeEnabled = settings.global?.trackers?.gyroscopeEnabled || false;
    magnetometerEnabled = settings.global?.trackers?.magnetometerEnabled || false;

    accelerometerSwitch.checked = accelerometerEnabled;
    gyroscopeSwitch.checked = gyroscopeEnabled;
    magnetometerSwitch.checked = magnetometerEnabled;
    fpsSelect.value = fpsMode.toString();
    sensorModeSelect.value = sensorMode.toString();

    window.log(`New settings: ${JSON.stringify(settings)}`);

    let sensorAutoCorrection: string[] = [];
    if (accelerometerEnabled) sensorAutoCorrection.push("accel");
    if (gyroscopeEnabled) sensorAutoCorrection.push("gyro");
    if (magnetometerEnabled) sensorAutoCorrection.push("mag");

    window.ipc.send("set-tracker-settings", {
        deviceID: trackerName,
        sensorMode: sensorMode,
        fpsMode: fpsMode,
        sensorAutoCorrection: sensorAutoCorrection,
    });

    window.log(`Reset settings for ${trackerName} to default`);
}

async function getTrackerSettings() {
    const currentSettings = await window.ipc.invoke("get-tracker-settings", {
        trackerName: trackerName,
    });
    const sensorMode = currentSettings.sensorMode;
    const fpsMode = currentSettings.fpsMode;
    const sensorAutoCorrection = currentSettings.sensorAutoCorrection;
    const ankleMotionDetection = currentSettings.ankleMotionDetection;

    window.log(`Current settings for ${trackerName}: ${JSON.stringify(currentSettings)}`);
    window.ipc.invoke("show-message", {
        title: `Current settings for ${trackerName}`,
        message: `Sensor Mode: ${sensorMode} \nFPS Mode: ${fpsMode} \nSensor Auto Correction: ${sensorAutoCorrection.join(
            ", "
        )} \nAnkle Motion Detection: ${ankleMotionDetection}`,
        translateTitle: false,
        translateMessage: false,
    });
}

// Set settings button indicator
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

async function getSetting(key: string, defaultValue: any) {
    const exists = await window.ipc.invoke("has-setting", key);
    window.log(`Setting ${key} exists: ${exists}`);
    return exists ? await window.ipc.invoke("get-setting", key) : defaultValue;
}

window.saveTrackerSettings = saveTrackerSettings;
window.getTrackerSettings = getTrackerSettings;
window.resetTrackerSettings = resetTrackerSettings;

export {};
