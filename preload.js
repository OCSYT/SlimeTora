const { contextBridge, ipcRenderer } = require("electron");
/* Buttons */
contextBridge.exposeInMainWorld("ipc", {
    send: (channel, data) => {
        ipcRenderer.send(channel, data);
    },
    on: (channel, callback) => {
        ipcRenderer.on(channel, (event, ...args) => callback(...args));
    },
    invoke: (channel, data) => {
        return ipcRenderer.invoke(channel, data);
    },
});