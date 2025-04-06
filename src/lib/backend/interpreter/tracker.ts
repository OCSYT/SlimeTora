import type { TrackerModel } from "$lib/types/tracker";

export abstract class TrackerInterpreter {
	public name: TrackerModel | "Unknown" = "Unknown";
	public isActive: boolean = false;
	public connectedDevices: string[] = [];

	public parse(data: string): Promise<any> {
		console.error("parse not implemented");
		return Promise.reject(new Error("parse not implemented"));
	}

	public async read(device: string): Promise<string | undefined> {
		console.error("read not implemented");
		return Promise.reject(new Error("read not implemented"));
	}

	public async write(device: string, data: string): Promise<void> {
		console.error("write not implemented");
		return Promise.reject(new Error("write not implemented"));
	}
}
