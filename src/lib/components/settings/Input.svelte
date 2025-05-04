<script lang="ts">
	import Icon from "@iconify/svelte";

	interface Props {
		label: string;
		value: string | number;
		className?: string;
        placeholder?: string;
		type?: string;
		icon?: string | null;
		onChange: (value: string | number) => void;
	}

	let { label, value, className, type = "text", onChange, icon = null, placeholder }: Props = $props();

	function handleChange(event: Event) {
		const target = event.target as HTMLInputElement;
		onChange(type === "number" ? Number(target.value) : target.value);
	}
</script>

<div class="flex flex-col gap-2 {className}">
	<label class="font-medium" for="input">{label}</label>
	<div class="relative w-full">
		<input
			id="input"
			{type}
			bind:value
			{placeholder}
			oninput={handleChange}
			class="w-full bg-quaternary rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-secondary transition-shadow"
		/>
		{#if icon}
			<Icon
				{icon}
				class="absolute right-3 top-1/2 -translate-y-1/2 text-text-alt pointer-events-none"
				width={18}
			/>
		{/if}
	</div>
</div>

<style>
    /* Hide number input spinners on hover */
    input[type="number"]:hover {
        -moz-appearance: textfield;
        appearance: textfield;
    }
    input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
</style>