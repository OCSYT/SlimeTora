import { invoke } from "@tauri-apps/api/core";
import { activeModes, settings } from "$lib/store";
import { get } from "svelte/store";
import { ConnectionMode } from "$lib/types/connection";
import { TrackerModel } from "$lib/types/tracker";
import { Notification, Notifications } from "./notifications";
import { info, error } from "$lib/log";

let notification: Notification | null = null;

export async function startInterpreting() {
	if (!notification) notification = new Notification();

	const modes = get(settings.connection).modes as ConnectionMode[];
	const models = get(settings.connection).models as TrackerModel[];
	const ports = get(settings.connection).ports as string[];

	if (modes.length === 0 || !models) {
		return error("No modes or model selected for connection");
	}

	if (modes.includes(ConnectionMode.Serial) && ports.length === 0) {
		return error("No ports selected for serial connection");
	}

	info(`Starting interpreting with modes: ${modes}, models: ${models}, ports: ${ports}`);

	for (const model of models) {
		await invoke("start", { model, modes, ports });
	}
	activeModes.set(modes);

	for (const notif of Notifications) {
		await notification.start(notif);
	}

	let activeNotifications = notification.getActiveNotifications();
	info(`Active notifications started: ${activeNotifications.join(", ")}`);
}

export async function stopInterpreting() {
	const models = get(settings.connection).models as TrackerModel[];
	const modes = get(activeModes);

	info(`Stopping interpreting with modes: ${modes}, model: ${models}`);

	if (modes.length === 0) {
		return error("No modes to stop");
	}

	await invoke("stop", { models, modes });

	if (notification === null) return error("No notification instance to stop");
	let activeNotifications = notification.getActiveNotifications();
	if (activeNotifications.length === 0) return error("No active notifications to stop");

	info(`Stopping notifications: ${activeNotifications.join(", ")}`);

	for (const notif of activeNotifications) {
		notification.stop(notif);
	}
	notification = null;
}
