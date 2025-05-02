import { writable, type Writable } from "svelte/store";
import type { ConnectionMode } from "$lib/types/connection";
import { startInterpreting, stopInterpreting } from "$lib/backend";
import type { ChargeStatus, MagStatus, TrackerModel } from "$lib/types/tracker";

export * as settings from "./settings";

export interface BatteryData {
	remaining?: number;
	voltage?: number;
	status?: ChargeStatus;
}

export interface Tracker {
	// Info
	name: string;
	id: string;
	connection_mode: ConnectionMode;
	tracker_type: TrackerModel;
	mac?: string;
	
	// Data
	rotation: number[];
	acceleration: number[];
	battery?: BatteryData;
	magnetometer?: MagStatus;
}

export const trackers = writable<Tracker[]>([]);
export const trackerOpenStates = writable<Record<string, boolean>>({});

export const activeModes = writable<ConnectionMode[]>([]);
// null if first time / app just launched
export const isOn: Writable<boolean | null> = writable(null);
isOn.subscribe(async (value) => {
	console.log(`isOn: ${value}`);
	if (value) {
		startInterpreting();
	} else if (value === false) {
		stopInterpreting();
	}
});

export const currentPath = writable("/");
export const navLinks = [
	{
		name: "Home",
		icon: "ri:home-4-fill",
		link: "/",
	},
	{
		name: "Trackers",
		icon: "ri:gps-line",
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
		name: "Docs",
		icon: "ri:book-marked-line",
		link: "https://github.com/OCSYT/SlimeTora/wiki",
	},
];
