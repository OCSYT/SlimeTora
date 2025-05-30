<script lang="ts">
	import Icon from "@iconify/svelte";
	import { trackerOpenStates, trackers } from "$lib/store";
	import { derived } from "svelte/store";
	import { goto } from "$app/navigation";
	import { info } from "@tauri-apps/plugin-log";
	import { program } from "$lib/store/settings";
	import TrackerVisualization from "./TrackerVisualization.svelte";
	import Tooltip from "../settings/Tooltip.svelte";
	import { t } from "$lib/lang";

	let { name, id, type } = $props();
	let isOpen = $state(false);

	const trackerData = derived(trackers, ($trackers) => $trackers.find((t) => t.id === id));
	let preciseData = $state($program.preciseData);
	let visualization = $state($program.visualization);
	let visualizationFPS = $state($program.visualizationFPS);

	let rotation = $state([0, 0, 0]);
	let acceleration = $state([0, 0, 0]);
	let batteryPercent = $state(-1);
	let batteryVoltage = $state(-1);
	let batteryStatus = $state("discharging");
	let magStatus = $state("N/A");
	let rssi = $state(1);

	function magStatusClass(status: string) {
		return `mag-status-${status?.toLowerCase().replace(/\s/g, "_")}`;
	}

	$effect(() => {
		const t = $trackerData;
		if (t) {
			rotation = t.rotation?.map((v) => Number(v.toFixed(preciseData ? 2 : 0))) ?? [0, 0, 0];
			acceleration = t.acceleration?.map((v) => Number(v.toFixed(preciseData ? 2 : 0))) ?? [0, 0, 0];
			batteryPercent = t.battery?.remaining ?? -1;
			batteryVoltage = t.battery?.voltage ?? -1;
			batteryStatus = t.battery?.status ?? "discharging";
			magStatus = t.magnetometer ?? "N/A";
			rssi = t.rssi ?? 1;
		}
	});

	$effect(() => {
		const p = $program;
		if (p) {
			preciseData = p.preciseData;
			visualization = p.visualization;
			visualizationFPS = p.visualizationFPS;
		}
	});

	$effect(() => {
		const states = $trackerOpenStates;
		if (states) {
			isOpen = states[id] ?? false;
		}
	});

	function toggleOpen() {
		trackerOpenStates.update((states) => ({ ...states, [id]: !isOpen }));
	}
</script>

<div
	class={`w-[338px] h-auto bg-card rounded-xl shadow-card flex flex-col transition-all duration-300 overflow-hidden`}
	id="tracker-card-{id}"
>
	<!-- Unexpanded card info / button -->
	<div
		class="flex items-center justify-between px-4 h-14 hoverable"
		role="button"
		aria-expanded={isOpen}
		tabindex="0"
		onclick={toggleOpen}
		onkeydown={(e) => e.key === "Enter" && toggleOpen()}
	>
		<div>
			<p class="text-left font-body">{name}</p>
			<div class="flex items-center gap-2 text-sm">
				<div class="flex items-center gap-1">
					<Icon icon="ri:battery-fill" width={14} class="text-text-alt" />
					<p class="text-sm text-text-alt" id="battery-small">{batteryPercent}%</p>
				</div>
				<p class="flex items-center gap-1 text-sm text-text-alt" id="mag-small">
					<Icon
						icon="ri:compass-3-fill"
						width={14}
						class={`!bg-transparent ${magStatusClass(magStatus)}`}
						id="mag-icon"
					/>
					<span class={`!bg-transparent capitalize ${magStatusClass(magStatus)}`} id="mag-text"
						>{magStatus}</span
					>
				</p>
				<div class="flex items-center gap-1" id="rssi-status">
					<Icon icon="ri:signal-wifi-fill" width={14} class="text-text-alt" />
					<span class="text-text-alt" id="rssi">-{rssi} dBm</span>
				</div>
			</div>
		</div>
		<div class="flex items-center gap-1">
			<button
				class="p-1 rounded-md hover:bg-secondary/20 active:bg-secondary/10"
				aria-label={$t("trackers.card.power_off", { name })}
				onclick={(e) => {
					e.stopPropagation();
					info(`Powered off tracker: ${name} (${id})`);
				}}
			>
				<Icon icon="ri:shut-down-line" width={18} class="text-text-alt" />
			</button>
			<button
				class="p-1 rounded-md hover:bg-secondary/20 active:bg-secondary/10"
				aria-label={$t("trackers.card.settings", { name })}
				onclick={(e) => {
					e.stopPropagation();
					info(`Settings clicked for: ${name}`);
					goto(`/trackers/settings?trackerId=${id}`);
				}}
			>
				<Icon icon="ri:settings-3-line" width={18} class="text-text-alt" />
			</button>
			{#if isOpen}
				<Icon icon="ri:arrow-up-s-line" width={24} class="text-text-alt" />
			{:else}
				<Icon icon="ri:arrow-down-s-line" width={24} class="text-text-alt" />
			{/if}
		</div>
	</div>

	{#if isOpen}
		<!-- Expanded content -->
		<div class="p-4 bg-panel rounded-lg m-4 mt-0 flex flex-col gap-2">
			<p><b>{$t("trackers.card.device")}</b> <span id="device-type">{id} ({type})</span></p>
			<p>
				<b>{$t("trackers.card.imu")}</b> <span id="imu">{rotation.join(", ")} ({acceleration.join(", ")})</span>
			</p>
			<p class="flex flex-row items-center">
				<b>{$t("trackers.card.battery")}</b>
				<span class="flex flex-row items-center justify-center gap-1 ml-1" id="battery-main">
					<span>{batteryPercent}% ({batteryVoltage / 1000}V)</span>
					{#if batteryStatus === "Charging"}
						<Icon icon="ri:flashlight-fill" width={16} class="text-yellow-500 inline-block ml-1" />
					{/if}
				</span>
			</p>
			<div id="status" class="flex items-center text-center gap-1">
				<b>{$t("trackers.card.status.text")}</b>
				<div class="flex items-center gap-2" id="battery-status">
					<div class="flex items-center gap-1" id="mag-status">
						<Tooltip content={$t("trackers.card.tooltip.mag_status")} position="up" width="200px">
							<Icon
								icon="ri:compass-3-fill"
								width={16}
								class={`!bg-transparent ${magStatusClass(magStatus)}`}
								id="mag-icon"
							/>
						</Tooltip>
						<span class={`!bg-transparent capitalize ${magStatusClass(magStatus)}`} id="mag-text">
							{magStatus === "N/A"
								? $t("trackers.card.status.unknown")
								: $t(`trackers.card.status.${magStatus}`)}
						</span>
					</div>
					<div class="flex items-center gap-1" id="rssi-status">
						<Tooltip content={$t("trackers.card.tooltip.rssi")} position="up" width="200px">
							<Icon icon="ri:signal-wifi-fill" width={16} class="text-text-alt" />
						</Tooltip>
						<span class="text-text-alt" id="rssi">-{rssi} dBm</span>
					</div>
				</div>
			</div>

			{#if visualization}
				<TrackerVisualization {rotation} {acceleration} fps={visualizationFPS} />
			{:else}
				<!-- <img src="/tracker.png" alt="Tracker" class="mx-auto mt-2" style="width: 150px;" /> -->
				<!-- TODO: maybe a fallback? like an image of the tracker? -->
			{/if}
		</div>
	{/if}
</div>
