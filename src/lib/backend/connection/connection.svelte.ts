export abstract class ConnectionMode {
	public name: string = "Unknown";

	public isActive: boolean = false;

	public isAvailable: boolean = false;

	public supportedTrackers: string[] = [];

	public async startConnection(): Promise<void> {
		console.error("startConnection not implemented");
		return Promise.reject(new Error("startConnection not implemented"));
	}

	public async stopConnection(): Promise<void> {
		console.error("stopConnection not implemented");
		return Promise.reject(new Error("stopConnection not implemented"));
	}

	public async write(device: string, data: string): Promise<void> {
		console.error("write not implemented");
		return Promise.reject(new Error("write not implemented"));
	}

	public async read(device: string): Promise<string | undefined> {
		console.error("read not implemented");
		return Promise.reject(new Error("read not implemented"));
	}

	public async listen(device: string, callback: (data: string) => void): Promise<void> {
		console.error("listen not implemented");
		return Promise.reject(new Error("listen not implemented"));
	}

	public async stopListening(device: string): Promise<void> {
		console.error("stopListening not implemented");
		return Promise.reject(new Error("stopListening not implemented"));
	}
}
