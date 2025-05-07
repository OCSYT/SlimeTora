<script lang="ts">
	import Icon from "@iconify/svelte";
	import { fade } from "svelte/transition";

	export type TooltipPosition = "up" | "down" | "left" | "right";

	type Props = {
		content: any;
		icon?: string;
		position?: TooltipPosition;
		width?: string;
		children?: any;
	};

	let { content, icon, position = "up", width = "250px", children }: Props = $props();

	let showTooltip = $state(false);
	let hoverable: HTMLElement;
	let tooltipEl: HTMLElement | undefined = $state();
	let tooltipStyle = $state({ top: 0, left: 0 });
	let tooltipCurrentPosition: TooltipPosition = $state(position);

	function updateTooltipPosition() {
		if (!hoverable || !tooltipEl) return;
		const triggerRect = hoverable.getBoundingClientRect();
		const tooltipRect = tooltipEl.getBoundingClientRect();
		let top = 0,
			left = 0;
		let chosenPosition: TooltipPosition = position;

		// try preferred position first, but if it doesn't fit, try others
		function fits(pos: "up" | "down" | "left" | "right") {
			if (pos === "up") return triggerRect.top - tooltipRect.height - 8 > 0;
			if (pos === "down") return triggerRect.bottom + tooltipRect.height + 8 < window.innerHeight;
			if (pos === "left") return triggerRect.left - tooltipRect.width - 8 > 0;
			if (pos === "right") return triggerRect.right + tooltipRect.width + 8 < window.innerWidth;
			return false;
		}

		if (!fits(position)) {
			const order = ["up", "down", "left", "right"].filter((p) => p !== position);
			for (const pos of order)
				if (fits(pos as TooltipPosition)) {
					chosenPosition = pos as TooltipPosition;
					break;
				}
		}

		if (chosenPosition === "up") {
			top = triggerRect.top - tooltipRect.height - 8;
			left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
		} else if (chosenPosition === "down") {
			top = triggerRect.bottom + 8;
			left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
		} else if (chosenPosition === "left") {
			top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
			left = triggerRect.left - tooltipRect.width - 8;
		} else if (chosenPosition === "right") {
			top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
			left = triggerRect.right + 8;
		}

		// prevent overlap
		top = Math.max(8, Math.min(window.innerHeight - tooltipRect.height - 8, top));
		left = Math.max(8, Math.min(window.innerWidth - tooltipRect.width - 8, left));

		tooltipStyle = { top, left };
		tooltipCurrentPosition = chosenPosition;
	}

	$effect(() => {
		if (showTooltip) setTimeout(updateTooltipPosition, 0);
	});
</script>

<div
	class="relative inline-block"
	onmouseenter={() => (showTooltip = true)}
	onmouseleave={() => (showTooltip = false)}
	bind:this={hoverable}
	role="tooltip"
>
	{#if icon}
		<Icon {icon} width={20} class="text-text-alt cursor-pointer hover:text-text" />
	{:else}
		{@render children()}
	{/if}

	{#if showTooltip}
		<div
			bind:this={tooltipEl}
			class="fixed z-[9999]"
			style="top: {tooltipStyle.top}px; left: {tooltipStyle.left}px; width: {width};"
			role="tooltip"
			transition:fade={{ duration: 150 }}
		>
			<div class="relative">
				<div
					class="py-2 px-3 bg-quaternary border-2 border-secondary/80 text-sm rounded-md shadow-lg relative"
					class:tooltip-up={tooltipCurrentPosition === "up"}
					class:tooltip-down={tooltipCurrentPosition === "down"}
					class:tooltip-left={tooltipCurrentPosition === "left"}
					class:tooltip-right={tooltipCurrentPosition === "right"}
				>
					{content}
				</div>
			</div>
		</div>
	{/if}
</div>

<!--
	code partially "stolen" from https://github.com/VERT-sh/VERT
	it's "stolen".. because I wrote it
-->
<style>
	@reference "../../../app.css";

	/* Base arrow styles */
	.tooltip-up::after,
	.tooltip-down::after,
	.tooltip-left::after,
	.tooltip-right::after,
	.tooltip-up::before,
	.tooltip-down::before,
	.tooltip-left::before,
	.tooltip-right::before {
		content: "";
		position: absolute;
		pointer-events: none;
	}

	/* Up tooltip arrows */
	.tooltip-up::before {
		bottom: -10px;
		left: 50%;
		margin-left: -10px;
		border-width: 10px 10px 0;
		border-style: solid;
		@apply border-transparent border-t-secondary/80;
	}

	.tooltip-up::after {
		bottom: -7px;
		left: 50%;
		margin-left: -8px;
		border-width: 8px 8px 0;
		border-style: solid;
		border-color: var(--color-quaternary) transparent transparent transparent;
		@apply border-transparent border-t-quaternary;
	}

	/* Down tooltip arrows */
	.tooltip-down::before {
		top: -10px;
		left: 50%;
		margin-left: -10px;
		border-width: 0 10px 10px;
		border-style: solid;
		@apply border-transparent border-b-secondary/80;
	}

	.tooltip-down::after {
		top: -7px;
		left: 50%;
		margin-left: -8px;
		border-width: 0 8px 8px;
		border-style: solid;
		@apply border-transparent border-b-quaternary;
	}

	/* Left tooltip arrows */
	.tooltip-left::before {
		right: -10px;
		top: 50%;
		margin-top: -10px;
		border-width: 10px 0 10px 10px;
		border-style: solid;
		@apply border-transparent border-l-secondary/80;
	}

	.tooltip-left::after {
		right: -7px;
		top: 50%;
		margin-top: -8px;
		border-width: 8px 0 8px 8px;
		border-style: solid;
		@apply border-transparent border-l-quaternary;
	}

	/* Right tooltip arrows */
	.tooltip-right::before {
		left: -10px;
		top: 50%;
		margin-top: -10px;
		border-width: 10px 10px 10px 0;
		border-style: solid;
		@apply border-transparent border-r-secondary/80;
	}

	.tooltip-right::after {
		left: -7px;
		top: 50%;
		margin-top: -8px;
		border-width: 8px 8px 8px 0;
		border-style: solid;
		@apply border-transparent border-r-quaternary;
	}
</style>
