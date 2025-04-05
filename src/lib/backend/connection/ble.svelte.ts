import { invoke } from "@tauri-apps/api/core";
import { ConnectionMode } from "./connection.svelte";

// ok so https://github.com/MnlPhlp/tauri-plugin-blec doesn't support multiple devices. bruh.
// gonna try this repo lol (w/ btleplug): https://github.com/Dreaming-Codes/tauri-plugin-btleplug

export class BLE extends ConnectionMode {
	public name: string = "Bluetooth";
	public isActive: boolean = false;
	public isAvailable: boolean = false;
	public supportedTrackers: string[] = [];

	private activeDevices: string[] = [];

	constructor() {
		super();
	}

	public async startConnection() {
		invoke("start", { modes: "ble" })
	}

	public async stopConnection() {
		invoke("stop", { modes: "ble" })
		return Promise.reject(new Error("stopConnection not implemented"));
	}	
}