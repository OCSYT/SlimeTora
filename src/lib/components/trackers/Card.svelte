<script lang="ts">
	import Icon from "@iconify/svelte";
	import { trackers } from "$lib/store";
	import { derived } from "svelte/store";

	let { name, id, type } = $props();
	let isOpen = $state(false);

	const trackerData = derived(trackers, ($trackers) => $trackers.find((t) => t.id === id));

	let batteryPercent = $state(-1);
	let batteryVoltage = $state(-1);
	let magStatus = $state("N/A");

	function magStatusClass(status: string) {
		return `mag-status-${status?.toLowerCase().replace(/\s/g, "_")}`;
	}

	$effect(() => {
		const t = $trackerData;
		if (t) {
			batteryPercent = t.battery?.percentage ?? -1;
			batteryVoltage = t.battery?.voltage ?? -1;
			magStatus = t.magnetometer ?? "N/A";
		}
	});
</script>

<div
	class={`w-[338px] ${isOpen ? "h-auto" : "h-14"} bg-card rounded-xl shadow-card flex flex-col transition-all duration-300 overflow-hidden`}
	id="tracker-card-{id}"
>
	<button class="flex items-center justify-between px-4 h-14 cursor-pointer" onclick={() => (isOpen = !isOpen)}>
		<div>
			<p class="text-md text-left font-body">{name}</p>
			<div class="flex items-center gap-2">
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
			</div>
		</div>
		<div class="flex items-center gap-2">
			{#if isOpen}
				<Icon icon="ri:arrow-up-s-line" width={24} class="text-text-alt" />
			{:else}
				<Icon icon="ri:arrow-down-s-line" width={24} class="text-text-alt" />
			{/if}
		</div>
	</button>

	{#if isOpen}
		<!-- Expanded content -->
		<div class="p-4 bg-panel rounded-lg m-4 mt-[5px] flex flex-col gap-2">
			<p><b>Device:</b> <span id="device-type">{id} ({type})</span></p>
			<p><b>IMU:</b> <span id="imu">0, 0, 0 (0, 0, 0)</span></p>
			<p><b>Battery:</b> <span id="battery-main">{batteryPercent}% ({batteryVoltage}V)</span></p>
			<p id="mag-main" class="flex items-center gap-1">
				<b>Magnetometer Status:</b>
				<Icon
					icon="ri:compass-3-fill"
					width={14}
					class={`!bg-transparent ${magStatusClass(magStatus)}`}
					id="mag-icon"
				/>
				<span class={`!bg-transparent capitalize ${magStatusClass(magStatus)}`} id="mag-text">{magStatus}</span>
			</p>
			<img src="/tracker.png" alt="Tracker" class="mx-auto mt-2" style="width: 150px;" />
		</div>
	{/if}
</div>
