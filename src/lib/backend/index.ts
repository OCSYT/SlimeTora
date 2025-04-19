import { invoke } from "@tauri-apps/api/core";
import { activeModes, settings } from "$lib/store";
import { get } from "svelte/store";
import { ConnectionMode } from "$lib/types/connection";
import { TrackerModel } from "$lib/types/tracker";
import { Notification, Notifications, type NotificationType } from "./notifications";

let notification: Notification | null = null;

export async function startInterpreting() {
	if (!notification) notification = new Notification();

	const modes = get(settings.connection).modes as ConnectionMode[];
	const models = get(settings.connection).models as TrackerModel[];
	const ports = get(settings.connection).ports as string[];

	if (modes.length === 0 || !models) {
		return console.error("No modes or model selected for connection");
	}

	if (modes.includes(ConnectionMode.Serial) && ports.length === 0) {
		return console.error("No ports selected for serial connection");
	}

	console.log(`Starting interpreting with modes: ${modes}, models: ${models}, ports: ${ports}`);

	for (const model of models) {
		invoke("start", { model, modes, ports });
	}
	activeModes.set(modes);

	for (const notif of Notifications) {
		notification.start(notif);
	}

	console.log(`Active notifications started: ${notification.getActiveNotifications().join(", ")}`);
}

export function stopInterpreting() {
	const models = get(settings.connection).models as TrackerModel[];
	const modes = get(activeModes);

	console.log(`Stopping interpreting with modes: ${modes}, model: ${models}`);

	if (modes.length === 0) {
		return console.error("No modes to stop");
	}

	invoke("stop", { models, modes });

	if (notification === null) return console.error("No notification instance to stop");
	let activeNotifications = notification.getActiveNotifications();
	if (activeNotifications.length === 0) return console.error("No active notifications to stop");

	console.log(`Stopping notifications: ${activeNotifications.join(", ")}`);

	for (const notif of activeNotifications) {
		notification.stop(notif);
	}
	notification = null;
}
