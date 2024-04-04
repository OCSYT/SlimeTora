import "./index.css";

let bluetoothEnabled = false;
let gx6Enabled = false;
const selectedComPorts: string[] = [];
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

  comPorts.forEach((port: number) => {
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
  const bluetoothSwitch = document.getElementById("bluetooth-switch") as HTMLInputElement;
  const gx6Switch = document.getElementById("gx6-switch") as HTMLInputElement;
  const accelerometerSwitch = document.getElementById("accelerometer-switch") as HTMLInputElement;
  const gyroscopeSwitch = document.getElementById("gyroscope-switch") as HTMLInputElement;
  const magnetometerSwitch = document.getElementById("magnetometer-switch") as HTMLInputElement;

  // Set the checked property based on the settings
  bluetoothSwitch.checked = bluetoothEnabled;
  gx6Switch.checked = gx6Enabled;
  accelerometerSwitch.checked = accelerometerEnabled;
  gyroscopeSwitch.checked = gyroscopeEnabled;
  magnetometerSwitch.checked = magnetometerEnabled;

  // Set the smoothing input value
  (document.getElementById("smoothing-input") as HTMLInputElement).value = smoothingValue.toString();

  // Set the selected COM ports
  const comPortsSwitches = Array.from(document.getElementById("com-ports").querySelectorAll("input"));
  const selectedPorts = settings.comPorts || [];

  comPortsSwitches.forEach((port: HTMLInputElement) => {
    if (selectedPorts.includes(port.id)) {
      port.checked = true;
    }
  });

  selectedComPorts.push(...selectedPorts);

  console.log("Settings loaded: ", settings);
});

function startConnection() {
  console.log("Starting connection...");
  setStatus("searching...");
  if (bluetoothEnabled && gx6Enabled) {
    console.log("Both Bluetooth and GX6 are enabled");
  } else if (bluetoothEnabled) {
    window.ipc.send("start-connection", "bluetooth");
  } else if (gx6Enabled) {
    window.ipc.send("start-connection", { type: "gx6", ports: selectedComPorts });
    console.log("Starting GX6 connection with ports: ", selectedComPorts);
  } else {
    console.log("No connection method selected");
    setStatus("No connection method selected");
    return;
  }
}

function stopConnection() {
  if (bluetoothEnabled) {
    window.ipc.send("stop-connection", "bluetooth");
  }
  if (gx6Enabled) {
    window.ipc.send("stop-connection", "gx6");
  }
  console.log("Stopping connection");

  document.getElementById("status").innerHTML = "N/A";
}

function toggleVisualization() {
  console.log("Toggling visualization");
  // TODO implement visualization code for trackers
}

function setStatus(status: string) {
  document.getElementById("status").innerHTML = status;
  console.log("Status: " + status);
}

function addDeviceToList(deviceId: string) {
  const deviceList = document.getElementById("device-list");

  // Create a new div element
  const newDevice = document.createElement("div");
  newDevice.id = deviceId;
  newDevice.className = "column";

  // Fill the div with device data
  newDevice.innerHTML = `
    <div class="card">
      <header class="card-header">
        <p class="card-header-title is-centered">
          Device Name: <span id="device-name"> ${deviceId}</span>
        </p>
      </header>
      <div class="card-content">
        <div class="content">
          <p>Device ID: <span id="device-id">${deviceId}</span></p>
          <p>Rotation Data: <span id="rotation-data">0, 0, 0</span></p>
          <p>Acceleration Data: <span id="acceleration-data">0, 0, 0</span></p>
          <p>Battery: <span id="battery">N/A</span></p>
        </div>
      </div>
      <footer class="card-footer">
        <div class="card-footer-item">
          <div class="switch-container">
            <label for="sensor-switch">Enable Magnetometer</label>
            <div class="switch">
              <input type="checkbox" id="sensor-switch" />
              <label for="sensor-switch" class="slider round"></label>
            </div>
          </div>
        </div>
      </footer>
    </div>
  `;

  // Append the new device to the device list
  deviceList.appendChild(newDevice);
}

/*
 * Event listeners
 */

window.ipc.on("connect", (event, trackerID) => {
  console.log(`Connected to ${trackerID}`);
  addDeviceToList(trackerID);
  document.getElementById("tracker-count").innerHTML = (
    parseInt(document.getElementById("tracker-count").innerHTML) + 1
  ).toString();

  setStatus("connected");
});

window.ipc.on("disconnect", (event, trackerID) => {
  console.log(`Disconnected from ${trackerID}`);
  document.getElementById(trackerID).remove();
  document.getElementById("tracker-count").innerHTML = (
    parseInt(document.getElementById("tracker-count").innerHTML) - 1
  ).toString();

  if (document.getElementById("tracker-count").innerHTML === "0")
    setStatus("disconnected");
});

let lastUpdate = Date.now();

window.ipc.on(
  "device-data",
  (event, trackerID, rotationObject, gravityObject) => {
    const now = Date.now();

    if (now - lastUpdate < 10) {
      return;
    }

    lastUpdate = now;

    const rotation = `${rotationObject.x.toFixed(
      0
    )}, ${rotationObject.y.toFixed(0)}, ${rotationObject.z.toFixed(0)}`;
    const gravity = `${gravityObject.x.toFixed(0)}, ${gravityObject.y.toFixed(
      0
    )}, ${gravityObject.z.toFixed(0)}`;

    document
      .getElementById(trackerID)
      .querySelector("#rotation-data").innerHTML = rotation;
    document
      .getElementById(trackerID)
      .querySelector("#acceleration-data").innerHTML = gravity;
  }
);

window.ipc.on("device-battery", (event, trackerID, battery) => {
  document.getElementById(trackerID).querySelector("#battery").innerHTML =
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

/*
 * Settings event listeners
 */

document
  .getElementById("bluetooth-switch")
  .addEventListener("change", function () {
    bluetoothEnabled = !bluetoothEnabled;
    console.log("Bluetooth enabled: " + bluetoothEnabled);
    window.ipc.send("save-setting", { bluetoothEnabled: bluetoothEnabled });
  });

document.getElementById("gx6-switch").addEventListener("change", function () {
  gx6Enabled = !gx6Enabled;
  console.log("GX6 enabled: " + gx6Enabled);
  window.ipc.send("save-setting", { gx6Enabled: gx6Enabled });
});

document
  .getElementById("accelerometer-switch")
  .addEventListener("change", function () {
    accelerometerEnabled = !accelerometerEnabled;
    console.log("Accelerometer enabled: " + accelerometerEnabled);
    window.ipc.send("save-setting", {
      accelerometerEnabled: accelerometerEnabled,
    });
  });

document
  .getElementById("gyroscope-switch")
  .addEventListener("change", function () {
    gyroscopeEnabled = !gyroscopeEnabled;
    console.log("Gyroscope enabled: " + gyroscopeEnabled);
    window.ipc.send("save-setting", { gyroscopeEnabled: gyroscopeEnabled });
  });

document
  .getElementById("magnetometer-switch")
  .addEventListener("change", function () {
    magnetometerEnabled = !magnetometerEnabled;
    console.log("Magnetometer enabled: " + magnetometerEnabled);
    window.ipc.send("save-setting", {
      magnetometerEnabled: magnetometerEnabled,
    });
  });

document
  .getElementById("smoothing-save")
  .addEventListener("click", function () {
    smoothingValue = parseFloat(
      (document.getElementById("smoothing-input") as HTMLInputElement).value
    );
    console.log("Smoothing value: " + smoothingValue);
    window.ipc.send("save-setting", { smoothingValue: smoothingValue });
  });

document.getElementById("com-ports").addEventListener("change", (event) => {
  const comPorts = Array.from(document.getElementById("com-ports").querySelectorAll("input"));
  const selectedPorts: string[] = [];

  comPorts.forEach((port: HTMLInputElement) => {
    if (port.checked) {
      selectedPorts.push(port.id);
      if (!selectedComPorts.includes(port.id)) selectedComPorts.push(port.id);
    }
  });

  console.log("Selected COM ports: ", selectedPorts);
  window.ipc.send("save-setting", { comPorts: selectedPorts });

  // If three ports are selected, disable the rest
  if (selectedPorts.length >= 3) {
    comPorts.forEach((port: HTMLInputElement) => {
      if (!port.checked) {
        port.disabled = true;
      }
    });
  } else {
    // If less than three ports are selected, enable all ports
    comPorts.forEach((port: HTMLInputElement) => {
      port.disabled = false;
    });
  }
});

/*
 * IPC event listeners
 */

declare global {
  interface Window {
    startConnection: typeof startConnection;
    stopConnection: typeof stopConnection;
    toggleVisualization: typeof toggleVisualization;
  }
}

window.startConnection = startConnection;
window.stopConnection = stopConnection;
window.toggleVisualization = toggleVisualization;