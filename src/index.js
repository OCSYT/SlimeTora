// TODO: Make tracker auto correction and smoothing work, and add feature to rename trackers
let isActive = false;

let bluetoothEnabled = false;
let gx6Enabled = false;
const selectedComPorts = [];
let accelerometerEnabled = false;
let gyroscopeEnabled = false;
let magnetometerEnabled = false;
let smoothingValue = 0;

document.addEventListener("DOMContentLoaded", async function () {
    console.log("DOM loaded");

    // Populate COM port switches
    const comPortList = document.getElementById("com-ports");
    const comPorts = await window.ipc.invoke("get-com-ports", null);

    console.log("COM ports: ", comPorts);

    comPorts.forEach((port) => {
        const switchHTML = `
        <div class="switch-container">
            <div class="switch">
            <input type="checkbox" id="${port}" />
            <label for="${port}" class="slider round"></label>
            </div>
            <label for="${port}">${port}</label>
        </div>
        `;

        comPortList.innerHTML += switchHTML;
    });

    // Get settings from config file
    const settings = await window.ipc.invoke("get-settings", null);
    bluetoothEnabled = settings.bluetoothEnabled || false;
    gx6Enabled = settings.gx6Enabled || false;
    accelerometerEnabled = settings.accelerometerEnabled || false;
    gyroscopeEnabled = settings.gyroscopeEnabled || false;
    magnetometerEnabled = settings.magnetometerEnabled || false;
    smoothingValue = settings.smoothingValue || 0;

    // Get the checkbox elements
    const bluetoothSwitch = document.getElementById("bluetooth-switch");
    const gx6Switch = document.getElementById("gx6-switch");
    const accelerometerSwitch = document.getElementById("accelerometer-switch");
    const gyroscopeSwitch = document.getElementById("gyroscope-switch");
    const magnetometerSwitch = document.getElementById("magnetometer-switch");

    // Set the checked property based on the settings
    bluetoothSwitch.checked = bluetoothEnabled;
    gx6Switch.checked = gx6Enabled;
    accelerometerSwitch.checked = accelerometerEnabled;
    gyroscopeSwitch.checked = gyroscopeEnabled;
    magnetometerSwitch.checked = magnetometerEnabled;

    // Set the smoothing input value
    document.getElementById("smoothing-input").value =
        smoothingValue.toString();

    // Set the selected COM ports
    const comPortsSwitches = Array.from(
        document.getElementById("com-ports").querySelectorAll("input")
    );
    const selectedPorts = settings.comPorts || [];

    comPortsSwitches.forEach((port) => {
        if (selectedPorts.includes(port.id)) {
            port.checked = true;
        }
    });

    selectedComPorts.push(...selectedPorts);

    console.log("Settings loaded: ", settings);

    addEventListeners();
});

function startConnection() {
    console.log("Starting connection...");
    setStatus("searching...");
    if (bluetoothEnabled && gx6Enabled) {
        window.ipc.send("start-connection", { type: "bluetooth" });
        window.ipc.send("start-connection", {
            type: "gx6",
            ports: selectedComPorts,
        });
    } else if (bluetoothEnabled) {
        window.ipc.send("start-connection", { type: "bluetooth" });
    } else if (gx6Enabled) {
        window.ipc.send("start-connection", {
            type: "gx6",
            ports: selectedComPorts,
        });
        console.log("Starting GX6 connection with ports: ", selectedComPorts);
    } else {
        console.log("No connection method selected");
        setStatus("No connection method selected");
        return;
    }

    isActive = true;
}

function stopConnection() {
    console.log("Stopping connection");
    isActive = false;

    if (bluetoothEnabled) {
        window.ipc.send("stop-connection", "bluetooth");
    }
    if (gx6Enabled) {
        window.ipc.send("stop-connection", "gx6");
    }

    document.getElementById("tracker-count").innerHTML = "0";
    document.getElementById("status").innerHTML = "N/A";
    const deviceList = document.getElementById("device-list");
    deviceList.innerHTML = "";
}

function toggleVisualization() {
    console.log("Toggling visualization");
    // TODO implement visualization code for trackers
}

function setStatus(status) {
    document.getElementById("status").innerHTML = status;
    console.log("Status: " + status);
}

function addDeviceToList(deviceID) {
    const deviceList = document.getElementById("device-list");

    // Create a new div element
    const newDevice = document.createElement("div");
    newDevice.id = deviceID;
    newDevice.className = "column";

    // Fill the div with device data
    newDevice.innerHTML = `
    <div class="card">
        <header class="card-header">
            <p class="card-header-title is-centered">
            Device Name:  <span id="device-name"> ${deviceID}</span>
            </p>
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
            <div class="switch-container">
                <label for="sensor-switch-${deviceID}">Enable Magnetometer</label>
                <div class="switch">
                <input type="checkbox" id="sensor-switch-${deviceID}" />
                <label for="sensor-switch-${deviceID}" class="slider round"></label>
                </div>
            </div>
            </div>
        </footer>
    </div>
    `;

    // Disable sensor switch for BT devices
    if (deviceID.startsWith("HaritoraXW-")) {
        newDevice.querySelector(`#sensor-switch-${deviceID}`).disabled = true;
        console.log(`Disabled sensor switch for ${deviceID} (BT device)`);
    }

    // Add event listener to sensor switch
    newDevice.querySelector(`#sensor-switch-${deviceID}`).addEventListener("change", async () => {
        const sensorSwitch = newDevice.querySelector(`#sensor-switch-${deviceID}`);
        const sensorEnabled = sensorSwitch.checked;
        console.log(`Sensor switch for ${deviceID} toggled: ${sensorEnabled}`);

        const settings = await window.ipc.invoke("get-tracker-settings", deviceID);
        let sensorMode = settings.sensorMode;
        const fpsMode = settings.fpsMode || 100;
        const sensorAutoCorrection = settings.sensorAutoCorrection || [];

        sensorMode = sensorEnabled ? 1 : 2;

        window.ipc.send("set-tracker-settings", { deviceID, sensorMode, fpsMode, sensorAutoCorrection });
    });

    // Append the new device to the device list
    deviceList.appendChild(newDevice);
}

/*
 * Event listeners
 */

window.ipc.on("connect", (event, deviceID) => {
    console.log(`Connected to ${deviceID}`);
    addDeviceToList(deviceID);
    document.getElementById("tracker-count").innerHTML = (
        parseInt(document.getElementById("tracker-count").innerHTML) + 1
    ).toString();

    setStatus("connected");

    if (deviceID.startsWith("HaritoraXW-")) return;

    // set sensorAutoCorrection settings
    const settings = window.ipc.invoke("get-tracker-settings", deviceID);
    const sensorMode = settings.sensorMode || 1;
    const fpsMode = settings.fpsMode || 100;
    let sensorAutoCorrection = settings.sensorAutoCorrection || [];

    if (accelerometerEnabled) sensorAutoCorrection.push("accel");
    if (gyroscopeEnabled) sensorAutoCorrection.push("gyro");
    if (magnetometerEnabled) sensorAutoCorrection.push("mag");

    console.log("Sensor auto correction: ", sensorAutoCorrection);

    window.ipc.send("set-tracker-settings", { deviceID, sensorMode, fpsMode, sensorAutoCorrection });
});

window.ipc.on("disconnect", (event, deviceID) => {
    console.log(`Disconnected from ${deviceID}`);
    document.getElementById(deviceID).remove();
    document.getElementById("tracker-count").innerHTML = (
        parseInt(document.getElementById("tracker-count").innerHTML) - 1
    ).toString();

    if (document.getElementById("tracker-count").innerHTML === "0")
        setStatus("disconnected");
});

let lastUpdate = Date.now();

window.ipc.on(
    "device-data",
    (event, deviceID, rotationObject, gravityObject) => {
        if (
            !isActive ||
            !document
                .getElementById("device-list")
                .querySelector(`#${deviceID}`)
        )
            return;
        const now = Date.now();

        if (now - lastUpdate < 50) {
            return;
        }

        lastUpdate = now;

        const rotation = `${rotationObject.x.toFixed(
            0
        )}, ${rotationObject.y.toFixed(0)}, ${rotationObject.z.toFixed(0)}`;
        const gravity = `${gravityObject.x.toFixed(
            0
        )}, ${gravityObject.y.toFixed(0)}, ${gravityObject.z.toFixed(0)}`;

        document
            .getElementById(deviceID)
            .querySelector("#rotation-data").innerHTML = rotation;
        document
            .getElementById(deviceID)
            .querySelector("#acceleration-data").innerHTML = gravity;
    }
);

window.ipc.on("device-battery", (event, deviceID, battery) => {
    if (!isActive) return;
    document.getElementById(deviceID).querySelector("#battery").innerHTML =
        battery;
});

window.ipc.on("error-message", (event, msg) => {
    setStatus(msg);
});

// Set version number
window.ipc.on("version", (event, version) => {
    document.getElementById("version").innerHTML = version;
    console.log("Got app version: " + version);
});

function addEventListeners() {
    /*
     * Settings event listeners
     */

    document
        .getElementById("bluetooth-switch")
        .addEventListener("change", function () {
            bluetoothEnabled = !bluetoothEnabled;
            console.log("Bluetooth enabled: " + bluetoothEnabled);
            window.ipc.send("save-setting", {
                bluetoothEnabled: bluetoothEnabled,
            });
        });

    document
        .getElementById("gx6-switch")
        .addEventListener("change", function () {
            gx6Enabled = !gx6Enabled;
            console.log("GX6 enabled: " + gx6Enabled);
            window.ipc.send("save-setting", { gx6Enabled: gx6Enabled });
        });

    document
        .getElementById("accelerometer-switch")
        .addEventListener("change", async function () {
            accelerometerEnabled = !accelerometerEnabled;
            console.log("Accelerometer enabled: " + accelerometerEnabled);
            window.ipc.send("save-setting", {
                accelerometerEnabled: accelerometerEnabled,
            });

            const activeTrackers = await window.ipc.invoke("get-active-trackers", null);
            console.log("Active trackers: ", activeTrackers);

            activeTrackers.forEach(async (deviceID) => {
                if (deviceID.startsWith("HaritoraXW-")) return;
                const settings = await window.ipc.invoke("get-tracker-settings", deviceID);
                const sensorMode = settings.sensorMode;
                const fpsMode = settings.fpsMode || 100;
                let sensorAutoCorrection = settings.sensorAutoCorrection || [];

                if (accelerometerEnabled) {
                    sensorAutoCorrection.push("accel");
                } else {
                    sensorAutoCorrection = sensorAutoCorrection.filter((sensor) => sensor !== "accel");
                }

                console.log("Sensor auto correction: ", sensorAutoCorrection);

                window.ipc.send("set-tracker-settings", { deviceID, sensorMode, fpsMode, sensorAutoCorrection });
            });
        });

    document
        .getElementById("gyroscope-switch")
        .addEventListener("change", async function () {
            gyroscopeEnabled = !gyroscopeEnabled;
            console.log("Gyroscope enabled: " + gyroscopeEnabled);
            window.ipc.send("save-setting", {
                gyroscopeEnabled: gyroscopeEnabled,
            });

            const activeTrackers = await window.ipc.invoke("get-active-trackers", null);

            activeTrackers.forEach(async (deviceID) => {
                if (deviceID.startsWith("HaritoraXW-")) return;
                const settings = await window.ipc.invoke("get-tracker-settings", deviceID);
                const sensorMode = settings.sensorMode;
                const fpsMode = settings.fpsMode || 100;
                let sensorAutoCorrection = settings.sensorAutoCorrection || [];

                if (gyroscopeEnabled) {
                    sensorAutoCorrection.push("gyro");
                } else {
                    sensorAutoCorrection = sensorAutoCorrection.filter((sensor) => sensor !== "gyro");
                }

                console.log("Sensor auto correction: ", sensorAutoCorrection);

                window.ipc.send("set-tracker-settings", { deviceID, sensorMode, fpsMode, sensorAutoCorrection });
            });
        });

    document
        .getElementById("magnetometer-switch")
        .addEventListener("change", async function () {
            magnetometerEnabled = !magnetometerEnabled;
            console.log("Magnetometer enabled: " + magnetometerEnabled);
            window.ipc.send("save-setting", {
                magnetometerEnabled: magnetometerEnabled,
            });

            const activeTrackers = await window.ipc.invoke("get-active-trackers", null);

            activeTrackers.forEach(async (deviceID) => {
                if (deviceID.startsWith("HaritoraXW-")) return;
                const settings = await window.ipc.invoke("get-tracker-settings", deviceID);
                const sensorMode = settings.sensorMode;
                const fpsMode = settings.fpsMode || 100;
                let sensorAutoCorrection = settings.sensorAutoCorrection || [];

                if (magnetometerEnabled) {
                    sensorAutoCorrection.push("mag");
                } else {
                    sensorAutoCorrection = sensorAutoCorrection.filter((sensor) => sensor !== "mag");
                }

                console.log("Sensor auto correction: ", sensorAutoCorrection);

                window.ipc.send("set-tracker-settings", { deviceID, sensorMode, fpsMode, sensorAutoCorrection });
            });
        });

    document
        .getElementById("smoothing-save")
        .addEventListener("click", function () {
            smoothingValue = parseFloat(
                document.getElementById("smoothing-input").value
            );
            console.log("Smoothing value: " + smoothingValue);
            window.ipc.send("save-setting", { smoothingValue: smoothingValue });
        });

    document.getElementById("com-ports").addEventListener("change", () => {
        const comPorts = Array.from(
            document.getElementById("com-ports").querySelectorAll("input")
        );
        const selectedPorts = [];

        comPorts.forEach((port) => {
            if (port.checked) {
                selectedPorts.push(port.id);
                if (!selectedComPorts.includes(port.id))
                    selectedComPorts.push(port.id);
            }
        });

        console.log("Selected COM ports: ", selectedPorts);
        window.ipc.send("save-setting", { comPorts: selectedPorts });

        // If three ports are selected, disable the rest
        if (selectedPorts.length >= 3) {
            comPorts.forEach((port) => {
                if (!port.checked) {
                    port.disabled = true;
                }
            });
        } else {
            // If less than three ports are selected, enable all ports
            comPorts.forEach((port) => {
                port.disabled = false;
            });
        }
    });
}

/*
 * IPC event listeners
 */

window.startConnection = startConnection;
window.stopConnection = stopConnection;
window.toggleVisualization = toggleVisualization;
