import { browser } from "$app/environment";
import { connectedTrackers, getTrackerConfig, saveTrackerConfig, type BatteryData, type TrackerSave } from "$lib/store";
import { ConnectionMode } from "$lib/types/connection";
import { MagStatus, SensorAutoCorrection, type IMUData, type TrackerModel } from "$lib/types/tracker";
import { listen } from "@tauri-apps/api/event";
import { get } from "svelte/store";
import { error, info, warn } from "$lib/log";
import { program } from "$lib/store/settings";
import { invoke } from "@tauri-apps/api/core";

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

		if (!tracker || !data || !rotation || !acceleration || !browser) return;

		const trackerId = tracker.split("-").pop() || tracker;

		const now = Date.now();
		if (!fastData && lastImuUpdate[tracker] && now - lastImuUpdate[tracker] < 50) return;
		lastImuUpdate[trackerId] = now;

		connectedTrackers.update((prev) => {
			const index = prev.findIndex((t) => t.id === trackerId);
			if (index !== -1) {
				const updatedTracker = {
					...prev[index],
					data: {
						...prev[index].data,
						rotation: [rotation.x, rotation.y, rotation.z],
						acceleration: [acceleration.x, acceleration.y, acceleration.z],
					},
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
		const tracker = payload.tracker;
		const data = payload.data;

		if (!tracker || !data || !data.magnetometer || !browser) return;

		const trackerId = tracker.split("-").pop() || tracker;

		// check and only update trackers store if it's changed
		if (!browser) return;
		const currentTrackers = get(connectedTrackers);
		const index = currentTrackers.findIndex((t) => t.id === trackerId);
		if (index !== -1) {
			if (currentTrackers[index].data.magnetometer !== data.magnetometer) {
				connectedTrackers.update((prev) => {
					const updatedTracker = {
						...prev[index],
						data: { ...prev[index].data, magnetometer: data.magnetometer },
					};
					info(
						`Tracker ${tracker} magnetometer status changed: ${prev[index].data.magnetometer} -> ${data.magnetometer}`,
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

		if (!tracker || !data || !browser) return;

		const trackerId = tracker.split("-").pop() || tracker;

		info(`Battery notification received from ${trackerId}: ${JSON.stringify(data)}`);

		if (!browser) return;
		connectedTrackers.update((prev) => {
			const index = prev.findIndex((t) => t.id === trackerId);
			if (index !== -1) {
				let updatedBattery = data;
				// if both remaining and voltage are null, but status is present, keep previous remaining and voltage and update w/ new status
				if (data.remaining == null && data.voltage == null && data.status != null && prev[index].data.battery) {
					updatedBattery = {
						...prev[index].data.battery,
						status: data.status,
					};
				}
				const updatedTracker = { ...prev[index], data: { ...prev[index].data, battery: updatedBattery } };
				return [...prev.slice(0, index), updatedTracker, ...prev.slice(index + 1)];
			}
			return prev;
		});
	});
}

// TODO: allow to be changed (grab from config)
let BUTTON_PRESS_WINDOW_MS = 750;
let BUTTON_DEBOUNCE_MS = 200;

const buttonPressTimestamps: Record<string, number[]> = {};
const lastButtonAction: Record<string, number> = {};
const buttonActionTimeout: Record<string, ReturnType<typeof setTimeout> | null> = {};

async function buttonNotification() {
	return await listen("button", async (event) => {
		const payload = event.payload as { tracker: string; data: { button: string } };
		const tracker = payload.tracker;
		const data = payload.data;

		if (!tracker || !data || !data.button || !browser) return;

		const trackerId = tracker.split("-").pop() || tracker;

		info(`Button notification received from ${trackerId}: ${JSON.stringify(data)}`);

		const now = Date.now();
		if (!buttonPressTimestamps[trackerId]) buttonPressTimestamps[trackerId] = [];
		if (!lastButtonAction[trackerId]) lastButtonAction[trackerId] = 0;

		// debounce
		if (now - lastButtonAction[trackerId] < BUTTON_DEBOUNCE_MS) return;

		buttonPressTimestamps[trackerId].push(now);
		buttonPressTimestamps[trackerId] = buttonPressTimestamps[trackerId].filter(
			(ts) => now - ts <= BUTTON_PRESS_WINDOW_MS,
		);

		if (buttonActionTimeout[trackerId]) clearTimeout(buttonActionTimeout[trackerId]!);

		buttonActionTimeout[trackerId] = setTimeout(async () => {
			const pressCount = buttonPressTimestamps[trackerId].length;
			let action: string | null = null;
			if (pressCount === 1) action = "ResetYaw";
			else if (pressCount === 2) action = "Reset";
			else if (pressCount === 3) action = "ResetMounting";
			else if (pressCount >= 4) action = "PauseTracking";

			if (action) {
				info(`Invoking send_user_action_tauri for ${trackerId} with action: ${action}`);
				await invoke("send_user_action_tauri", { trackerName: trackerId, action });
				lastButtonAction[trackerId] = Date.now();
				buttonPressTimestamps[trackerId] = [];
			}
			buttonActionTimeout[trackerId] = null;
		}, BUTTON_PRESS_WINDOW_MS);
	});
}

async function settingsNotification() {
	return await listen("settings", (event) => {
		const payload = event.payload as { tracker: string; data: { settings: any } };
		const tracker = payload.tracker;
		const data = payload.data;

		if (!tracker || !data || !data.settings || !browser) return;

		const trackerId = tracker.split("-").pop() || tracker;

		info(`Settings notification received from ${trackerId}: ${JSON.stringify(data)}`);
	});
}

/*
 * Tracker management
 */

async function connectNotification() {
	return await listen("connect", async (event) => {
		const payload = event.payload as {
			tracker: string;
			connection_mode: ConnectionMode;
			tracker_type: TrackerModel;
			data: { assignment: string };
		};
		const tracker = payload.tracker;
		const connection_mode = payload.connection_mode;
		const tracker_type = payload.tracker_type;
		const assignment = payload.data.assignment;

		if (!tracker || !connection_mode || !tracker_type || !assignment || !browser) return;

		const trackerId = tracker.split("-").pop() || tracker;

		info(`Tracker connected: ${trackerId} (${assignment}, ${tracker_type}), connection mode: ${connection_mode}`);

		// load settings
		let newTracker = await getTrackerConfig(trackerId);
		if (!newTracker) {
			newTracker = {
				name: connection_mode === ConnectionMode.BLE ? trackerId : assignment,
				id: trackerId,
				connection_mode: connection_mode as ConnectionMode,
				tracker_type: tracker_type as TrackerModel,
				settings: {
					fps: 50,
					mode: 1,
					dynamicCalibration: [SensorAutoCorrection.Accel],
					emulatedFeet: false,
				},
			};

			info(`No existing config found for tracker ${trackerId}, creating new one`);
		} else if (!newTracker.settings) {
			newTracker.settings = {
				fps: 50,
				mode: 1,
				dynamicCalibration: [SensorAutoCorrection.Accel],
				emulatedFeet: false,
			};
			info(`Tracker ${trackerId} config found, but no settings - should use global settings`);
		} else {
			info(`Tracker ${trackerId} config found, using existing settings`);
			info(`Tracker settings: ${JSON.stringify(newTracker.settings, null, 2)}`);
		}

		saveTrackerConfig(newTracker);

		if (!browser) return;
		// TODO: get tracker name from config if available
		connectedTrackers.update((prev) => {
			const index = prev.findIndex((t) => t.id === newTracker.id);
			const trackerData = {
				...newTracker,
				data: {
					rotation: [0, 0, 0],
					acceleration: [0, 0, 0],
				},
			};
			if (index !== -1) {
				return [...prev.slice(0, index), trackerData, ...prev.slice(index + 1)];
			}
			return [...prev, trackerData];
		});

		const trackerPort = await invoke("get_tracker_port", { trackerName: tracker });
		const trackerPortId = await invoke("get_tracker_id", { trackerName: tracker });
		if (!trackerPort || !trackerPortId) return;
		info(`Tracker port for ${trackerId} is ${trackerPort} (ID: ${trackerPortId})`);

		// Manually request all the info from the trackers
		const initialCommands = ["r0:", "r1:", "r:", "o:"];
		const delayedCommands = ["i:", "i0:", "i1:", "o0:", "o1:", "v0:", "v1:"];

		initialCommands.forEach((cmd) => {
			info(`Sending initial command "${cmd}" to tracker port: ${trackerPort}`);
			invoke("write_serial", {
				portPath: trackerPort,
				data: cmd,
			});
		});

		setTimeout(() => {
			delayedCommands.forEach((cmd) => {
				info(`Sending delayed command "${cmd}" to tracker port: ${trackerPort}`);
				invoke("write_serial", {
					portPath: trackerPort,
					data: cmd,
				});
			});

			// Repeated initial commands just to make sure, lol
			initialCommands.forEach((cmd) => {
				info(`Resending initial command "${cmd}" to tracker port: ${trackerPort}`);
				invoke("write_serial", {
					portPath: trackerPort,
					data: cmd,
				});
			});
		}, 500);
	});
}

async function disconnectNotification() {
	return await listen("disconnect", (event) => {
		const payload = event.payload as { tracker: string; connection_mode: string; tracker_type: string };
		const tracker = payload.tracker;
		const connection_mode = payload.connection_mode;
		const tracker_type = payload.tracker_type;

		if (!tracker || !connection_mode || !tracker_type || !browser) return;

		const trackerId = tracker.split("-").pop() || tracker;

		info(`Tracker disconnected: ${trackerId}, connection mode: ${connection_mode}, tracker type: ${tracker_type}`);
		connectedTrackers.update((prev) => {
			const index = prev.findIndex((t) => t.id === trackerId);
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
		const connection_mode = payload.connection_mode;
		const tracker_type = payload.tracker_type;

		if (!tracker || !connection_mode || !tracker_type || !browser) return;

		const trackerId = tracker.split("-").pop() || tracker;

		connectedTrackers.update((prev) => {
			const index = prev.findIndex((t) => t.id === trackerId);
			if (index !== -1) {
				const updatedTracker = { ...prev[index], data: { ...prev[index].data, rssi: tracker_rssi } };
				return [...prev.slice(0, index), updatedTracker, ...prev.slice(index + 1)];
			}
			return prev;
		});
	});
}
