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
		icon?: string;
	}

	let { label, className, options, selected, onChange, tooltip, tooltipPosition, tooltipWidth, icon }: Props =
		$props();

	function handleChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		onChange(target.value);
	}
</script>

<div class="flex flex-col gap-2 {className}">
	{#if label || tooltip}
		<div class="flex flex-row items-center gap-2">
			{#if label}
				<label class="font-medium" for="select-input">{label}</label>
			{/if}
			{#if tooltip}
				<Tooltip content={tooltip} icon="ri:information-line" position={tooltipPosition} width={tooltipWidth} />
			{/if}
		</div>
	{/if}
	<div class="relative w-full">
		{#if icon}
			<Icon {icon} width={18} class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
		{/if}
		<select
			id="select-input"
			bind:value={selected}
			onchange={handleChange}
			class="appearance-none bg-quaternary rounded-md px-3 py-2 pr-8 w-full focus:outline-none focus:ring-2 focus:ring-secondary transition-shadow"
			style="padding-left: {icon ? '2.5rem' : '0.75rem'}"
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
