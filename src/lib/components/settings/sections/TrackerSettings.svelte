<script lang="ts">
	import { tracker } from "$lib/store/settings";
	import { SensorAutoCorrection, FPSMode, SensorMode } from "$lib/types/tracker";
	import Switch from "$lib/components/settings/Switch.svelte";
	import Input from "$lib/components/settings/Input.svelte";
	import Select from "$lib/components/settings/Select.svelte";
	import Icon from "@iconify/svelte";
	import Tooltip from "../Tooltip.svelte";
	import { t } from "$lib/lang";

	let fps = $state($tracker.fps === FPSMode.Mode100 ? "100" : "50");
	let sensorMode = $state($tracker.mode === SensorMode.MagEnabled ? "1" : "2");
	let heartbeat = $state($tracker.heartbeat);
	let buttonDebounce = $state($tracker.buttonDebounce);
	let sensorCorrections = $state({
		accelerometer: $tracker.dynamicCalibration.includes(SensorAutoCorrection.Accel),
		gyroscope: $tracker.dynamicCalibration.includes(SensorAutoCorrection.Gyro),
		magnetometer: $tracker.dynamicCalibration.includes(SensorAutoCorrection.Mag),
	});
	let emulatedFeet = $state($tracker.emulatedFeet);

	$effect(() => {
		const calibrations: SensorAutoCorrection[] = [];
		if (sensorCorrections.accelerometer) calibrations.push(SensorAutoCorrection.Accel);
		if (sensorCorrections.gyroscope) calibrations.push(SensorAutoCorrection.Gyro);
		if (sensorCorrections.magnetometer) calibrations.push(SensorAutoCorrection.Mag);

		tracker.update((prev) => ({
			...prev,
			fps: fps === "50" ? FPSMode.Mode50 : FPSMode.Mode100,
			mode: sensorMode === "1" ? SensorMode.MagEnabled : SensorMode.MagDisabled,
			dynamicCalibration: calibrations,
			heartbeat,
			buttonDebounce,
		}));
	});
</script>

<div class="bg-panel rounded-lg p-6 shadow">
	<h2 class="text-2xl font-heading mb-6 flex items-center gap-2">
		<Icon icon="ri:compass-3-line" class="text-secondary" width={28} />
		{$t("settings.tracker.title")}
	</h2>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
		<div class="flex flex-col gap-4">
			<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
				{$t("settings.tracker.fps.name")}
				<Tooltip
					content={$t("settings.tracker.fps.tooltip")}
					icon="ri:information-line"
					position="up"
					width="300px"
				/>
			</h3>
			<Select
				options={[
					{ value: "50", label: $t("settings.tracker.fps.50") },
					{ value: "100", label: $t("settings.tracker.fps.100") },
				]}
				selected={fps}
				onChange={(value) => (fps = value)}
			/>
		</div>

		<div class="flex flex-col gap-4">
			<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
				{$t("settings.tracker.sensor_mode.name")}
				<Tooltip
					content={$t("settings.tracker.sensor_mode.tooltip")}
					icon="ri:information-line"
					position="up"
					width="300px"
				/>
			</h3>
			<Select
				options={[
					{ value: "2", label: $t("settings.tracker.sensor_mode.2") },
					{ value: "1", label: $t("settings.tracker.sensor_mode.1") },
				]}
				selected={sensorMode}
				onChange={(value) => (sensorMode = value)}
			/>
		</div>

		<div class="flex flex-col gap-4">
			<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
				{$t("settings.tracker.sensor_auto_correction.name")}
				<Tooltip
					content={$t("settings.tracker.sensor_auto_correction.tooltip")}
					icon="ri:information-line"
					position="up"
					width="300px"
				/>
			</h3>

			<div class="flex flex-col gap-3 pl-1">
				<Switch
					label="Accelerometer"
					selected={sensorCorrections.accelerometer}
					onChange={(value) => (sensorCorrections.accelerometer = value)}
				/>
				<Switch
					label="Gyroscope"
					selected={sensorCorrections.gyroscope}
					onChange={(value) => (sensorCorrections.gyroscope = value)}
				/>
				<Switch
					label="Magnetometer"
					selected={sensorCorrections.magnetometer}
					onChange={(value) => (sensorCorrections.magnetometer = value)}
				/>
			</div>
		</div>

		<div class="flex flex-col gap-4">
			<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
				{$t("settings.tracker.virtual_feet.name")}
				<Tooltip
					content={$t("settings.tracker.virtual_feet.tooltip")}
					icon="ri:information-line"
					position="up"
					width="250px"
				/>
			</h3>
			<Switch
				label={$t("settings.tracker.virtual_feet.name")}
				selected={emulatedFeet}
				onChange={(value) => (emulatedFeet = value)}
			/>
		</div>

		<div class="col-span-2 flex flex-col gap-4">
			<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
				{$t("settings.tracker.other_settings.name")}
				<Tooltip
					content={$t("settings.tracker.other_settings.tooltip")}
					icon="ri:information-line"
					position="up"
					width="250px"
				/>
			</h3>
			<div class="flex flex-row gap-3 pl-1">
				<Input
					className="flex-1"
					label={$t("settings.tracker.heartbeat.name")}
					type="number"
					value={heartbeat}
					onChange={(value) => (heartbeat = Number(value))}
					icon="ri:heart-pulse-line"
					placeholder="2000"
					tooltip={$t("settings.tracker.heartbeat.tooltip")}
					tooltipPosition="up"
					tooltipWidth="250px"
				/>
				<Input
					className="flex-1"
					label={$t("settings.tracker.button_debounce.name")}
					type="number"
					value={buttonDebounce}
					onChange={(value) => (buttonDebounce = Number(value))}
					icon="ri:timer-line"
					placeholder="500"
					tooltip={$t("settings.tracker.button_debounce.tooltip")}
					tooltipPosition="up"
					tooltipWidth="250px"
				/>
			</div>
		</div>
	</div>
</div>
