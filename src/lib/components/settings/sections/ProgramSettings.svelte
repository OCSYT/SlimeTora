<script lang="ts">
	import { program } from "$lib/store/settings";
	import Icon from "@iconify/svelte";
	import Checkbox from "$lib/components/settings/Checkbox.svelte";
	import Input from "$lib/components/settings/Input.svelte";
	import Select from "$lib/components/settings/Select.svelte";

	let autoStart = $state($program.autoStart);
	let autoOff = $state($program.autoOff);
	let visualizationFPS = $state($program.visualizationFPS);
	let appUpdates = $state($program.checkUpdatesApp);
	let languageUpdates = $state($program.checkUpdatesLanguage);
	let updateChannel = $state($program.updateChannel);

	$effect(() => {
		program.update((prev) => ({
			...prev,
			autoStart,
			autoOff,
			visualizationFPS,
			checkUpdatesApp: appUpdates,
			checkUpdatesLanguage: languageUpdates,
			updateChannel
		}));
	});
</script>

<div class="bg-panel rounded-lg p-6 shadow">
	<h2 class="text-2xl font-heading mb-6 flex items-center gap-2">
		<Icon icon="ri:settings-4-line" class="text-secondary" width={28} />
		Program Settings
	</h2>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
		<div class="flex flex-col gap-4">
			<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
				App Behavior
				<Icon icon="ri:information-line" width={20} class="text-text-alt hover:text-white transition-colors" />
			</h3>
			<div class="flex flex-col gap-3 pl-1">
				<Checkbox
					label="Start connection on open"
					bind:checked={autoStart}
					onChange={(value) => (autoStart = value)}
				/>
				<Checkbox
					label="Turn off trackers on exit"
					bind:checked={autoOff}
					onChange={(value) => (autoOff = value)}
				/>
			</div>
			<div>
				<Input
					label="Tracker Visualization FPS"
					type="number"
					value={visualizationFPS}
					onChange={(value) => (visualizationFPS = Number(value))}
					icon="ri:timer-line"
				/>
			</div>
		</div>

		<div class="flex flex-col gap-4">
			<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
				Update Settings
				<Icon icon="ri:information-line" width={20} class="text-text-alt hover:text-white transition-colors" />
			</h3>
			<div class="flex flex-col gap-3 pl-1">
				<div class="flex flex-col gap-3 pl-1">
					<Checkbox
						label="App updates"
						bind:checked={appUpdates}
						onChange={(value) => (appUpdates = value)}
					/>
					<Checkbox
						label="Language updates"
						bind:checked={languageUpdates}
						onChange={(value) => (languageUpdates = value)}
					/>
				</div>
				<Select
					label="Update Channel"
					options={[
						{ value: "stable", label: "Stable" },
						{ value: "beta", label: "Beta" },
					]}
					selected={updateChannel}
					onChange={(value) => (updateChannel = value)}
				/>
			</div>
		</div>
	</div>
</div>
