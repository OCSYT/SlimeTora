import { browser } from "$app/environment";
import { trackers, type BatteryData } from "$lib/store";
import type { ConnectionMode } from "$lib/types/connection";
import { MagStatus, type IMUData, type TrackerModel } from "$lib/types/tracker";
import { listen } from "@tauri-apps/api/event";
import { get } from "svelte/store";
import { error, info, warn } from "$lib/log";
import { program } from "$lib/store/settings";

export const Notifications = [
	"imu",
	"mag",
	"info",
	"connection",
	"button",
	"battery",
	"settings",
	"connect",
	"disconnect",
	"paired",
	"unpaired",
] as const;
export type NotificationType = (typeof Notifications)[number];

let fastData = get(program).fastData;
program.subscribe((value) => {
	fastData = value.fastData;
});

export class Notification {
	private activeNotifications = new Map<NotificationType, Function>();

	async start(type: NotificationType) {
		if (this.activeNotifications.has(type)) {
			warn(`Already listening to "${type}" notifications`);
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
			case "connection":
				unlisten = await connectionNotification();
				break;
			default:
				error(`No notification type "${type}" available`);
				return;
		}

		if (unlisten) this.activeNotifications.set(type, unlisten);
	}

	stop(type: NotificationType) {
		if (!this.activeNotifications.has(type)) {
			warn(`Not listening to "${type}" notifications`);
			return;
		}

		const unlisten = this.activeNotifications.get(type);
		if (unlisten) unlisten();
		this.activeNotifications.delete(type);
		info(`Stopped listening to "${type}" notifications`);
	}

	getActiveNotifications() {
		return Array.from(this.activeNotifications.keys()) as NotificationType[];
	}

	clearAllNotifications() {
		this.activeNotifications.forEach((unlisten) => unlisten());
		this.activeNotifications.clear();
		info(`Stopped listening to all notifications`);
	}
}

const lastImuUpdate: Record<string, number> = {};
async function imuNotification() {
	return await listen("imu", (event) => {
		const payload = event.payload as IMUData;
		const tracker = payload.tracker;
		const data = payload.data as { rotation: any; acceleration: any };
		const { rotation, acceleration } = data;

		if (!browser) return;
		const now = Date.now();
		if (!fastData && lastImuUpdate[tracker] && now - lastImuUpdate[tracker] < 50) return;
		lastImuUpdate[tracker] = now;

		trackers.update((prev) => {
			const index = prev.findIndex((t) => t.id === tracker);
			if (index !== -1) {
				const updatedTracker = {
					...prev[index],
					rotation: [rotation.x, rotation.y, rotation.z],
					acceleration: [acceleration.x, acceleration.y, acceleration.z],
				};
				return [...prev.slice(0, index), updatedTracker, ...prev.slice(index + 1)];
			} else {
				return prev;
			}
		});
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
		const trackerId = payload.tracker;
		const data = payload.data;

		if (!data || !data.magnetometer) {
			return;
		}

		// check and only update trackers store if it's changed
		if (!browser) return;
		const currentTrackers = get(trackers);
		const index = currentTrackers.findIndex((t) => t.id === trackerId);
		if (index !== -1) {
			if (currentTrackers[index].magnetometer !== data.magnetometer) {
				trackers.update((prev) => {
					const updatedTracker = { ...prev[index], magnetometer: data.magnetometer };
					info(
						`Tracker ${trackerId} magnetometer status changed: ${prev[index].magnetometer} -> ${data.magnetometer}`,
					);
					return [...prev.slice(0, index), updatedTracker, ...prev.slice(index + 1)];
				});
			}
		}
	});
}

async function batteryNotification() {
	return await listen("battery", (event) => {
		const payload = event.payload as {
			tracker: string;
			data: BatteryData;
		};
		const tracker = payload.tracker;
		const data = payload.data;

		info(`Battery notification received from ${tracker}: ${JSON.stringify(data)}`);

		if (!browser) return;
		trackers.update((prev) => {
			const index = prev.findIndex((t) => t.id === tracker);
			if (index !== -1) {
				const updatedTracker = { ...prev[index], battery: data };
				return [...prev.slice(0, index), updatedTracker, ...prev.slice(index + 1)];
			}
			return prev;
		});
	});
}

async function buttonNotification() {
	return await listen("button", (event) => {
		const payload = event.payload as { tracker: string; data: { button: string } };
		const tracker = payload.tracker;
		const data = payload.data;

		info(`Button notification received from ${tracker}: ${JSON.stringify(data)}`);
	});
}

async function settingsNotification() {
	return await listen("settings", (event) => {
		const payload = event.payload as { tracker: string; data: { settings: any } };
		const tracker = payload.tracker;
		const data = payload.data;

		info(`Settings notification received from ${tracker}: ${JSON.stringify(data)}`);
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

		info(`Tracker connected: ${tracker}, connection mode: ${connection_mode}, tracker type: ${tracker_type}`);

		if (!browser) return;
		// TODO: get tracker name from config if available
		trackers.update((prev) => {
			return [
				...prev,
				{
					name: tracker,
					id: tracker,
					connection_mode,
					tracker_type,
					rotation: [0, 0, 0],
					acceleration: [0, 0, 0],
				},
			];
		});
	});
}

async function disconnectNotification() {
	return await listen("disconnect", (event) => {
		const payload = event.payload as { tracker: string; connection_mode: string; tracker_type: string };
		const tracker = payload.tracker;
		const connection_mode = payload.connection_mode;
		const tracker_type = payload.tracker_type;

		info(`Tracker disconnected: ${tracker}, connection mode: ${connection_mode}, tracker type: ${tracker_type}`);
		if (!browser) return;
		trackers.update((prev) => {
			const index = prev.findIndex((t) => t.id === tracker);
			if (index !== -1) {
				return [...prev.slice(0, index), ...prev.slice(index + 1)];
			} else {
				return prev;
			}
		});
	});
}

async function connectionNotification() {
	return await listen("connection", (event) => {
		const payload = event.payload as {
			tracker: string;
			connection_mode: string;
			tracker_type: string;
			data: { dongle_rssi: number; tracker_rssi: number };
		};
		const tracker = payload.tracker;
		//const dongle_rssi = payload.data.dongle_rssi;
		const tracker_rssi = payload.data.tracker_rssi;

		if (!browser) return;
		trackers.update((prev) => {
			const index = prev.findIndex((t) => t.id === tracker);
			if (index !== -1) {
				const updatedTracker = { ...prev[index], rssi: tracker_rssi };
				return [...prev.slice(0, index), updatedTracker, ...prev.slice(index + 1)];
			} else {
				warn(`Tracker with id ${tracker} not found in store`);
				return prev;
			}
		});
	});
}
