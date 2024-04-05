// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ipc", {
    send: (channel, data) => {
        ipcRenderer.send(channel, data);
    },
    sendSync: (channel, data) => {
        return ipcRenderer.sendSync(channel, data);
    },
    on: (channel, callback) => {
        ipcRenderer.on(channel, callback);
    },
    invoke: (channel, data) => {
        return ipcRenderer.invoke(channel, data);
    },
});