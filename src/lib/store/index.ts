import { writable, type Writable } from "svelte/store";
import type { ConnectionMode } from "$lib/types/connection";
import { startInterpreting, stopInterpreting } from "$lib/backend";
import type { ChargeStatus, MagStatus, TrackerModel } from "$lib/types/tracker";
import { error, info } from "$lib/log";
import type { TrackerSettings } from "./settings";
import { load } from "@tauri-apps/plugin-store";

export * as settings from "./settings";

let trackersConfig: Awaited<ReturnType<typeof load>>;

export interface BatteryData {
	remaining?: number;
	voltage?: number;
	status?: ChargeStatus;
}

export interface Tracker {
	// Info
	id: string; // does NOT change and should be unique (MAC address or serial num (in format of bt names: HaritoraX()-(serial)?)
	name: string; // can be user-set
	connection_mode: ConnectionMode;
	tracker_type: TrackerModel;
	mac?: string;
	settings?: Omit<TrackerSettings, "heartbeat" | "buttonDebounce">;

	// Data
	data: TrackerData;
}

export interface TrackerData {
	rotation: number[];
	acceleration: number[];
	magnetometer?: MagStatus;
	battery?: BatteryData;
	rssi?: number;
}

export type TrackerSave = Omit<Tracker, "data">;

export const connectedTrackers = writable<Tracker[]>([]);
export const knownTrackers = writable<Tracker[]>([]);

export const trackerOpenStates = writable<Record<string, boolean>>({});

(async () => {
	try {
		trackersConfig = await load("trackers.json", { autoSave: true });

		try {
			const loaded = await trackersConfig.get("settings");
			if (loaded && typeof loaded === "object") {
				// for every Tracker in loaded, place into knownTrackers
				knownTrackers.set(Object.values(loaded));
			}
			info(`Loaded settings from trackers.json: ${JSON.stringify(loaded, null, 2)}`);
		} catch (e) {
			error(`Failed to load settings from trackers.json: ${e}`);
		}
	} catch (e) {
		error(`Failed to load trackers.json: ${e}`);
	}
})();

export async function saveTrackerConfig(tracker: TrackerSave) {
	if (!trackersConfig) {
		error("Trackers config not loaded yet.");
		return;
	}

	try {
		const settings = (await trackersConfig.get("settings")) || {};
		await trackersConfig.set("trackers", {
			...settings,
			[tracker.id]: tracker,
		});
		await trackersConfig.save();
		info(`Tracker ${tracker.id} saved to trackers.json`);
	} catch (e) {
		error(`Failed to save tracker ${tracker.id} to trackers.json: ${e}`);
	}
}

export async function getTrackerConfig(id: string): Promise<TrackerSave | undefined> {
	if (!trackersConfig) {
		error("Trackers config not loaded yet.");
		return;
	}

	try {
		const settings = await trackersConfig.get("trackers");
		if (!settings || typeof settings !== "object") return undefined;
		return (settings as Record<string, TrackerSave>)[id] as TrackerSave | undefined;
	} catch (e) {
		error(`Failed to get tracker config for id ${id}: ${e}`);
		return undefined;
	}
}

export const activeModes = writable<ConnectionMode[]>([]);
// null if first time / app just launched
export const isOn: Writable<boolean | null> = writable(null);
isOn.subscribe(async (value) => {
	info(`isOn: ${value}`);
	if (value) {
		startInterpreting();
	} else if (value === false) {
		stopInterpreting();
	}
});

export const currentPath = writable("/");

// TODO: change this so it can be translated by files
export const navLinks = [
	{
		name: "Home",
		icon: "ri:home-4-fill",
		link: "/",
	},
	{
		name: "Trackers",
		icon: "ri:compass-3-line",
		link: "/trackers",
	},
	{
		name: "Settings",
		icon: "ri:equalizer-line",
		link: "/settings",
	},
	{
		name: "About",
		icon: "ri:information-line",
		link: "/about",
	},
];

export const externalNavLinks = [
	{
		name: "GitHub",
		icon: "ri:github-line",
		link: "https://github.com/OCSYT/SlimeTora",
	},
	{
		name: "Discord",
		icon: "ri:discord-line",
		link: "https://discord.gg/3J6q2a5k4C",
	},
	{
		name: "Help",
		icon: "ri:question-line",
		link: "https://github.com/OCSYT/SlimeTora/wiki/",
	},
];
