import { ConnectionMode } from "./connection.svelte";
import { type BleDevice } from "@mnlphlp/plugin-blec";
import * as ble from "@mnlphlp/plugin-blec";

export class BLE extends ConnectionMode {
	public name: string = "Bluetooth";
	public isActive: boolean = false;
	public isAvailable: boolean = false;
	public supportedTrackers: string[] = [];

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
