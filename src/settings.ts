var deviceID = "";
var accelerometerEnabled = false;
var gyroscopeEnabled = false;
var magnetometerEnabled = false;
var fpsMode = 50;
var sensorMode = 2;

document.addEventListener("DOMContentLoaded", async function () {
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
                global: {
                    trackers: {
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
                global: {
                    trackers: {
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
});

// Set tracker name and variable
window.ipc.on("trackerName", (_event, arg) => {
    document.getElementById("tracker-name").innerHTML = arg;
    window.log(`Opened per-tracker settings for: ${arg}`);
    deviceID = arg;
});
