const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ipc", {
    send: (channel, data) => {
        ipcRenderer.send(channel, data);
    },
    sendSync: (channel, data) => {
        ipcRenderer.sendSync(channel, data);
    },
    on: (channel, callback) => {
        ipcRenderer.on(channel, (event, ...args) => callback(...args));
    },
    invoke: (channel, data) => {
        return ipcRenderer.invoke(channel, data);
    },

});