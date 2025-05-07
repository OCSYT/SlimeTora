<script lang="ts">
	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import { trackers } from "$lib/store";
	import Icon from "@iconify/svelte";
	import Select from "$lib/components/settings/Select.svelte";
	import Switch from "$lib/components/settings/Switch.svelte";
	import Button from "$lib/components/settings/Button.svelte";
	import { error, info } from "$lib/log";
	import Tooltip from "$lib/components/settings/Tooltip.svelte";

	// TODO: finish this

	let trackerId: string | null = null;
	let trackerData: any = $state(null);

	// Get tracker ID from the route parameter
	$effect(() => {
		const newId = page.url.searchParams.get("trackerId");
		if (!newId) {
			error("Tracker ID is undefined. Redirecting to trackers list.");
			goto("/trackers");
			return;
		}
		if (trackerId !== newId) {
			trackerId = newId;
			trackerData = $trackers.find((tracker) => tracker.id === trackerId);

			if (!trackerData) {
				error(`Tracker with ID ${trackerId} not found. Redirecting to trackers list.`);
				goto("/trackers");
			}
		}
	});

	// State for settings
	let fps = $state("50");
	let sensorMode = $state("2");
	let sensorCorrections = $state({
		accelerometer: true,
		gyroscope: false,
		magnetometer: false,
	});

	function getTrackerSettings() {
		info(`Getting settings for tracker ${trackerId}`);
		// Add logic to fetch tracker settings
	}

	function resetSettings() {
		info(`Resetting settings for tracker ${trackerId}`);
		// Add logic to reset tracker settings
	}
</script>

<div class="flex flex-col p-4 gap-8">
	<div class="bg-panel rounded-lg p-6 shadow">
		<h1 class="text-2xl font-heading mb-4">{trackerData?.name} settings</h1>
		<p class="text-text-alt mb-6">
			Override the hardware settings for this tracker. Can be useful if only certain trackers have bad mag
			statuses.
		</p>

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
					selected={trackerData?.emulatedFeet}
					onChange={(value) => (trackerData.emulatedFeet = value)}
				/>
			</div>

			<div class="flex flex-col gap-4 col-span-2">
				<h3
					class="text-lg font-heading flex items-center gap-2 pb-2 mb-4 border-b border-secondary/50 text-warning"
				>
					Debugging
					<Icon
						icon="ri:information-line"
						width={20}
						class="text-text-alt hover:text-white transition-colors"
					/>
				</h3>
				<div class="flex flex-col gap-4">
					<!-- <Button
                        label="Turn off tracker"
                        background="danger"
                        onClick={turnOffTracker}
                    /> -->
					<Button label="Get tracker settings" background="primary" onClick={getTrackerSettings} />
					<Button label="Reset settings" background="primary" onClick={resetSettings} />
				</div>
			</div>
		</div>
	</div>
</div>
