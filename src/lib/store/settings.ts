import { ConnectionMode } from "$lib/types/connection"
import { TrackerModel, FPSMode, SensorAutoCorrection, SensorMode } from "$lib/types/tracker"
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
    models: TrackerModel[],
    modes: string[],
    ports: string[],
    slimevrIP: string,
    slimevrPort: number
}

export type TrackerSettings = {
    fps: FPSMode,
    mode: SensorMode,
    dynamicCalibration: SensorAutoCorrection[]
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
    // position of model/modes correspond to each other - e.g. model[0] = mode[0] (Wireless with Serial, X2 with BLE, etc)
    models: [TrackerModel.Wireless],
    modes: [ConnectionMode.Serial],
    ports: ["COM3", "COM4", "COM5"],
    slimevrIP: "255.255.255.255",
    slimevrPort: 6969,
})

export const tracker = writable<TrackerSettings>({
    fps: 100,
    mode: 2,
    dynamicCalibration: [SensorAutoCorrection.Accel]
})