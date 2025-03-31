import { ConnectionMode } from "./connection.svelte";

export class Serial extends ConnectionMode {
	public name: string = "Serial";
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

	public getDevices() {
		console.error("getDevices not implemented");
		return [];
	}
}
