<script lang="ts">
	import Icon from "@iconify/svelte";
	import Tooltip, { type TooltipPosition } from "./Tooltip.svelte";

	interface Props {
		label: string;
		checked: boolean;
		onChange: (checked: boolean) => void;
		tooltip?: string;
		tooltipPosition?: TooltipPosition;
		tooltipWidth?: string;
	}

	let { label, checked = $bindable(), onChange, tooltip, tooltipPosition, tooltipWidth }: Props = $props();

	function handleChange(event: Event) {
		const target = event.target as HTMLInputElement;
		onChange(target.checked);
	}
</script>

<label class="relative flex items-center gap-3 cursor-pointer">
	<input type="checkbox" class="peer sr-only" bind:checked onchange={handleChange} />
	<div
		class="w-5 h-5 rounded flex items-center justify-center transition
			bg-panel
			border-4 border-panel
			peer-checked:bg-primary
			peer-checked:border-panel
		"
	>
		<div class="w-[18px] h-[18px] rounded bg-background flex items-center justify-center">
			<div
				class="w-full h-full rounded flex items-center justify-center
					border-2
					{checked ? 'border-secondary' : 'border-secondary/60'}
					transition"
			>
				<Icon
					icon="ri:check-fill"
					class="text-white w-4 h-4 {checked ? 'opacity-100' : 'opacity-0'} transition-opacity"
				/>
			</div>
		</div>
	</div>
	<span class="font-medium flex items-center gap-2">
		{label}
		{#if tooltip}
			<Tooltip
				content={tooltip}
				icon="ri:information-line"
				position={tooltipPosition}
				width={tooltipWidth}
			/>
		{/if}
	</span>
</label>
