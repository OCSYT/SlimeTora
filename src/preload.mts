// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from "electron";
import i18next from "i18next";
// @ts-ignore
import locI18next from "loc-i18next";

import * as THREE from "three";
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

contextBridge.exposeInMainWorld("log", (message: string, where?: string) => {
    ipcRenderer.send("log", message, where);
    console.log(message);
});

contextBridge.exposeInMainWorld("warn", (message: string, where?: string) => {
    ipcRenderer.send("warn", message, where);
    console.warn(message);
});

contextBridge.exposeInMainWorld("error", (message: string, where?: string, err?: any) => {
    ipcRenderer.send("error", message, where, err);
    console.error(message);
});

contextBridge.exposeInMainWorld("localize", (resources?: any) => {
    if (!localize) {
        i18next
            .init({
                lng: "en",
                resources,
            })
            .then(() => {
                localize = locI18next.init(i18next);
                localize("[data-i18n]");

                ipcRenderer.send("log", "Attempting to localize", "i18n");
            });
    } else {
        ipcRenderer.send("log", "Attempting to localize again", "i18n");
        localize("[data-i18n]");
    }
});

contextBridge.exposeInMainWorld("changeLanguage", (lng: string) => {
    i18next.changeLanguage(lng).then(() => {
        if (localize) {
            ipcRenderer.send("log", `Attempting to change language to ${lng}`, "i18n");
            localize("[data-i18n]");
        }
    });
});

contextBridge.exposeInMainWorld("translate", async (key: string) => {
    let translation: string;

    if (!localize) {
        translation = await ipcRenderer.invoke("translate", key);
    } else {
        translation = i18next.t(key);
    }

    if (translation === key) {
        const error = `Translation for key "${key}" doesn't exist for current language.`;
        ipcRenderer.send("error", error, "i18n");
        console.error(error);
    }

    return translation;
});

contextBridge.exposeInMainWorld("i18n", {
    translate: (key: string) => i18next.t(key),
});

declare global {
    interface Window {
        three: {
            THREE: typeof THREE;
        };

        // index.ts
        startConnection: () => void;
        stopConnection: () => void;
        showOnboarding: () => void;
        openLogsFolder: () => void;
        saveSettings: () => void;
        openTrackerSettings: (deviceID: string) => void;

        // settings.ts
        saveTrackerSettings: () => void;
        getTrackerSettings: () => void;
        resetTrackerSettings: () => void;

        // onboarding.ts
        autodetect: () => void;
        runStartConnection: () => void;
        runStopConnection: () => void;

        ipc: {
            invoke: (channel: string, args: any) => Promise<any>;
            send: (channel: string, args: any) => void;
            on: (channel: string, listener: (_event: any, args: any) => void) => void;
        };

        log: (message: string, where?: string) => void;
        warn: (message: string, where?: string) => void;
        error: (message: string, where?: string, err?: any) => void;

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
    }
}
