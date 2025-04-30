<script lang="ts">
	import Icon from "@iconify/svelte";

	let { trackerName, trackerId, batteryLevel } = $props();

	let isOpen = $state(false);
</script>

<div
	class={`w-[338px] ${isOpen ? "h-auto" : "h-14"} bg-card rounded-xl shadow-card flex flex-col transition-all duration-300 overflow-hidden`}
>
	<button class="flex items-center justify-between px-4 h-14" onclick={() => (isOpen = !isOpen)}>
		<div>
			<p class="text-md font-body">{trackerName}</p>
			<div class="flex items-center gap-1">
				<Icon icon="ri:battery-fill" width={14} class="text-text-alt" />
				<p class="text-sm text-text-alt">{batteryLevel}%</p>
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
			<p><b>Device ID:</b> abcxzybeepbooptralalala</p>
            <p><b>IMU Data:</b> 0, 0, 0 (0, 0, 0)</p>
			<p><b>Battery:</b> 80% (0V)</p>
			<p>
				<b>Magnetometer Status:</b>
				<span class="text-red-400 font-bold">Bad</span>
				<span class="inline-block w-2 h-2 bg-red-500 rounded-full ml-1"></span>
			</p>
			<img src="/tracker.png" alt="Tracker" class="mx-auto mt-2" style="width: 150px;" />
		</div>
	{/if}
</div>
