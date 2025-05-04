<script lang="ts">
	import Icon from "@iconify/svelte";
	import { trackerOpenStates, trackers } from "$lib/store";
	import { derived } from "svelte/store";
	import { goto } from "$app/navigation";
	import Button from "../settings/Button.svelte";

	let { name, id, type } = $props();
	let isOpen = $state(false);

	const trackerData = derived(trackers, ($trackers) => $trackers.find((t) => t.id === id));

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
			// TODO: implement precise data option (2dp)
			rotation = t.rotation?.map((v) => Number(v.toFixed(0))) ?? [0, 0, 0];
			acceleration = t.acceleration?.map((v) => Number(v.toFixed(0))) ?? [0, 0, 0];
			batteryPercent = t.battery?.remaining ?? -1;
			batteryVoltage = t.battery?.voltage ?? -1;
			batteryStatus = t.battery?.status ?? "discharging";
			magStatus = t.magnetometer ?? "N/A";
			rssi = t.rssi ?? 1;
		}

		isOpen = $trackerOpenStates[id] ?? false;
	});

	function toggleOpen() {
		trackerOpenStates.update((states) => ({ ...states, [id]: !isOpen }));
	}
</script>

<div
	class={`w-[338px] ${isOpen ? "h-auto" : "h-14"} bg-card rounded-xl shadow-card flex flex-col transition-all duration-300 overflow-hidden`}
	id="tracker-card-{id}"
	role="button"
	aria-expanded={isOpen}
	tabindex="0"
	onclick={toggleOpen}
	onkeydown={(e) => e.key === "Enter" && toggleOpen()}
>
	<!-- Unexpanded card info / button -->
	<div class="flex items-center justify-between px-4 h-14 hoverable">
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
		<div class="flex items-center gap-2">
			<button
				class="p-1 rounded-md hover:bg-secondary/20 active:bg-secondary/10"
				aria-label="Power off tracker: {name}"
				onclick={(e) => {
					e.stopPropagation();
					console.log(`Powered off tracker: ${name} (${id})`);
				}}
			>
				<Icon icon="ri:shut-down-line" width={24} class="text-text-alt" />
			</button>
			<button
				class="p-1 rounded-md hover:bg-secondary/20 active:bg-secondary/10"
				aria-label="Open tracker settings for: {name}"
				onclick={(e) => {
					e.stopPropagation();
					console.log(`Settings clicked for: ${name}`);
					goto(`/trackers/settings?trackerId=${id}`);
				}}
			>
				<Icon icon="ri:settings-3-line" width={24} class="text-text-alt" />
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
		<div class="p-4 bg-panel rounded-lg m-4 mt-[5px] flex flex-col gap-2">
			<p><b>Device:</b> <span id="device-type">{id} ({type})</span></p>
			<p><b>IMU:</b> <span id="imu">{rotation.join(", ")} ({acceleration.join(", ")})</span></p>
			<p class="flex flex-row items-center">
				<b>Battery:</b>
				<span class="flex flex-row items-center justify-center gap-1 ml-1" id="battery-main">
					<span>{batteryPercent}% ({batteryVoltage / 1000}V)</span>
					{#if batteryStatus === "charging"}
						<Icon icon="ri:flashlight-fill" width={16} class="text-yellow-500 inline-block ml-1" />
					{/if}
				</span>
			</p>
			<!-- TODO: add tooltip when hovering statuses (mag/rssi) -->
			<div id="status" class="flex items-center text-center gap-1">
				<b>Status:</b>
				<div class="flex items-center gap-2" id="battery-status">
					<div class="flex items-center gap-1" id="mag-status">
						<Icon
							icon="ri:compass-3-fill"
							width={16}
							class={`!bg-transparent ${magStatusClass(magStatus)}`}
							id="mag-icon"
						/>
						<span class={`!bg-transparent capitalize ${magStatusClass(magStatus)}`} id="mag-text"
							>{magStatus}</span
						>
					</div>
					<div class="flex items-center gap-1" id="rssi-status">
						<Icon icon="ri:signal-wifi-fill" width={16} class="text-text-alt" />
						<span class="text-text-alt" id="rssi">-{rssi} dBm</span>
					</div>
				</div>
			</div>
			<img src="/tracker.png" alt="Tracker" class="mx-auto mt-2" style="width: 150px;" />
			<!-- <hr class="border-t border-border my-2" />
			<div class="flex flex-row justify-end gap-2 mt-4">
				<Button
					label="Settings"
					icon="ri:settings-3-line"
					background="tertiary"
					onClick={() => {
						console.log(`Settings clicked for: ${name}`);
						goto(`/trackers/settings?trackerId=${id}`);
					}}
				/>

				<Button
					label="Power Off"
					icon="ri:shut-down-line"
					background="danger"
					onClick={() => {
						console.log(`Powering off tracker: ${name}`);
					}}
				/>
			</div> -->
		</div>
	{/if}
</div>
