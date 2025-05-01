import { writable, type Writable } from "svelte/store";
import type { ConnectionMode } from "$lib/types/connection";
import { startInterpreting, stopInterpreting } from "$lib/backend";
import type { TrackerModel } from "$lib/types/tracker";

export * as settings from "./settings";

export interface Tracker {
	name: string
	id: string,
	connection_mode: ConnectionMode,
	tracker_type: TrackerModel,
}

export const trackers = writable<Tracker[]>([]);

export const activeModes = writable<ConnectionMode[]>([]);
export const isOn: Writable<Boolean | null> = writable(null);
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
