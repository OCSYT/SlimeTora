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

contextBridge.exposeInMainWorld("log", (message: string) => {
    ipcRenderer.send("log", message);
    console.log(message);
});

contextBridge.exposeInMainWorld("error", (message: string) => {
    ipcRenderer.send("error", message);
    console.error(message);
});

declare global {
    interface Window {
        startConnection: () => void;
        stopConnection: () => void;
        openLogsFolder: () => void;
        openTrackerSettings: (deviceID: string) => void;
    
        ipc: {
            invoke: (channel: string, args: any) => Promise<any>;
            send: (channel: string, args: any) => void;
            on: (
                channel: string,
                listener: (_event: any, args: any) => void
            ) => void;
        };

        log: (message: string) => void;
        error: (message: string) => void;
    }
    
    interface Rotation {
        x: number;
        y: number;
        z: number;
        w: number;
    }
    
    interface Gravity {
        x: number;
        y: number;
        z: number;
    }
    
    interface TrackerSettings {
        sensorMode: number;
        fpsMode: number;
        sensorAutoCorrection: string[];
        ankleMotionDetection: boolean;
    }
    
}