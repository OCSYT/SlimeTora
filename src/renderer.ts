/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/latest/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import "./index.css";

let bluetoothEnabled = false;
let gx6Enabled = false;

document.addEventListener("DOMContentLoaded", async function () {
  console.log("DOM loaded");
});

function startConnection() {
  console.log("Starting connection...");
  setStatus("connecting...");
  if (bluetoothEnabled && gx6Enabled) {
    console.log("Both Bluetooth and GX6 are enabled");
  } else if (bluetoothEnabled) {
    window.ipc.send("start-connection", "bluetooth");
  } else if (gx6Enabled) {
    window.ipc.send("start-connection", "gx6");
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
          <p>Battery: <span id="battery">1%</span></p>
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

  if (document.getElementById("tracker-count").innerHTML === "0") setStatus("disconnected");
});

window.ipc.on("device-data", (event, trackerName, rotation, gravity) => {
  console.log(
    `Got device data: Tracker Name - ${trackerName}, Rotation - ${rotation}, Gravity - ${gravity}`
  );
});

window.ipc.on("error-message", (event, msg) => {
  setStatus(msg);
});

// Set version number
window.ipc.on("version", (event, version) => {
  document.getElementById("version").innerHTML = version;
  console.log("Got app version: " + version);
});

document
  .getElementById("bluetooth-switch")
  .addEventListener("change", function () {
    bluetoothEnabled = !bluetoothEnabled;
    console.log("Bluetooth enabled: " + bluetoothEnabled);
  });

document.getElementById("gx6-switch").addEventListener("change", function () {
  gx6Enabled = !gx6Enabled;
  console.log("GX6 enabled: " + gx6Enabled);
});

/*
 * IPC event listeners
 */

(window as any).startConnection = startConnection;
(window as any).stopConnection = stopConnection;
(window as any).toggleVisualization = toggleVisualization;
