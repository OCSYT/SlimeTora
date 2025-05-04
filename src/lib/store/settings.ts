import { TrackerModel, FPSMode, SensorAutoCorrection, SensorMode } from "$lib/types/tracker";
import { writable } from "svelte/store";

export type ProgramSettings = {
	autoUpdate: boolean;
	checkUpdatesApp: boolean;
	checkUpdatesLanguage: boolean;
	autoStart: boolean;
	autoOff: boolean;
	visualizationFPS: number;
};

export type ConnectionSettings = {
	models: TrackerModel[];
	modes: string[];
	ports: string[];
	slimevrIP: string;
	slimevrPort: number;
};

export type TrackerSettings = {
	fps: FPSMode;
	mode: SensorMode;
	dynamicCalibration: SensorAutoCorrection[];
	ankleMotionDetection: boolean;
	heartbeat: number;
	buttonDebounce: number;
};

export const program = writable<ProgramSettings>({
	autoUpdate: false,
	checkUpdatesApp: true,
	checkUpdatesLanguage: true,
	autoStart: false,
	autoOff: false,
	visualizationFPS: 10,
});

export const connection = writable<ConnectionSettings>({
	// position of model/modes correspond to each other - e.g. model[0] = mode[0] (Wireless with Serial, X2 with BLE, etc)
	models: [],
	modes: [],
	ports: [],
	slimevrIP: "255.255.255.255",
	slimevrPort: 6969,
});

export const tracker = writable<TrackerSettings>({
	fps: 100,
	mode: 2,
	dynamicCalibration: [SensorAutoCorrection.Accel],
	ankleMotionDetection: false,
	heartbeat: 2000,
	buttonDebounce: 500,
});
