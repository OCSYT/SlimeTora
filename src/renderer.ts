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
  }
}

function stopConnection() {
  window.ipc.send("stop-connection", "");
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

/*
 * Event listeners
 */

window.ipc.on("device-data", (event, arg) => {
  console.log("Got device data: " + arg);
});

window.ipc.on("error-message", (event, arg) => {
  setStatus(arg);
});

// Set version number
window.ipc.on("version", (event, arg) => {
  document.getElementById("version").innerHTML = arg;
  console.log("Got app version: " + arg);
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
