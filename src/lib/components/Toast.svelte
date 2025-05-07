<!-- HAHA STOLEN ONCE AGAIN FROM https://github.com/VERT-sh/VERT (because i wrote it)  -->
<script lang="ts">
	import { fade, fly } from "svelte/transition";
	import { quintOut } from "svelte/easing";
	import { removeToast } from "$lib/store/ToastProvider";
	import Icon from "@iconify/svelte";

	type Props = {
		id: number;
		type: "success" | "error" | "info" | "warning";
		message: string;
		durations: {
			enter: number;
			stay: number;
			exit: number;
		};
	};

	let { id, type, message, durations }: Props = $props();

	const colors = {
		success: "purple",
		error: "red",
		info: "blue",
		warning: "pink",
	};

	const Icons = {
		success: "ri:check-fill",
		error: "ri:close-circle-fill",
		info: "ri:information-fill",
		warning: "ri:alert-fill",
	};

	let color = $derived(colors[type]);
	let iconName = $derived(Icons[type]);

	// intentionally unused. this is so tailwind can generate the css for these colours as it doesn't detect if it's dynamically loaded
	// this would lead to the colours not being generated in the final css file by tailwind
	const colourVariants = [
		"bg-pink-300",
		"bg-red-300",
		"bg-purple-300",
		"bg-blue-300",
        "border-pink-500",
		"border-red-500",
		"border-purple-500",
		"border-blue-500",
	];
</script>

<div
	class="flex items-center justify-between max-w-sm p-4 gap-4 bg-{color}-300 border-{color}-500 border-l-4 rounded-lg shadow-md"
	in:fly={{
		duration: durations.enter,
		easing: quintOut,
		x: 0,
		y: 100,
	}}
	out:fade={{
		duration: durations.exit,
		easing: quintOut,
	}}
>
	<div class="flex items-center gap-4">
		<Icon
			icon={iconName}
			class="w-6 h-6 text-black flex-shrink-0"
			width="32"
			stroke="2"
			fill="none"
		/>
		<p class="text-black font-normal whitespace-pre-wrap">{message}</p>
	</div>
	<button
		class="text-gray-600 hover:text-black flex-shrink-0"
		onclick={() => removeToast(id)}
	>
		<Icon width="16" icon="ri:close-line" />
	</button>
</div>