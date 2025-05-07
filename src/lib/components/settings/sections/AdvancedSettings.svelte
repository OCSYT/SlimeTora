<script lang="ts">
	import { invoke } from "@tauri-apps/api/core";
	import Icon from "@iconify/svelte";
	import Checkbox from "$lib/components/settings/Checkbox.svelte";
	import Select from "$lib/components/settings/Select.svelte";
	import Button from "$lib/components/settings/Button.svelte";
	import { error } from "$lib/log";
	import { advanced, type LoggingMode } from "$lib/store/settings";
	import Tooltip from "../Tooltip.svelte";

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
		Advanced Settings
	</h2>

	<div class="flex flex-col gap-4">
		<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
			<div class="flex flex-col gap-4">
				<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
					Serial Settings
					<Tooltip
						content="Advanced serial port configurations. Options with yellow text require a restart of the connection or program to apply."
						icon="ri:information-line"
						position="up"
					/>
				</h3>
				<div class="flex flex-col gap-3 pl-1">
					<Checkbox
						label="Bypass serial port limit"
						checked={bypassSerialLimit}
						onChange={(value) => (bypassSerialLimit = value)}
					/>
				</div>
			</div>

			<div class="flex flex-col gap-4">
				<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
					Logging
					<Tooltip
						content="Configure how the application handles logging information. Higher logging levels may impact performance."
						icon="ri:information-line"
						position="up"
					/>
				</h3>
				<div class="flex flex-col gap-3 pl-1">
					<Checkbox label="Write logs" checked={writeLogs} onChange={(value) => (writeLogs = value)} />
					<Select
						label="Logging Mode"
						options={[
							{ value: "minimal", label: "Minimal data" },
							{ value: "debug", label: "Debug data" },
							{ value: "all", label: "All data (!!!)" },
						]}
						selected={loggingMode}
						onChange={(value) => (loggingMode = value as LoggingMode)}
					/>
					<div class="mt-2">
						<Button
							label="Open Logs Folder"
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
