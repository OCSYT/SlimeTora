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

	onMount(() => {
		invoke("get_serial_ports")
			.then((result) => {
				ports = result as string[];
				console.log(`Available serial ports: ${ports}`);

				return invoke("filter_ports", { ports });
			})
			.then((result) => {
				filteredPorts = result as string[];
				console.log(`Filtered Haritora ports: ${filteredPorts}`);
			})
			.catch((error) => {
				console.error(`Error occurred: ${error}`);
			});

		OverlayScrollbars(document.body, {
			scrollbars: {
				autoHide: "leave",
				autoHideDelay: 100,
				visibility: "auto",
				theme: "os-theme-dark",
			},
		});
	});
</script>

{@render children()}
