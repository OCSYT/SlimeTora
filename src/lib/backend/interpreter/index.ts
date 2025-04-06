import { invoke } from "@tauri-apps/api/core";
import { activeModes, settings } from "$lib/store";
import { get } from "svelte/store";
import { ConnectionMode } from "$lib/types/connection";
import { listen } from "@tauri-apps/api/event";
import { TrackerModel } from "$lib/types/tracker";
import { Wired } from "./haritorax-wired";
import { Wireless } from "./haritorax-wireless";
import { Wireless2 } from "./haritorax-2";

type Interpreter = Wireless | Wired | Wireless2;

const interpreterMap = {
	[TrackerModel.X2]: Wireless2,
	[TrackerModel.Wireless]: Wireless,
	[TrackerModel.Wired]: Wired,
};

let interpreters: Interpreter[] | null = null;

let unlistenBLE: any = null;
let unlistenSerial: any = null;

export function startInterpreting() {
	const modes = get(settings.connection).modes as ConnectionMode[];
	const model = get(settings.connection).model as TrackerModel;
	const ports = get(settings.connection).ports as string[];

	if (modes.length === 0 || !model) {
		return console.error("No modes or model selected for connection");
	}

	if (modes.includes(ConnectionMode.Serial) && ports.length === 0) {
		return console.error("No ports selected for serial connection");
	}

	console.log(`Starting interpreting with modes: ${modes}, model: ${model}, ports: ${ports}`);
	if (!interpreters) {
		interpreters = Object.values(interpreterMap).map((InterpreterClass) => new InterpreterClass());
	}

	invoke("start", { modes, model, ports });
	activeModes.set(modes);

	if (modes.includes(ConnectionMode.BLE)) {
		startNotifyBLE();
	} else if (modes.includes(ConnectionMode.Serial)) {
		startNotifySerial();
	}
}

export function stopInterpreting() {
	const modes = get(activeModes);

	console.log(`Stopping interpreting with modes: ${modes}`);

	if (modes.length === 0) {
		return console.error("No modes to stop");
	}

	invoke("stop", { modes });
	stopNotify();
}

async function startNotifyBLE() {
	unlistenBLE = await listen("ble_notification", (event) => {
		console.log("BLE notification received");
		const payload = event.payload as any; // it already is a JSON object

		const device = payload.peripheral_name;
		const characteristic = payload.characteristic_name;
		const service = payload.service_name;
		const data = payload.data;

		console.log(`Device: ${device}, Characteristic: ${characteristic}, Service: ${service}, Data: ${data}`);

		const model = get(settings.connection).model as TrackerModel;
		console.log(`Tracker model: ${model}`);

		// find interpreter by model
		const interpreter = interpreters?.find((interpreter) => interpreter.name === model);
		if (interpreter) {
			console.log(`Interpreter found: ${interpreter.name}`);
			interpreter.parse(data).catch((error) => {
				console.error("Error parsing data: ", error);
			});
		} else {
			console.error(`Interpreter not found for model: ${model}`);
		}

		console.log("BLE notification processed");
	});
}

async function startNotifySerial() {
	unlistenSerial = await listen("serial_notification", (event) => {
		const payload = event.payload as string;
		console.log(payload);

		const identifier = payload.split(":")[0];
		const data = payload.split(":")[1];

		console.log(`Identifier: ${identifier}, Data: ${data}`);
	});
}

function stopNotify() {
	if (unlistenBLE) {
		unlistenBLE();
		console.log("Stopped listening to BLE notifications");
	}
	if (unlistenSerial) {
		unlistenSerial();
		console.log("Stopped listening to Serial notifications");
	}
}
