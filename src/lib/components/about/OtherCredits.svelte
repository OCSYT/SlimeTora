<script lang="ts">
	import Icon from "@iconify/svelte";

	interface Props {
		others: Array<{ name: string; link: string; author?: string }>;
	}

	let { others }: Props = $props();
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center gap-2 text-xl font-heading">
		<Icon icon="ri:instance-line" class="text-secondary" width={20} />
		Other Credits
	</div>
	<div class="bg-panel rounded-xl p-4 shadow flex flex-col gap-1 min-w-[338px] text-sm">
		{#each others as o}
			<p>
				<a href={o.link} target="_blank" rel="noopener noreferrer" class="text-secondary-alt hover:underline"
					>{o.name}</a
				>
				{#if o.author}
					<span class="text-text-alt"> by {o.author}</span>
				{/if}
			</p>
		{/each}
	</div>
</div>
