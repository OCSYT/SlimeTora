<script lang="ts">
	import Icon from "@iconify/svelte";
	import { fade } from "svelte/transition";

	type Props = {
		content: any;
		icon: string;
		position?: "up" | "down" | "left" | "right";
		width?: string;
	};

	let { content, icon, position = "up", width = "auto" }: Props = $props();

	let showTooltip = $state(false);
	let hoverable: HTMLElement;

	const positionClasses = {
		up: "bottom-full left-1/2 -translate-x-1/2 mb-2",
		down: "top-full left-1/2 -translate-x-1/2 mt-2",
		left: "right-full top-1/2 -translate-y-1/2 mr-2",
		right: "left-full top-1/2 -translate-y-1/2 ml-2",
	};
</script>

<div
	class="relative inline-block"
	onmouseenter={() => (showTooltip = true)}
	onmouseleave={() => (showTooltip = false)}
	bind:this={hoverable}
	role="tooltip"
>
	<Icon {icon} width={20} class="text-text-alt cursor-pointer hover:text-text" />

	{#if showTooltip}
		<div
			class={`absolute z-100 ${positionClasses[position]}`}
			style={`width: ${width};`}
			role="tooltip"
			transition:fade={{ duration: 150 }}
		>
			{#if position === "up"}
				<div class="flex flex-col items-center">
					<div
						class="py-2 px-3 bg-quaternary border-2 border-secondary/80 text-sm rounded-md shadow-lg flex items-center gap-1.5"
					>
						<span>{content}</span>
					</div>
					<div
						class="w-3 h-3 bg-quaternary border-2 border-secondary/80 border-t-0 border-l-0 rotate-45 mt-[-6px]"
					></div>
				</div>
			{:else if position === "down"}
				<div class="flex flex-col items-center">
					<div
						class="w-3 h-3 bg-quaternary border-2 border-secondary/80 border-b-0 border-r-0 rotate-225 mb-[-6px]"
					></div>
					<div
						class="py-2 px-3 bg-quaternary border-2 border-secondary/80 text-sm rounded-md shadow-lg flex items-center gap-1.5"
					>
						<span>{content}</span>
					</div>
				</div>
			{:else if position === "left"}
				<div class="flex flex-row items-center">
					<div
						class="py-2 px-3 bg-quaternary border-2 border-secondary/80 text-sm rounded-md shadow-lg flex items-center gap-1.5"
					>
						<span>{content}</span>
					</div>
					<div
						class="w-3 h-3 bg-quaternary border-2 border-secondary/80 border-t-0 border-r-0 rotate-135 ml-[-6px]"
					></div>
				</div>
			{:else if position === "right"}
				<div class="flex flex-row items-center">
					<div
						class="w-3 h-3 bg-quaternary border-2 border-secondary/80 border-b-0 border-l-0 -rotate-45 mr-[-6px]"
					></div>
					<div
						class="py-2 px-3 bg-quaternary border-2 border-secondary/80 text-sm rounded-md shadow-lg flex items-center gap-1.5"
					>
						<span>{content}</span>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
