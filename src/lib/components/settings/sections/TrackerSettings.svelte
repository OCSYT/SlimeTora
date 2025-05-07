<script lang="ts">
	import { tracker } from "$lib/store/settings";
	import { SensorAutoCorrection, FPSMode, SensorMode } from "$lib/types/tracker";
	import Switch from "$lib/components/settings/Switch.svelte";
	import Input from "$lib/components/settings/Input.svelte";
	import Select from "$lib/components/settings/Select.svelte";
	import Icon from "@iconify/svelte";
	import Tooltip from "../Tooltip.svelte";

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
		Tracker Settings
	</h2>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
		<div class="flex flex-col gap-4">
			<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
				FPS transfer rate
				<Tooltip
					content="Select how many times the trackers send data per second. 50 FPS may be more stable on Bluetooth and use less battery, but isn't as smooth as 100 FPS."
					icon="ri:information-line"
					position="up"
					width="300px"
				/>
			</h3>
			<Select
				options={[
					{ value: "50", label: "50 FPS" },
					{ value: "100", label: "100 FPS" },
				]}
				selected={fps}
				onChange={(value) => (fps = value)}
			/>
		</div>

		<div class="flex flex-col gap-4">
			<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
				Sensor mode
				<Tooltip
					content="Mode 1 enables the magnetometer which reduces drift if you have a stable geomagnetic environment. Mode 2 disables magnetometer and is recommended for unstable environments."
					icon="ri:information-line"
					position="up"
					width="300px"
				/>
			</h3>
			<Select
				options={[
					{ value: "2", label: "Mode 2" },
					{ value: "1", label: "Mode 1" },
				]}
				selected={sensorMode}
				onChange={(value) => (sensorMode = value)}
			/>
		</div>

		<div class="flex flex-col gap-4">
			<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
				Sensor auto correction
				<Tooltip
					content="Enable or disable sensor auto correction (dynamic calibration) features. Usually not needed to be changed and results vary between environments."
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
				Virtual feet trackers
				<Tooltip
					content="Enables the use of the ankle/leg sensor to track the motion of your feet."
					icon="ri:information-line"
					position="up"
					width="250px"
				/>
			</h3>
			<Switch
				label="Enable virtual feet trackers"
				selected={emulatedFeet}
				onChange={(value) => (emulatedFeet = value)}
			/>
			<!-- TODO: should probably detect if (x) tracker is an ankle tracker automatically. look for the char that writes the tracker assignment later -->
		</div>

		<div class="col-span-2 flex flex-col gap-4">
			<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
				Other settings
				<Tooltip
					content="Additional tracker settings that affect overall performance."
					icon="ri:information-line"
					position="up"
					width="250px"
				/>
			</h3>
			<div class="flex flex-row gap-3 pl-1">
				<Input
					className="flex-1"
					label="Heartbeat Interval (ms)"
					type="number"
					value={heartbeat}
					onChange={(value) => (heartbeat = Number(value))}
					icon="ri:heart-pulse-line"
					placeholder="2000"
				/>
				<Input
					className="flex-1"
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
