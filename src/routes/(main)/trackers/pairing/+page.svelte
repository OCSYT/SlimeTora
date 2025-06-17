<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import { invoke } from "@tauri-apps/api/core";
	import { listen } from "@tauri-apps/api/event";
	import { error, info } from "$lib/log";
	import { t } from "$lib/lang";
	import { connection } from "$lib/store/settings";
	import Button from "$lib/components/settings/Button.svelte";
	import Icon from "@iconify/svelte";
	import Select from "$lib/components/settings/Select.svelte";
	import { ConnectionMode } from "$lib/types/connection";
	import { TrackerModel } from "$lib/types/tracker";
	import { saveTrackerConfig } from "$lib/store";

	// TODO: i should probably rework how to handle devices - bluetooth and serial handle trackers differently and its kinda a mess
	// probably should unify it in one list of devices with type and connection mode
	// we could probably also just use the serial number purely (can get it on both bt and serial)

	// TODO: componetize stuff in this page

	interface TrackerDevice {
		deviceName: string;
		macAddress: string;
		trackerType: TrackerModel;
		rssi?: number;
	}

	interface PairedDevice {
		deviceName: string;
		macAddress: string;
		connected: boolean;
		trackerType: TrackerModel;
	}

	interface PortTracker {
		portId: string;
		status: "paired" | "unpaired" | "pairing";
		trackerName: string;
		channel: number;
	}

	let isScanning = $state(false);
	let discoveredDevices: TrackerDevice[] = $state([]);
	let pairedDevices: PairedDevice[] = $state([]);
	let portTrackers: Record<string, PortTracker[]> = $state({});

	let scanTimeout: NodeJS.Timeout | null = null;
	let unsubscribeDeviceConnected: (() => void) | null = null;
	let unsubscribeDeviceDisconnected: (() => void) | null = null;

	// TODO: initialize serial trackers based on settings
	$effect(() => {
		if ($connection.ports) {
			const newPortTrackers: Record<string, PortTracker[]> = {};
			$connection.ports.forEach((port) => {
				newPortTrackers[port] = [
					{ portId: "0", status: "unpaired", trackerName: "", channel: 1 },
					{ portId: "1", status: "unpaired", trackerName: "", channel: 1 },
				];
			});
			portTrackers = newPortTrackers;
		}
	});

	$effect(() => {
		if (pairedDevices) {
			$connection.macAddresses = pairedDevices.map((d) => d.macAddress);
		}
	});

	onMount(async () => {
		try {
			await loadPairedDevices();

			unsubscribeDeviceConnected = await listen("connect", async (event: any) => {
				// we are also listening to this "connect" event in notifications.ts, for the trackers store
				const payload = event.payload as {
					tracker: string;
					connection_mode: ConnectionMode;
					tracker_type: TrackerModel;
				};
				const macAddress = payload.tracker;
				const trackerType = payload.tracker_type;

				const deviceIndex = pairedDevices.findIndex((d) => d.macAddress === macAddress);
				if (deviceIndex >= 0) {
					pairedDevices[deviceIndex].connected = true;
					pairedDevices[deviceIndex].trackerType = trackerType;
					pairedDevices = [...pairedDevices];
				} else {
					// device not in paired list, add it
				}
			});

			unsubscribeDeviceDisconnected = await listen("disconnect", (event: any) => {
				const payload = event.payload as {
					tracker: string;
					connection_mode: ConnectionMode;
					tracker_type: TrackerModel;
				};
				const macAddress = payload.tracker;
				info(`Device disconnected: ${macAddress}`);

				const deviceIndex = pairedDevices.findIndex((d) => d.macAddress === macAddress);
				if (deviceIndex >= 0) {
					pairedDevices[deviceIndex].connected = false;
					pairedDevices = [...pairedDevices];
				}
			});
		} catch (err) {
			error(`Failed to initialize pairing page: ${err}`);
		}
	});

	onDestroy(() => {
		if (unsubscribeDeviceConnected) unsubscribeDeviceConnected();
		if (unsubscribeDeviceDisconnected) unsubscribeDeviceDisconnected();

		if (isScanning) stopBleScan();
		if (scanTimeout) clearTimeout(scanTimeout);
	});

	async function loadPairedDevices() {
		try {
			// TODO: load devices from config
			// and check which is connected
			pairedDevices = [];
		} catch (err) {
			error(`Failed to load paired devices: ${err}`);
			pairedDevices = [];
		}
	}

	// TODO: fix refreshing / hot reload not showing devices again when scanning
	async function startBleScan() {
		if (isScanning) return;

		try {
			isScanning = true;
			discoveredDevices = [];
			info("Started BLE scanning");

			const devices = await invoke<TrackerDevice[]>("start_ble_scanning", { timeout: 5000 });

			// update list with results
			discoveredDevices = devices.map((device) => ({
				deviceName: device.deviceName,
				macAddress: device.macAddress,
				trackerType: device.trackerType,
				rssi: device.rssi,
			}));
			info(`BLE scanning completed. Found ${devices.length} HaritoraX devices`);
		} catch (err) {
			error(`Failed to start BLE scanning: ${err}`);
		} finally {
			isScanning = false;
		}
	}

	async function stopBleScan() {
		if (!isScanning) return;

		try {
			await invoke("stop_ble_scanning");
			isScanning = false;
			info("Stopped BLE scanning");

			if (scanTimeout) {
				clearTimeout(scanTimeout);
				scanTimeout = null;
			}
		} catch (err) {
			error(`Failed to stop BLE scanning: ${err}`);
		}
	}

	async function pairDevice(address: string, name: string) {
		try {
			// TODO: restart ble connection when we pair a new device probably?
			// TODO: constantly keep trackers connected when app is running, start connection to actually forward data? (like VR Manager)
			const existingIndex = pairedDevices.findIndex((d) => d.macAddress === address);
			if (existingIndex === -1) {
				const trackerType = name.startsWith("HaritoraX2-")
					? TrackerModel.X2
					: name.startsWith("HaritoraXW-")
						? TrackerModel.Wireless
						: TrackerModel.Wired;

				pairedDevices = [
					...pairedDevices,
					{ macAddress: address, deviceName: name, connected: false, trackerType },
				];
				const newTracker = {
					id: address,
					name: name,
					connection_mode: ConnectionMode.BLE,
					tracker_type: trackerType,
					mac: address,
				};
				saveTrackerConfig(newTracker);
			}

			discoveredDevices = discoveredDevices.filter((d) => d.macAddress !== address);

			info(`Paired device: ${name}`);
		} catch (err) {
			error(`Failed to pair device: ${err}`);
		}
	}

	async function unpairDevice(address: string) {
		try {
			pairedDevices = pairedDevices.filter((d) => d.macAddress !== address);

			await invoke("disconnect_device", { macAddress: address });

			info(`Unpaired device: ${address}`);
		} catch (err) {
			error(`Failed to unpair device: ${err}`);
		}
	}

	async function unpairAllDevices() {
		try {
			await invoke("stop_ble_connections");
			pairedDevices = [];
			info("Unpaired all devices");
		} catch (err) {
			error(`Failed to unpair all devices: ${err}`);
		}
	}

	function togglePortTracker(port: string, portId: string, trackerName: string) {
		if (!portTrackers[port]) return;

		const tracker = portTrackers[port].find((t) => t.portId === portId);
		if (!tracker) return;

		if (tracker.status === "unpaired") {
			tracker.status = "paired";
			tracker.trackerName = trackerName;
		} else {
			tracker.status = "unpaired";
			tracker.trackerName = "";
		}

		portTrackers = { ...portTrackers };
	}

	function updateChannel(port: string, portId: string, channel: number) {
		if (!portTrackers[port]) return;

		const tracker = portTrackers[port].find((t) => t.portId === portId);
		if (tracker) {
			tracker.channel = channel;
			portTrackers = { ...portTrackers };
		}
	}
</script>

<div class="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
	<div class="text-center">
		<h1 class="text-3xl font-bold mb-2">{$t("trackers.pairing.title")}</h1>
		<p>{$t("trackers.pairing.subtitle")}</p>
	</div>

	<!-- Bluetooth LE pairing section -->
	<div class="bg-panel rounded-lg p-6">
		<div class="flex items-center gap-3 mb-4">
			<Icon icon="mdi:bluetooth" width={24} class="text-secondary" />
			<h2 class="text-xl font-semibold">{$t("trackers.pairing.bluetooth.title")}</h2>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Paired devices row -->
			<div class="bg-quaternary rounded-lg p-4">
				<div class="flex items-center justify-between mb-3">
					<h3 class="text-base font-medium flex-grow">{$t("trackers.pairing.bluetooth.paired_devices")}</h3>
					{#if pairedDevices.length > 0}
						<div class="text-sm">
							<Button
								label={$t("trackers.pairing.bluetooth.unpair_all")}
								icon="mdi:link-off"
								background="danger"
								onClick={unpairAllDevices}
							/>
						</div>
					{/if}
				</div>
				<div class="grid grid-cols-2 gap-2">
					{#if pairedDevices.length === 0}
						<div class="col-span-2 text-center py-4 text-sm">
							<Icon icon="mdi:bluetooth-off" width={24} class="mx-auto mb-2 opacity-50" />
							<p>{$t("trackers.pairing.bluetooth.no_paired_devices")}</p>
						</div>
					{:else}
						{#each pairedDevices as device}
							<div class="bg-tertiary rounded-md p-2 flex flex-col gap-1.5">
								<div class="flex items-center gap-1.5">
									<Icon icon="mdi:bluetooth" width={14} class="text-blue-400 flex-shrink-0" />
									<span class="font-medium text-xs truncate">{device.deviceName}</span>
									{#if device.connected}
										<span class="bg-green-500 text-white text-xs px-1 py-0.5 rounded flex-shrink-0">
											{$t("trackers.pairing.bluetooth.connected")}
										</span>
									{:else}
										<span class="bg-gray-500 text-white text-xs px-1 py-0.5 rounded flex-shrink-0">
											{$t("trackers.pairing.bluetooth.disconnected")}
										</span>
									{/if}
								</div>
								<div class="flex items-center justify-between">
									<div class="text-xs font-mono truncate">{device.macAddress}</div>
									{#if device.trackerType}
										<span class="bg-blue-500 text-white text-xs px-1 py-0.5 rounded flex-shrink-0">
											{device.trackerType}
										</span>
									{/if}
								</div>
								<Button
									label={$t("trackers.pairing.bluetooth.unpair")}
									icon="mdi:link-off"
									background="danger"
									onClick={() => unpairDevice(device.macAddress)}
									className="text-xs h-7 px-2"
								/>
							</div>
						{/each}
					{/if}
				</div>
			</div>
			<!-- Discovered devices row -->
			<div class="bg-quaternary rounded-lg p-4">
				<div class="flex items-center justify-between mb-3">
					<h3 class="text-base font-medium flex-grow">
						{$t("trackers.pairing.bluetooth.discovered_devices")}
					</h3>
					<div class="text-sm">
						<Button
							label={isScanning
								? $t("trackers.pairing.bluetooth.stop_scanning")
								: $t("trackers.pairing.bluetooth.scan_devices")}
							icon={isScanning ? "mdi:stop" : "mdi:magnify"}
							background={isScanning ? "danger" : "primary"}
							onClick={isScanning ? stopBleScan : startBleScan}
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-2">
					{#if discoveredDevices.length === 0}
						<div class="col-span-2 text-center py-4 text-sm">
							{#if isScanning}
								<Icon icon="mdi:loading" width={24} class="animate-spin mx-auto mb-2" />
								<p>{$t("trackers.pairing.bluetooth.searching")}</p>
							{:else}
								<Icon icon="mdi:bluetooth-off" width={24} class="mx-auto mb-2 opacity-50" />
								<p>{$t("trackers.pairing.bluetooth.no_devices_found")}</p>
							{/if}
						</div>
					{:else}
						{#each discoveredDevices as device}
							<div class="bg-tertiary rounded-md p-2 flex flex-col gap-1.5">
								<div class="flex items-center gap-1.5">
									<Icon icon="mdi:bluetooth" width={14} class="text-blue-400 flex-shrink-0" />
									<span class="font-medium text-xs truncate">{device.deviceName}</span>
									{#if device.rssi}
										<div class="flex items-center gap-1 flex-shrink-0">
											<Icon
												icon="mdi:wifi"
												width={10}
												class={device.rssi > -50
													? "text-green-400"
													: device.rssi > -70
														? "text-yellow-400"
														: "text-red-400"}
											/>
											<span class="text-xs">{device.rssi}</span>
										</div>
									{/if}
								</div>
								<div class="text-xs font-mono truncate">{device.macAddress}</div>
								<Button
									label={$t("trackers.pairing.bluetooth.pair")}
									icon="mdi:link"
									background="primary"
									onClick={() => pairDevice(device.macAddress, device.deviceName)}
									className="text-xs h-7 px-2"
								/>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Serial/GX(6/2) pairing section -->
	<div class="bg-panel rounded-lg p-6">
		<div class="flex items-center gap-3 mb-4">
			<Icon icon="mdi:usb-port" width={24} class="text-secondary" />
			<h2 class="text-xl font-semibold">{$t("trackers.pairing.serial.title")}</h2>
		</div>

		<div class="space-y-6">
			{#if $connection.ports.length === 0}
				<div class="text-center py-8 text-secondary">
					<Icon icon="mdi:usb-off" width={32} class="mx-auto mb-2 opacity-50" />
					<p>{$t("trackers.pairing.serial.no_ports")}</p>
				</div>
			{:else}
				{#each $connection.ports as port}
					<div class="bg-quaternary rounded-lg p-4">
						<h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
							<Icon icon="mdi:usb-port" width={20} class="text-secondary" />
							{$t("trackers.pairing.serial.serial_port", { port })}
						</h3>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							{#each portTrackers[port] || [] as tracker}
								<div class="bg-panel rounded-md p-4 flex flex-col justify-between h-full">
									<div class="flex items-center justify-between mb-3">
										<h4 class="font-medium">
											{$t("trackers.pairing.serial.port_id", { id: tracker.portId })}
										</h4>
										<span
											class="text-sm px-2 py-1 rounded {tracker.status === 'paired'
												? 'bg-green-500 text-white'
												: tracker.status === 'pairing'
													? 'bg-yellow-500 text-white'
													: 'bg-gray-500 text-white'}"
										>
											{tracker.status === "paired"
												? $t("trackers.pairing.paired")
												: tracker.status === "pairing"
													? $t("trackers.pairing.serial.pairing")
													: $t("trackers.pairing.serial.unpaired")}
										</span>
									</div>

									<div class="mb-4">
										<label
											class="block text-base font-semibold"
											for={`tracker-name-${port}-${tracker.portId}`}
										>
											{$t("trackers.pairing.serial.tracker")}
										</label>
										<span
											id={`tracker-name-${port}-${tracker.portId}`}
											class="text-base font-normal"
										>
											{tracker.status === "paired"
												? tracker.trackerName
												: $t("trackers.pairing.serial.none")}
										</span>
									</div>
									<div class="flex flex-row items-center justify-center gap-2">
										<Select
											options={Array.from({ length: 10 }, (_, i) => ({
												value: String(i + 1),
												label: $t("trackers.pairing.serial.channel_num", { num: i + 1 }),
											}))}
											selected={String(tracker.channel)}
											onChange={(value) => updateChannel(port, tracker.portId, parseInt(value))}
											className="w-full"
										/>
										<Button
											label={tracker.status === "paired"
												? $t("trackers.pairing.serial.unpair")
												: $t("trackers.pairing.serial.pair")}
											icon={tracker.status === "paired" ? "mdi:link-off" : "mdi:link"}
											background={tracker.status === "paired" ? "danger" : "button"}
											className="w-full text-xs h-8"
											onClick={() =>
												togglePortTracker(
													port,
													tracker.portId,
													tracker.status === "paired" ? "" : "meow",
												)}
										/>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>
