<script lang="ts">
	import { tracker } from "$lib/store/settings";
	import { SensorAutoCorrection, FPSMode, SensorMode } from "$lib/types/tracker";
	import Switch from "./Switch.svelte";
	import Input from "./Input.svelte";
	import Select from "./Select.svelte";
	import Icon from "@iconify/svelte";

	let fps = $state($tracker.fps === FPSMode.Mode100 ? "100" : "50");
	let sensorMode = $state($tracker.mode === SensorMode.MagEnabled ? "1" : "2");
	let heartbeat = $state($tracker.heartbeat);
	let buttonDebounce = $state($tracker.buttonDebounce);
	let sensorCorrections = $state({
		accelerometer: $tracker.dynamicCalibration.includes(SensorAutoCorrection.Accel),
		gyroscope: $tracker.dynamicCalibration.includes(SensorAutoCorrection.Gyro),
		magnetometer: $tracker.dynamicCalibration.includes(SensorAutoCorrection.Mag),
	});

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
			heartbeatInterval: heartbeat,
			buttonDebounce,
		}));
	});
</script>

<div class="bg-panel rounded-lg p-6 shadow">
	<h2 class="text-2xl font-heading mb-6 flex items-center gap-2">
		<Icon icon="ri:compass-3-line" class="text-secondary" width={28} />
		Tracker Settings
	</h2>

	<div class="flex flex-col gap-4">
		<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50 w-[calc(50%-16px)]">
			Tracker Options
			<Icon icon="ri:information-line" width={20} class="text-text-alt hover:text-white transition-colors" />
		</h3>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
			<div class="col-span-1">
				<Select
					label="FPS Transfer Rate"
					options={[
						{ value: "50", label: "50 FPS" },
						{ value: "100", label: "100 FPS" },
					]}
					selected={fps}
					onChange={(value) => (fps = value)}
				/>
			</div>
			<div class="col-span-1">
				<Select
					label="Sensor Mode"
					options={[
						{ value: "2", label: "Mode 2" },
						{ value: "1", label: "Mode 1" },
					]}
					selected={sensorMode}
					onChange={(value) => (sensorMode = value)}
				/>
			</div>
			<div class="col-span-1">
				<p class="mb-3 font-medium">Sensor Auto Correction</p>
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
			<div class="col-span-1 flex flex-col gap-4">
				<Input
					label="Heartbeat Interval (ms)"
					type="number"
					value={heartbeat}
					onChange={(value) => (heartbeat = Number(value))}
					icon="ri:heart-pulse-line"
					placeholder="2000"
				/>
				<Input
					label="Button Debounce (ms)"
					type="number"
					value={buttonDebounce}
					onChange={(value) => (buttonDebounce = Number(value))}
					icon="ri:timer-line"
					placeholder="500"
				/>
			</div>
		</div>
	</div>
</div>
