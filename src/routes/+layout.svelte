<script lang="ts">
	import { onNavigate } from "$app/navigation";
	import { currentPath } from "$lib/store";
	import { invoke } from "@tauri-apps/api/core";
	import { onMount } from "svelte";
	import { OverlayScrollbars } from "OverlayScrollbars";
	import "../app.css";
	import "@fontsource/chakra-petch";
	import "overlayscrollbars/overlayscrollbars.css";

	let { children } = $props();
	let ports: string[] = $state([]);
	let filteredPorts: string[] = $state([]);

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
		// 	console.log("Heartbeat tracker started");
		// } catch (error) {
		// 	console.error(`Failed to start heartbeat tracker: ${error}`);
		// }
	});
</script>

{@render children()}
