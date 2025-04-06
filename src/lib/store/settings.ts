import { writable } from "svelte/store"

export type ProgramSettings = {
    checkForUpdates: boolean,
    autoUpdate: boolean,
    autoStart: boolean,
    autoOff: boolean,
    heartbeat: number,
    visualizationFPS: number
}

export type ConnectionSettings = {
    model: string,
    modes: string[],
    ports: string[],
    slimevrIP: string,
    slimevrPort: number
}

export type TrackerSettings = {
    fps: number,
    mode: number,
    dynamicCalibration: string[]
}

export const program = writable<ProgramSettings>({
    checkForUpdates: true,
    autoUpdate: false,
    autoStart: false,
    autoOff: false,
    heartbeat: 2000,
    visualizationFPS: 10,
})

export const connection = writable<ConnectionSettings>({
    model: "wireless2",
    modes: ["ble"],
    ports: [],
    slimevrIP: "255.255.255.255",
    slimevrPort: 6969,
})

export const tracker = writable<TrackerSettings>({
    fps: 100,
    mode: 2,
    dynamicCalibration: ["Accelerometer"]
})