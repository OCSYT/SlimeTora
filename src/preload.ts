// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ipc", {
    send: (channel: string, data: any) => {
        ipcRenderer.send(channel, data);
    },
    sendSync: (channel: string, data: any) => {
        return ipcRenderer.sendSync(channel, data);
    },
    on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
        ipcRenderer.on(channel, callback);
    },
    invoke: (channel: string, data: any) => {
        return ipcRenderer.invoke(channel, data);
    },
});