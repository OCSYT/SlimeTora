<script lang="ts">
	import { onNavigate } from "$app/navigation";
	import { currentPath } from "$lib/store";
	import { onMount } from "svelte";
	import { OverlayScrollbars } from "OverlayScrollbars";
	import Toast from "$lib/components/Toast.svelte";
	import { type Toast as ToastType, toasts } from "$lib/store/ToastProvider";
	import "../app.css";
	import "@fontsource/chakra-petch";
	import "overlayscrollbars/overlayscrollbars.css";

	let { children } = $props();
	let detach: () => void;

	let toastList = $state<ToastType[]>([]);
	toasts.subscribe((value) => {
		toastList = value as ToastType[];
	});

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
	});
</script>

{@render children()}
<div
	class="fixed bottom-28 md:bottom-0 right-0 p-4 flex flex-col-reverse gap-4 z-50"
>
	{#each toastList as { id, type, message, durations }}
		<div class="flex justify-end">
			<Toast {id} {type} {message} {durations} />
		</div>
	{/each}
</div>