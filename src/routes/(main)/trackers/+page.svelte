<script lang="ts">
	import { goto } from "$app/navigation";
	import Button from "$lib/components/settings/Button.svelte";
	import Switch from "$lib/components/settings/Switch.svelte";
	import Card from "$lib/components/trackers/Card.svelte";
	import { t } from "$lib/lang";
	import { trackerOpenStates, trackers } from "$lib/store";
	import { program } from "$lib/store/settings";

	let preciseData = $state($program.preciseData);
	let fastData = $state($program.fastData);
	let visualization = $state($program.visualization);

	function toggleTrackers() {
		let anyOpen = Object.values($trackerOpenStates).some((isOpen) => isOpen);

		trackerOpenStates.update((states: any) => {
			const newStates = { ...states };
			for (const id in newStates) {
				newStates[id] = anyOpen ? false : true;
			}
			return newStates;
		});

		setTimeout(() => {
			window.scrollTo({
				top: document.body.scrollHeight,
				behavior: "instant",
			});
		}, 0);
	}

	$effect(() => {
		program.update((prev) => ({
			...prev,
			preciseData,
			fastData,
			visualization,
		}));
	});
</script>

<div class="flex flex-col p-4">
	{#if $trackers.length === 0}
		<div class="text-center bg-panel rounded-lg py-8">{$t("trackers.none")}</div>
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
		<h2 class="text-lg font-semibold mb-4">{$t("trackers.settings.title")}</h2>
		<div class="flex flex-row gap-4">
			<div class="flex flex-col gap-4 flex-1">
				<div class="flex flex-row gap-2">
					<Button label={$t("trackers.settings.collapse_expand")} onClick={() => toggleTrackers()} />
					<Button label={$t("trackers.settings.pairing")} onClick={() => goto("/trackers/pairing")} />
				</div>
				<div class="flex flex-row items-center justify-evenly gap-2">
					<Switch
						label={$t("trackers.settings.precise_data")}
						selected={preciseData}
						onChange={(value) => (preciseData = value)}
					/>
					<Switch
						label={$t("trackers.settings.fast_data")}
						selected={fastData}
						onChange={(value) => (fastData = value)}
					/>
					<Switch
						label="Show tracker visualization"
						selected={visualization}
						onChange={(value) => (visualization = value)}
					/>
				</div>
			</div>
		</div>
	</div>
</div>
