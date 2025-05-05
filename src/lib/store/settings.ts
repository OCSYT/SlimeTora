import { TrackerModel, FPSMode, SensorAutoCorrection, SensorMode } from "$lib/types/tracker";
import { writable } from "svelte/store";
import { load } from "@tauri-apps/plugin-store";
import { derived } from "svelte/store";
import { error, info } from "$lib/log";

export const config = await load("config.json", { autoSave: true });

export type LoggingMode = "minimal" | "debug" | "all";

export type ProgramSettings = {
	autoUpdate: boolean;
	checkUpdatesApp: boolean;
	checkUpdatesLanguage: boolean;
	updateChannel: string;
	autoStart: boolean;
	autoOff: boolean;
	visualization: boolean;
	visualizationFPS: number;
	preciseData: boolean;
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

export type AdvancedSettings = {
	bypassSerialLimit: boolean;
	writeLogs: boolean;
	loggingMode: LoggingMode;
}

export const program = writable<ProgramSettings>({
	autoUpdate: false,
	checkUpdatesApp: true,
	checkUpdatesLanguage: true,
	updateChannel: "stable",
	autoStart: false,
	autoOff: false,
	visualization: false,
	visualizationFPS: 10,
	preciseData: false,
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

export const advanced = writable<AdvancedSettings>({
	bypassSerialLimit: false,
	writeLogs: true,
	loggingMode: "minimal"
});

try {
	const loaded = await config.get("settings");
	if (loaded && typeof loaded === "object") {
		const settings = loaded as {
			program?: ProgramSettings;
			connection?: ConnectionSettings;
			tracker?: TrackerSettings;
			advanced?: AdvancedSettings;
		};
		if (settings.program) program.set(settings.program);
		if (settings.connection) connection.set(settings.connection);
		if (settings.tracker) tracker.set(settings.tracker);
		if (settings.advanced) advanced.set(settings.advanced);
	}
	info(`Loaded settings from config.json: ${JSON.stringify(loaded)}`);
} catch (e) {
	error(`Failed to load settings from config.json: ${e}`);
}

let lastSettings: any = null;

derived([program, connection, tracker, advanced], ([$program, $connection, $tracker, $advanced]) => ({
	program: $program,
	connection: $connection,
	tracker: $tracker,
	advanced: $advanced,
})).subscribe(async (settings) => {
	try {
		if (lastSettings) {
			type SettingsType = {
				[key: string]: any;
				program: ProgramSettings;
				connection: ConnectionSettings;
				tracker: TrackerSettings;
				advanced: AdvancedSettings;
			};
			for (const key of Object.keys(settings)) {
				const current = (settings as SettingsType)[key];
				const previous = lastSettings[key];
				// what even is this
				if (Array.isArray(current) || Array.isArray(previous)) {
					if (JSON.stringify(current) !== JSON.stringify(previous))
						info(`Changed "${key}": from ${JSON.stringify(previous)} to ${JSON.stringify(current)}`);
				} else if (
					typeof current === "object" &&
					current !== null &&
					previous &&
					typeof previous === "object"
				) {
					for (const subKey of Object.keys(current)) {
						if (JSON.stringify(current[subKey]) !== JSON.stringify(previous[subKey]))
							info(
								`Changed "${key}.${subKey}": from ${JSON.stringify(previous[subKey])} to ${JSON.stringify(current[subKey])}`,
							);
					}
				} else if (JSON.stringify(current) !== JSON.stringify(previous)) {
					info(`Changed "${key}": from ${JSON.stringify(previous)} to ${JSON.stringify(current)}`);
				}
			}
		}
		await config.set("settings", settings);
		await config.save();
		info(`Settings saved`);
		lastSettings = JSON.parse(JSON.stringify(settings));
	} catch (e) {
		error(`Failed to save settings: ${e}`);
	}
});
