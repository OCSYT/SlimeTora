import { invoke } from "@tauri-apps/api/core";
import { get, writable, type Writable } from "svelte/store";
import { connection } from "./settings";

export * as settings from "./settings";

export const activeModes = writable<string[]>([]);
export const isOn: Writable<Boolean | null> = writable(null);
isOn.subscribe(async (value) => {
	console.log(`isOn: ${value}`);
	if (value) {
		const modes = get(connection).modes;
		console.log(`Starting connection from frontend with modes: ${modes}`);
		invoke("start", { modes })

		activeModes.set(modes);
	} else if (value === false) {
		const modes = get(activeModes);
		console.log(`Stopping connection from frontend with modes: ${modes}`);
		invoke("stop", { modes })
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
