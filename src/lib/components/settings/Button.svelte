<script lang="ts">
	import Icon from "@iconify/svelte";

	interface Props {
		label: string;
		icon?: string;
		iconPosition?: "left" | "right";
		background?: string;
		type?: "main" | "onboarding";
		onClick: () => void;
	}

	let { label, icon, iconPosition = "left", background = "quaternary", type = "main", onClick }: Props = $props();

	// Map background class names
	const bgClasses = {
		primary: "bg-primary hover:bg-primary/90",
		secondary: "bg-secondary hover:bg-secondary/90",
		tertiary: "bg-tertiary hover:bg-tertiary/90",
		quaternary: "bg-quaternary hover:bg-tertiary",
		button: "bg-button hover:bg-button/90",
	};

	const bgClass = bgClasses[background as keyof typeof bgClasses] || bgClasses.quaternary;
</script>

<button
	class="flex items-center gap-2 px-4 py-2 {bgClass} rounded-md transition-colors w-full
    {type === 'onboarding' ? 'button' : undefined}"
	onclick={onClick}
>
	{#if icon && iconPosition === "left"}
		<Icon {icon} width={18} />
	{/if}

	<span class="flex-1 text-center">{label}</span>

	{#if icon && iconPosition === "right"}
		<Icon {icon} width={18} />
	{/if}
</button>
