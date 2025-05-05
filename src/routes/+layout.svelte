<script lang="ts">
	import { browser } from "$app/environment";
	import { onNavigate } from "$app/navigation";
	import { currentPath } from "$lib/store";
	import { onDestroy, onMount } from "svelte";
	import { OverlayScrollbars } from "OverlayScrollbars";
	import { attachConsole } from "@tauri-apps/plugin-log";
	import "../app.css";
	import "@fontsource/chakra-petch";
	import "overlayscrollbars/overlayscrollbars.css";

	let { children } = $props();
	let ports: string[] = $state([]);
	let filteredPorts: string[] = $state([]);
	let detach: () => void;

	onNavigate((event) => {
		currentPath.set(event.to?.url.pathname ?? "/");
	});

	onMount(async () => {
		currentPath.set(window.location.pathname);

		OverlayScrollbars(document.body, {
			scrollbars: {
				autoHide: "leave",
				autoHideDelay: 100,
				visibility: "auto",
				theme: "os-theme-dark",
			},
		});

		// try {
		// 	await invoke("start_heartbeat");
		// 	info("Heartbeat tracker started");
		// } catch (err) {
		// 	error(`Failed to start heartbeat tracker: ${err}`);
		// }

		detach = await attachConsole();
	});

	onDestroy(() => {
		if (detach) detach();
	});
</script>

{@render children()}
