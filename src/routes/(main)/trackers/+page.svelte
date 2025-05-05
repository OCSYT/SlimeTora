<script lang="ts">
	import Button from "$lib/components/settings/Button.svelte";
	import Switch from "$lib/components/settings/Switch.svelte";
	import Card from "$lib/components/trackers/Card.svelte";
	import { info } from "$lib/log";
	import { trackers } from "$lib/store";

	let preciseData = $state(false);
	let showVisualization = $state(false);
</script>

<div class="flex flex-col p-4">
	{#if $trackers.length === 0}
		<div class="text-center bg-panel rounded-lg py-8">No trackers found! Maybe connect some :)</div>
	{:else}
		<div class="flex flex-row gap-x-4">
			<div class="flex flex-col gap-y-4 flex-1" id="left-column">
				{#each $trackers.filter((_, i) => i % 2 === 0) as tracker}
					<Card name={tracker.name} id={tracker.id} type={tracker.tracker_type} />
				{/each}
			</div>
			<div class="flex flex-col gap-y-4 flex-1" id="right-column">
				{#each $trackers.filter((_, i) => i % 2 === 1) as tracker}
					<Card name={tracker.name} id={tracker.id} type={tracker.tracker_type} />
				{/each}
			</div>
		</div>
	{/if}

	<div class="bg-panel w-full mt-8 p-6 rounded-lg shadow">
		<h2 class="text-lg font-semibold mb-4">Settings</h2>
		<div class="flex flex-row gap-4">
			<div class="flex flex-col gap-4 flex-1">
				<Switch label="Precise data" selected={preciseData} onChange={(value) => (preciseData = value)} />
				<Switch
					label="Show tracker visualization"
					selected={showVisualization}
					onChange={(value) => (showVisualization = value)}
				/>
				<Button
					label="Collapse/expand all trackers"
					onClick={() => {
						// TODO: implement collapse all trackers
						info("Collapsing/expanding all trackers");
					}}
				/>
			</div>
		</div>
	</div>
</div>
