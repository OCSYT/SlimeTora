import { ConnectionMode } from "./connection.svelte";
import { type BleDevice } from "@mnlphlp/plugin-blec";
import * as ble from "@mnlphlp/plugin-blec";

// ok so https://github.com/MnlPhlp/tauri-plugin-blec doesn't support multiple devices. bruh.
// gonna try this repo lol (w/ btleplug): https://github.com/Dreaming-Codes/tauri-plugin-btleplug

export class BLE extends ConnectionMode {
	public name: string = "Bluetooth";
	public isActive: boolean = false;
	public isAvailable: boolean = false;
	public supportedTrackers: string[] = [];

	private activeDevices: BleDevice[] = [];

	constructor() {
		super();
	}

	public async startConnection() {
		console.error("startConnection not implemented");
		return Promise.reject(new Error("startConnection not implemented"));
	}

	public async stopConnection() {
		console.error("stopConnection not implemented");
		return Promise.reject(new Error("stopConnection not implemented"));
	}	
}