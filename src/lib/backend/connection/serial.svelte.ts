import { ConnectionMode } from "./connection.svelte";
import { SerialPort } from "tauri-plugin-serialplugin";

export class Serial extends ConnectionMode {
	public name: string = "Serial";
	public isActive: boolean = false;
	public isAvailable: boolean = false;
	public supportedTrackers: string[] = [];

	public availablePorts: string[] = [];
	private activePorts: SerialPort[] = [];

	constructor() {
		super();

		// check if we can access serial ports in system
		// TODO: permission check for mac and linux
		SerialPort.available_ports()
			.then((ports) => {
				this.isAvailable = true;
				this.availablePorts = Object.values(ports).map((port: { path: string }) => port.path);
				console.log(`Available ports: ${ports}`);
			})
			.catch((error) => {
				this.isAvailable = false;
				console.error(`Error getting available ports: ${error}`);
			});
	}

	public async startConnection(ports?: string[]): Promise<void> {
		if (!ports) {
			const msg = "COM port(s) required to start connection";
			console.error(msg);
			return Promise.reject(new Error(msg));
		}

		this.isActive = true;

		for (const path of ports) {
			console.log(`Starting connection on COM port ${path}`);
			try {
				const port = new SerialPort({
					path,
					baudRate: 500000,
				});
				await port.open();
				this.activePorts.push(port);

				await port.startListening();
				await port.listen((data: string) => {
					console.log(`Received data from ${path}:`, data);
				});

				console.log(`Connected to ${path}`);
			} catch (error) {
				console.error(`Failed to connect to ${path}:`, error);
				this.isActive = false;
			}
		}
	}

	public async stopConnection() {
		this.isActive = false;

		for (const port of this.activePorts) {
			try {
				await port.stopListening();
				await port.close();
				console.log(`Disconnected from ${port.options.path}`);
			} catch (error) {
				console.error(`Failed to disconnect from ${port.options.pat}:`, error);
			}
		}

		this.activePorts = [];
		console.log("All connections closed.");
	}

	public async write(device: string, data: string): Promise<void> {
		const port = this.activePorts.find((port) => port.options.path === device);
		const finalData = `\n${data}\n`;
		if (port) {
			try {
				await port.write(finalData);
				console.log(`Sent data to ${device}:`, data);
			} catch (error) {
				console.error(`Failed to write to ${device}:`, error);
			}
		} else {
			console.error(`Port ${device} not found in active ports.`);
		}
	}

	public async read(device: string): Promise<string> {
		const port = this.activePorts.find((port) => port.options.path === device);
		if (port) {
			try {
				const data = await port.read();
				console.log(`Received data from ${device}:`, data);
				return data;
			} catch (error) {
				console.error(`Failed to read from ${device}:`, error);
				throw error;
			}
		} else {
			console.error(`Port ${device} not found in active ports.`);
			throw new Error(`Port ${device} not found in active ports.`);
		}
	}
	
	public async listen(device: string, callback: (data: string) => void): Promise<void> {
		const port = this.activePorts.find((port) => port.options.path === device);
		if (port) {
			try {
				await port.listen(callback);
				console.log(`Listening on ${device}`);
			} catch (error) {
				console.error(`Failed to listen on ${device}:`, error);
			}
		} else {
			console.error(`Port ${device} not found in active ports.`);
		}
	}

	public async stopListening(device: string): Promise<void> {
		const port = this.activePorts.find((port) => port.options.path === device);
		if (port) {
			try {
				await port.stopListening();
				console.log(`Stopped listening on ${device}`);
			} catch (error) {
				console.error(`Failed to stop listening on ${device}:`, error);
			}
		} else {
			console.error(`Port ${device} not found in active ports.`);
		}
	}
}