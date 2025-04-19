import type { IMUData } from "$lib/types/tracker";
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
		const data = payload.data as { rotation: any; acceleration: any };
		const trackerName = payload.tracker;
		const { rotation, acceleration } = data;

		console.log(`IMU notification received from ${trackerName}: ${JSON.stringify({ rotation, acceleration })}`);
	});
}

async function magNotification() {
	return await listen("mag", (event) => {
		const payload = event.payload as { tracker: string; data: { magnetometer: any } };
		const tracker = payload.tracker;
		const data = payload.data;

		console.log(`Mag notification received from ${tracker}: ${JSON.stringify(data)}`);
	});
}
