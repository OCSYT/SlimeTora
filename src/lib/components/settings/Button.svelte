<script lang="ts">
	import Icon from "@iconify/svelte";

	interface Props {
		label: string;
		className?: string;
		icon?: string;
		iconPosition?: "left" | "right";
		background?: string;
		type?: "main" | "onboarding";
		onClick: () => void;
	}

	let {
		label,
		className,
		icon,
		iconPosition = "left",
		background = "quaternary",
		type = "main",
		onClick,
	}: Props = $props();

	const bgClasses = {
		primary: "bg-primary hover:bg-primary/70 active:bg-primary/50",
		secondary: "bg-secondary hover:bg-secondary/70 active:bg-secondary/50",
		tertiary: "bg-tertiary hover:bg-tertiary/70 active:bg-tertiary/50",
		quaternary: "bg-quaternary hover:bg-tertiary/60 active:bg-tertiary/30",
		button: "bg-button hover:bg-button/70 active:bg-button/50",
		danger: "bg-red-500 hover:bg-red-500/70 active:bg-red-500/50",
	};

	const bgClass = bgClasses[background as keyof typeof bgClasses] || bgClasses.quaternary;
</script>

<button
	class="flex items-center gap-2 px-4 py-2 {bgClass} rounded-md transition-colors w-full {className}
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
