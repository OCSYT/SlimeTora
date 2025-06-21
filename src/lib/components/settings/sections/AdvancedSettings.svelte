<script lang="ts">
	import { invoke } from "@tauri-apps/api/core";
	import Icon from "@iconify/svelte";
	import Checkbox from "$lib/components/settings/Checkbox.svelte";
	import Select from "$lib/components/settings/Select.svelte";
	import Button from "$lib/components/settings/Button.svelte";
	import { error } from "$lib/log";
	import { advanced, type LoggingMode } from "$lib/store/settings";
	import Tooltip from "../Tooltip.svelte";
	import { t } from "$lib/lang";
	import { goto } from "$app/navigation";

	let bypassSerialLimit = $state($advanced.bypassSerialLimit);
	let writeLogs = $state($advanced.writeLogs);
	let loggingMode = $state($advanced.loggingMode) as LoggingMode;

	async function openLogsFolder() {
		try {
			await invoke("open_logs_folder");
		} catch (err) {
			error("Failed to open logs folder:", err);
		}
	}

	$effect(() => {
		advanced.update((settings) => ({
			...settings,
			bypassSerialLimit,
			writeLogs,
			loggingMode,
		}));
	});
</script>

<div class="bg-panel rounded-lg p-6 shadow">
	<h2 class="text-2xl font-heading mb-6 flex items-center gap-2">
		<Icon icon="ri:tools-line" class="text-secondary" width={28} />
		{$t("settings.advanced.title")}
	</h2>

	<div class="flex flex-col gap-4">
		<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
			<div class="flex flex-col gap-4">
				<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
					{$t("settings.advanced.serial_settings.name")}
					<Tooltip
						content={$t("settings.advanced.serial_settings.tooltip")}
						icon="ri:information-line"
						position="up"
					/>
				</h3>
				<div class="flex flex-col gap-3 pl-1">
					<Checkbox
						label={$t("settings.advanced.bypass_serial_limit.name")}
						checked={bypassSerialLimit}
						onChange={(value) => (bypassSerialLimit = value)}
						tooltip={$t("settings.advanced.bypass_serial_limit.tooltip")}
						tooltipPosition="up"
						tooltipWidth="250px"
					/>
				</div>

				<div class="flex flex-row gap-3">
					<Button
						label={$t("home.onboarding")}
						icon="ri:question-answer-line"
						iconPosition="left"
						background="quaternary"
						onClick={() => goto("/onboarding")}
					/>
				</div>
			</div>

			<div class="flex flex-col gap-4">
				<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
					{$t("settings.advanced.logging.name")}
					<Tooltip
						content={$t("settings.advanced.logging.tooltip")}
						icon="ri:information-line"
						position="up"
					/>
				</h3>
				<div class="flex flex-col gap-3 pl-1">
					<Checkbox
						label={$t("settings.advanced.write_logs.name")}
						checked={writeLogs}
						onChange={(value) => (writeLogs = value)}
						tooltip={$t("settings.advanced.write_logs.tooltip")}
						tooltipPosition="up"
						tooltipWidth="250px"
					/>
					<Select
						label={$t("settings.advanced.logging_mode.name")}
						options={[
							{ value: "minimal", label: $t("settings.advanced.logging_mode.minimal") },
							{ value: "debug", label: $t("settings.advanced.logging_mode.debug") },
							{ value: "all", label: $t("settings.advanced.logging_mode.all") },
						]}
						selected={loggingMode}
						onChange={(value) => (loggingMode = value as LoggingMode)}
						tooltip={$t("settings.advanced.logging_mode.tooltip")}
						tooltipPosition="up"
						tooltipWidth="250px"
					/>
					<div class="mt-2">
						<Button
							label={$t("settings.advanced.open_logs_folder.name")}
							icon="ri:folder-open-line"
							iconPosition="left"
							background="quaternary"
							onClick={openLogsFolder}
						/>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
