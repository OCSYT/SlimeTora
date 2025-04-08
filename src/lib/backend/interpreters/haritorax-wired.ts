import { invoke } from "@tauri-apps/api/core";
import { TrackerInterpreter } from "../tracker";
import { TrackerModel } from "$lib/types/tracker";

export class Wired extends TrackerInterpreter {
	public name = TrackerModel.Wired;
	public isActive: boolean = false;
	public connectedDevices: string[] = [];

	constructor() {
		super();
	}

	public parse(data: string): Promise<any> {
		console.log(`Parsing data for ${this.name}: ${data}`);
		return Promise.resolve(data);
	}

	public async read(device: string): Promise<string | undefined> {
		console.log(`Reading data from device ${device}`);
		return await invoke("read", { device })
	}

	public async write(device: string, data: string): Promise<void> {
		console.log(`Writing data to device ${device}: ${data}`);
		return await invoke("write", { device, data });
	}
}
