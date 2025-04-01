import { ConnectionMode } from "./connection.svelte";
import { type BleDevice } from "@mnlphlp/plugin-blec";
import * as ble from "@mnlphlp/plugin-blec";

export class BLE extends ConnectionMode {
	public name: string = "Bluetooth";
	public isActive: boolean = false;
	public isAvailable: boolean = false;
	public supportedTrackers: string[] = [];

	private activeDevices: BleDevice[] = [];

	constructor() {
		super();

		// Check if Bluetooth is available
		ble.checkPermissions()
			.then((result) => {
				this.isAvailable = result;
				if (this.isAvailable) {
					console.log("Bluetooth is available");
				} else {
					console.warn("Bluetooth is not available");
				}
			})
			.catch((error) => {
				this.isAvailable = false;
				console.error(`Error checking Bluetooth permissions: ${error}`);
			});
	}

	public async startConnection() {
		if (!this.isAvailable) {
			const msg = "Bluetooth is not available";
			console.error(msg);
			return Promise.reject(new Error(msg));
		}

		this.isActive = true;

		try {
			// TODO: keep scanning for devices until stopped
			await ble.startScan(this.handleDiscoveredDevice, 5000);
			console.log("Bluetooth scan started");
		} catch (error) {
			this.isActive = false;
			console.error(`Failed to start Bluetooth scan: ${error}`);
			return Promise.reject(error);
		}
	}

	public async stopConnection() {
		console.error("stopConnection not implemented");
		return Promise.reject(new Error("stopConnection not implemented"));
	}

	private handleDiscoveredDevice(devices: BleDevice[]) {
		console.log(`Discovered ${devices.length} devices`);
		console.log(`Devices: ${JSON.stringify(devices)}`);
		devices.forEach((device) => {
			if (device.name.startsWith("Haritora")) {
				console.log(`Found Haritora device: ${device.name}`);
				ble.connect(device.address, () => {
					console.log(`Disconnected from ${device.name}`);
				});
				ble.subscribeString
				this.activeDevices.push(device);
			}
		});
	}
	
}