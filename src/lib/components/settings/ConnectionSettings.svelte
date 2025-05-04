<script lang="ts">
	import { connection } from "$lib/store/settings";
	import { ConnectionMode } from "$lib/types/connection";
	import { TrackerModel } from "$lib/types/tracker";
	import Icon from "@iconify/svelte";
	import { invoke } from "@tauri-apps/api/core";
	import { onMount } from "svelte";
	import Switch from "./Switch.svelte";
	import Input from "./Input.svelte";
	import Checkbox from "./Checkbox.svelte";

	let portsInitialized = $state(false);
	let availablePorts: string[] = [];
	let comPorts: Record<string, boolean> = $state({});

	let trackerModels = $state({
		X2: $connection.models?.includes(TrackerModel.X2),
		Wireless: $connection.models?.includes(TrackerModel.Wireless),
		Wired: $connection.models?.includes(TrackerModel.Wired),
	});
	let connectionModes = $state({
		ble: $connection.modes?.includes(ConnectionMode.BLE),
		serial: $connection.modes?.includes(ConnectionMode.Serial),
	});
	let slimevrIP = $state($connection.slimevrIP);
	let slimevrPort = $state($connection.slimevrPort);

	onMount(async () => {
		console.log(`Initial connection ports: ${JSON.stringify($connection.ports)}`);
		try {
			const ports = await invoke<string[]>("get_serial_ports");
			console.log(`Available ports from invoke: ${JSON.stringify(ports)}`);
			availablePorts = ports;

			const originalPorts = $connection.ports || [];

			const portsState: Record<string, boolean> = {};
			ports.forEach((port) => {
				portsState[port] = originalPorts.includes(port);
			});

			comPorts = portsState;
			portsInitialized = true;
			console.log(`Initialized comPorts: ${JSON.stringify(comPorts)}`);
		} catch (error) {
			console.error(`Failed to fetch serial ports: ${error}`);
			portsInitialized = true;
		}
	});

	$effect(() => {
		if (!portsInitialized) {
			return;
		}

		const models: TrackerModel[] = [];
		if (trackerModels.X2) models.push(TrackerModel.X2);
		if (trackerModels.Wireless) models.push(TrackerModel.Wireless);
		if (trackerModels.Wired) models.push(TrackerModel.Wired);

		const modes: string[] = [];
		if (connectionModes.ble) modes.push(ConnectionMode.BLE);
		if (connectionModes.serial) modes.push(ConnectionMode.Serial);

		const activePorts = Object.entries(comPorts).reduce((acc, [port, isActive]) => {
			if (isActive) acc.push(port);
			return acc;
		}, [] as string[]);

		connection.update((prev) => {
			return {
				...prev,
				models,
				modes,
				ports: activePorts,
				slimevrIP,
				slimevrPort,
			};
		});
	});
</script>

<div class="bg-panel rounded-lg p-6 shadow">
	<h2 class="text-2xl font-heading mb-6 flex items-center gap-2">
		<Icon icon="ri:link" class="text-secondary" width={28} />
		Connection Settings
	</h2>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
		<div class="flex flex-col gap-4">
			<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
				Tracker Model
				<Icon icon="ri:information-line" width={20} class="text-text-alt hover:text-white transition-colors" />
			</h3>
			<div class="flex flex-col gap-3 pl-1">
				<Checkbox
					label="HaritoraX 2"
					checked={trackerModels.X2}
					onChange={(value) => (trackerModels.X2 = value)}
				/>
				<Checkbox
					label="HaritoraX Wireless"
					checked={trackerModels.Wireless}
					onChange={(value) => (trackerModels.Wireless = value)}
				/>
				<Checkbox
					label="HaritoraX 1.1b/1.1/1.0"
					checked={trackerModels.Wired}
					onChange={(value) => (trackerModels.Wired = value)}
				/>
			</div>

			<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
				Connection Mode
				<Icon icon="ri:information-line" width={20} class="text-text-alt hover:text-white transition-colors" />
			</h3>
			<div class="flex flex-col gap-3 pl-1">
				<Checkbox
					label="Bluetooth (LE)"
					checked={connectionModes.ble}
					onChange={(value) => (connectionModes.ble = value)}
				/>
				<Checkbox
					label="COM / GX(6/2)"
					checked={connectionModes.serial}
					onChange={(value) => (connectionModes.serial = value)}
				/>
			</div>
		</div>

		<div class="flex flex-col gap-4">
			<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
				Serial Ports
				<Icon icon="ri:information-line" width={20} class="text-text-alt hover:text-white transition-colors" />
			</h3>
			{#if Object.keys(comPorts).length > 0}
				<div class="grid grid-cols-2 gap-3 pl-1">
					{#each Object.entries(comPorts) as [port, isActive]}
						<Switch label={port} selected={comPorts[port]} onChange={(value) => (comPorts[port] = value)} />
					{/each}
				</div>
			{:else}
				<p class="text-text-alt italic">No COM ports detected</p>
			{/if}

			<h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
				SlimeVR Server
				<Icon icon="ri:information-line" width={20} class="text-text-alt hover:text-white transition-colors" />
			</h3>
			<div class="grid grid-cols-3 gap-4">
				<div class="col-span-2">
					<Input
						label="Server IP"
						type="text"
						value={slimevrIP}
						onChange={(value) => (slimevrIP = String(value))}
						icon="ri:global-line"
						placeholder={"255.255.255.255"}
					/>
				</div>
				<div>
					<Input
						label="Server Port"
						type="number"
						value={slimevrPort}
						onChange={(value) => (slimevrPort = Number(value))}
						icon="ri:door-line"
						placeholder={"6969"}
					/>
				</div>
			</div>
		</div>
	</div>
</div>
