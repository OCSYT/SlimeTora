import { TrackerModel, FPSMode, SensorAutoCorrection, SensorMode } from "$lib/types/tracker";
import { writable } from "svelte/store";
import { load } from "@tauri-apps/plugin-store";
import { derived } from "svelte/store";
import { error, info } from "$lib/log";

export const config = await load("config.json", { autoSave: true });

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

try {
	const loaded = await config.get("settings");
	if (loaded && typeof loaded === "object") {
		const settings = loaded as {
			program?: ProgramSettings;
			connection?: ConnectionSettings;
			tracker?: TrackerSettings;
		};
		if (settings.program) program.set(settings.program);
		if (settings.connection) connection.set(settings.connection);
		if (settings.tracker) tracker.set(settings.tracker);
	}
	info(`Loaded settings from config.json: ${JSON.stringify(loaded)}`);
} catch (e) {
	error(`Failed to load settings from config.json: ${e}`);
}

// Auto-save settings to config.json on change
// Subscribe once to all settings and save when any changes
derived([program, connection, tracker], ([$program, $connection, $tracker]) => ({
	program: $program,
	connection: $connection,
	tracker: $tracker,
})).subscribe(async (settings) => {
	try {
		await config.set("settings", settings);
		await config.save();
		info(`Saved all settings to config.json`);
	} catch (e) {
		error(`Failed to save settings: ${e}`);
	}
});
