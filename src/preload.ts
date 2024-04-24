// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from "electron";
import i18next from "i18next";
// @ts-ignore
import locI18next from "loc-i18next";

let localize: any = null;

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

contextBridge.exposeInMainWorld("localize", (resources?: any) => {
    if (!localize) {
        i18next
            .init({
                lng: "en",
                resources,
                debug: true,
            })
            .then(() => {
                localize = locI18next.init(i18next);
                localize("[data-i18n]");

                ipcRenderer.send("log", "Attempting to localize");
            });
    } else {
        ipcRenderer.send("log", "Attempting to localize again");
        localize("[data-i18n]");
    }
});

contextBridge.exposeInMainWorld("changeLanguage", (lng: string) => {
    i18next.changeLanguage(lng).then(() => {
        if (localize) {
            ipcRenderer.send("log", `Attempting to change language to ${lng}`);
            localize("[data-i18n]");
        }
    });
});

contextBridge.exposeInMainWorld("translate", async (key: string) => {
    if (!localize) {
        const result = await ipcRenderer.invoke(
            "executeJavaScript",
            `window.i18n.translate("${key}")`
        );
        return result;
    } else {
        return i18next.t(key);
    }
});

contextBridge.exposeInMainWorld("i18n", {
    translate: (key: string) => i18next.t(key),
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

        localize: (resources?: string) => void;
        changeLanguage: (lng: string) => void;
        translate: (key: string) => Promise<string>;
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
