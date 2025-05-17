<script lang="ts">
	import Icon from "@iconify/svelte";
	import Tooltip, { type TooltipPosition } from "./Tooltip.svelte";

	interface Props {
		label?: string;
		className?: string;
		options: { value: string; label: string }[];
		selected: string;
		onChange: (value: string) => void;
		tooltip?: string;
		tooltipPosition?: TooltipPosition;
		tooltipWidth?: string;
	}

	let { label, className, options, selected, onChange, tooltip, tooltipPosition, tooltipWidth }: Props = $props();

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		onChange(target.value);
	}
</script>

<div class="flex flex-col gap-2 {className}">
	<div class="flex flex-row items-center gap-2">
		<label class="font-medium" for="select-input">{label}</label>
		{#if tooltip}
			<Tooltip content={tooltip} icon="ri:information-line" position={tooltipPosition} width={tooltipWidth} />
		{/if}
	</div>
	<div class="relative w-full">
		<select
			id="select-input"
			bind:value={selected}
			onchange={handleChange}
			class="appearance-none bg-quaternary rounded-md px-3 py-2 pr-8 w-full focus:outline-none focus:ring-2 focus:ring-secondary transition-shadow"
		>
			{#each options as { value, label }}
				<option {value}>{label}</option>
			{/each}
		</select>
		<Icon
			icon="ri:arrow-down-s-line"
			class="absolute right-2 top-1/2 -translate-y-1/2 text-text-alt pointer-events-none"
			width={20}
		/>
	</div>
</div>
