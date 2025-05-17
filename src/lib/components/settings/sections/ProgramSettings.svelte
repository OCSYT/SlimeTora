<script lang="ts">
	import { program } from "$lib/store/settings";
	import Icon from "@iconify/svelte";
	import Checkbox from "$lib/components/settings/Checkbox.svelte";
	import Input from "$lib/components/settings/Input.svelte";
	import Select from "$lib/components/settings/Select.svelte";
	import Tooltip from "$lib/components/settings/Tooltip.svelte";
	import { t } from "$lib/lang";

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
			updateChannel,
		}));
	});
</script>
<!-- TODO: fix reloading default to stable even if we load beta from config (only happens when ctrl+r on page) -->
<div class="bg-panel rounded-lg p-6 shadow">
	<h2 class="text-2xl font-heading mb-6 flex items-center gap-2">
		<Icon icon="ri:settings-4-line" class="text-secondary" width={28} />
		{$t("settings.program.title")}
	</h2>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
		<div class="flex flex-col gap-4">
			<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
				{$t("settings.program.app_behavior.name")}
				<Tooltip
					content={$t("settings.program.app_behavior.tooltip")}
					icon="ri:information-line"
					position="up"
					width="200px"
				/>
			</h3>
			<div class="flex flex-col gap-3 pl-1">
				<Checkbox
					label={$t("settings.program.start_connection.name")}
					bind:checked={autoStart}
					onChange={(value) => (autoStart = value)}
				/>
				<Checkbox
					label={$t("settings.program.turn_off_trackers.name")}
					bind:checked={autoOff}
					onChange={(value) => (autoOff = value)}
				/>
			</div>
			<div>
				<Input
					label={$t("settings.program.visualization_fps.name")}
					type="number"
					value={visualizationFPS}
					onChange={(value) => (visualizationFPS = Number(value))}
					icon="ri:timer-line"
					tooltip={$t("settings.program.visualization_fps.tooltip")}
					tooltipPosition="up"
					tooltipWidth="250px"
				/>
			</div>
		</div>

		<div class="flex flex-col gap-4">
			<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
				{$t("settings.program.update_settings.name")}
				<Tooltip
					content={$t("settings.program.update_settings.tooltip")}
					icon="ri:information-line"
					position="up"
					width="220px"
				/>
			</h3>
			<div class="flex flex-col gap-3 pl-1">
				<Checkbox
					label={$t("settings.program.update_settings.app")}
					bind:checked={appUpdates}
					onChange={(value) => (appUpdates = value)}
				/>
				<Checkbox
					label={$t("settings.program.update_settings.language")}
					bind:checked={languageUpdates}
					onChange={(value) => (languageUpdates = value)}
				/>
			</div>
			<Select
				label={$t("settings.program.update_settings.channel.name")}
				options={[
					{ value: "stable", label: $t("settings.program.update_settings.channel.stable") },
					{ value: "beta", label: $t("settings.program.update_settings.channel.beta") },
				]}
				selected={updateChannel}
				onChange={(value) => (updateChannel = value)}
				tooltip={$t("settings.program.update_settings.channel.tooltip")}
				tooltipPosition="up"
				tooltipWidth="250px"
			/>
		</div>
	</div>
</div>
