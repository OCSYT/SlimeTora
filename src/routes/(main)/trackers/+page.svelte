<script lang="ts">
	import Card from "$lib/components/trackers/Card.svelte";
	import { trackers } from "$lib/store";
</script>

<div class="flex flex-col p-4">
	{#if $trackers.length === 0}
		<div class="text-center bg-panel rounded-lg py-8">No trackers found! Maybe connect some :)</div>
		<Card name="guh" id={1} type="X2" />
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

	<!--  settings panel -->
	<div class="bg-panel w-full mt-8 p-6 rounded-lg shadow">
		<h2 class="text-lg font-semibold mb-4">Settings</h2>
		<div class="flex flex-row gap-4">
			<div class="flex flex-col gap-4 flex-1">
				<label class="flex items-center gap-x-2">
					<input type="checkbox" />
					<span>Precise data</span>
				</label>
                <label class="flex items-center gap-x-2">
                    <input type="checkbox" />
                    <span>Show tracker visualization</span>
                </label>
				<label class="flex items-center gap-x-2">
					<input type="checkbox" />
					<span>Bypass serial limit</span>
				</label>
			</div>
			<div class="flex flex-col gap-4 flex-1">
				<label class="flex items-center gap-x-2">
					<input type="checkbox" />
					<span>Write logs</span>
				</label>
				<label class="flex items-center gap-x-2">
					<span>Logging mode</span>
					<select>
						<option value="minimal">Minimal data</option>
						<option value="debug">Debug data</option>
						<option value="all">All data (!!!)</option>
					</select>
				</label>
			</div>
		</div>
	</div>
</div>
