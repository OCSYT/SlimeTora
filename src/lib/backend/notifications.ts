import { browser } from "$app/environment";
import { trackers } from "$lib/store";
import type { ConnectionMode } from "$lib/types/connection";
import { MagStatus, type IMUData, type TrackerModel } from "$lib/types/tracker";
import { listen } from "@tauri-apps/api/event";

export const Notifications = [
	"imu",
	"mag",
	"info",
	"tracker",
	"button",
	"battery",
	"settings",
	"connect",
	"disconnect",
	"paired",
	"unpaired",
] as const;
export type NotificationType = (typeof Notifications)[number];

export class Notification {
	private activeNotifications = new Map<NotificationType, Function>();

	async start(type: NotificationType) {
		if (this.activeNotifications.has(type)) {
			console.warn(`Already listening to "${type}" notifications`);
			return;
		}

		let unlisten: Function | undefined;
		switch (type) {
			case "imu":
				unlisten = await imuNotification();
				break;
			case "mag":
				unlisten = await magNotification();
				break;
			case "battery":
				unlisten = await batteryNotification();
				break;
			case "button":
				unlisten = await buttonNotification();
				break;
			case "settings":
				unlisten = await settingsNotification();
				break;
			// tracker management
			case "connect":
				unlisten = await connectNotification();
				break;
			case "disconnect":
				unlisten = await disconnectNotification();
				break;
			default:
				console.error(`No notification type "${type}" available`);
				return;
		}

		if (unlisten) this.activeNotifications.set(type, unlisten);
	}

	stop(type: NotificationType) {
		if (!this.activeNotifications.has(type)) {
			console.warn(`Not listening to "${type}" notifications`);
			return;
		}

		const unlisten = this.activeNotifications.get(type);
		if (unlisten) unlisten();
		this.activeNotifications.delete(type);
		console.log(`Stopped listening to "${type}" notifications`);
	}

	getActiveNotifications() {
		return Array.from(this.activeNotifications.keys()) as NotificationType[];
	}

	clearAllNotifications() {
		this.activeNotifications.forEach((unlisten) => unlisten());
		this.activeNotifications.clear();
		console.log(`Stopped listening to all notifications`);
	}
}

async function imuNotification() {
	return await listen("imu", (event) => {
		const payload = event.payload as IMUData;
		const tracker = payload.tracker;
		const data = payload.data as { rotation: any; acceleration: any };
		const { rotation, acceleration } = data;

		const card = document.querySelector(`#tracker-card-${tracker}`);
		if (!card) return;
		const imuData = card.querySelector("#imu");
		if (!imuData) return;

		const newData = `${rotation.x.toFixed(0)}, ${rotation.y.toFixed(0)}, ${rotation.z.toFixed(0)} (${acceleration.x.toFixed(0)}, ${acceleration.y.toFixed(0)}, ${acceleration.z.toFixed(0)})`;
		imuData.textContent = newData;
	});
}

async function magNotification() {
	return await listen("mag", (event) => {
		const payload = event.payload as {
			tracker: string;
			connection_mode: ConnectionMode;
			tracker_type: TrackerModel;
			data: { magnetometer: MagStatus };
		};
		const tracker = payload.tracker;
		const data = payload.data;

		const card = document.querySelector(`#tracker-card-${tracker}`);
		if (!card) return;
		const magMain = card.querySelector("#mag-main");
		const magSmall = card.querySelector("#mag-small");

		const magData = (data.magnetometer as string).toLowerCase();

		if (magMain) {
			const magIcon = magMain.querySelector("#mag-icon");
			const magText = magMain.querySelector("#mag-text");
			if (magIcon && magText) {
				const currentStatusClass = Array.from(magText.classList).find((cls) => cls.startsWith("mag-status-"));
				const newStatusClass = `mag-status-${magData}`;
				if (currentStatusClass !== newStatusClass) {
					if (currentStatusClass) {
						magIcon.classList.remove(currentStatusClass);
						magText.classList.remove(currentStatusClass);
					}
					magText.classList.add(newStatusClass);
					magIcon.classList.add(newStatusClass);
					magText.textContent = magData.replace("_", " ");
				}
			}
		}

		if (magSmall) {
			const magIcon = magSmall.querySelector("#mag-icon");
			const magText = magSmall.querySelector("#mag-text");
			if (magIcon && magText) {
				const currentStatusClass = Array.from(magText.classList).find((cls) => cls.startsWith("mag-status-"));
				const newStatusClass = `mag-status-${magData}`;
				if (currentStatusClass !== newStatusClass) {
					if (currentStatusClass) {
						magIcon.classList.remove(currentStatusClass);
						magText.classList.remove(currentStatusClass);
					}
					magText.classList.add(newStatusClass);
					magIcon.classList.add(newStatusClass);
					magText.textContent = magData.replace("_", " ");
				}
			}
		}
	});
}

async function batteryNotification() {
	return await listen("battery", (event) => {
		const payload = event.payload as {
			tracker: string;
			data: { remaining: number | null; voltage: number | null; status: string | null };
		};
		const tracker = payload.tracker;
		const data = payload.data;

		console.log(`Battery notification received from ${tracker}: ${JSON.stringify(data)}`);

		const card = document.querySelector(`#tracker-card-${tracker}`);
		if (!card) return;
		const mainBattery = card.querySelector("#battery-main");
		const smallBattery = card.querySelector("#battery-small");
		if (!mainBattery || !smallBattery) return;

		const mainBatteryText = `${data.remaining}% (${(data.voltage ? data.voltage / 1000 : 0).toFixed(2)}V)`;
		const smallBatteryText = `${data.remaining}%`;
		mainBattery.textContent = mainBatteryText;
		smallBattery.textContent = smallBatteryText;
	});
}

async function buttonNotification() {
	return await listen("button", (event) => {
		const payload = event.payload as { tracker: string; data: { button: string } };
		const tracker = payload.tracker;
		const data = payload.data;

		console.log(`Button notification received from ${tracker}: ${JSON.stringify(data)}`);
	});
}

async function settingsNotification() {
	return await listen("settings", (event) => {
		const payload = event.payload as { tracker: string; data: { settings: any } };
		const tracker = payload.tracker;
		const data = payload.data;

		console.log(`Settings notification received from ${tracker}: ${JSON.stringify(data)}`);
	});
}

/*
 * Tracker management
 */

async function connectNotification() {
	return await listen("connect", (event) => {
		const payload = event.payload as {
			tracker: string;
			connection_mode: ConnectionMode;
			tracker_type: TrackerModel;
		};
		const tracker = payload.tracker;
		const connection_mode = payload.connection_mode;
		const tracker_type = payload.tracker_type;

		console.log(
			`Tracker connected: ${tracker}, connection mode: ${connection_mode}, tracker type: ${tracker_type}`,
		);

		if (!browser) return;
		// TODO: get tracker name from config if available
		// TODO: prob add mac address to tracker object
		trackers.update((prev) => {
			return [...prev, { name: tracker, id: tracker, connection_mode, tracker_type }];
		});
	});
}

async function disconnectNotification() {
	return await listen("disconnect", (event) => {
		const payload = event.payload as { tracker: string; connection_mode: string; tracker_type: string };
		const tracker = payload.tracker;
		const connection_mode = payload.connection_mode;
		const tracker_type = payload.tracker_type;

		console.log(
			`Tracker disconnected: ${tracker}, connection mode: ${connection_mode}, tracker type: ${tracker_type}`,
		);
	});
}
