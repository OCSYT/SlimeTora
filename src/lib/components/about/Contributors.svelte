<script lang="ts">
	import Icon from "@iconify/svelte";

    interface Props {
        contributors: Array<{
            pfp: string;
            name: string;
            byline: string;
            links: Array<{ icon: string; url: string }>;
        }>;
    }

    let { contributors }: Props = $props();
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center gap-2 text-xl font-heading">
		<Icon icon="ri:id-card-line" class="text-secondary" width={20} />
		Contributors
	</div>
	<div class="bg-panel rounded-xl p-4 shadow flex flex-col gap-4 min-w-[338px]">
		{#each contributors as c}
			<div class="flex items-center gap-3">
				<img src={c.pfp} alt={c.name} class="w-10 h-10 rounded-full bg-black object-cover" />
				<div>
					<p class="font-heading text-base flex items-center gap-1">
						{c.name}
						{#each c.links as l}
							<a href={l.url} target="_blank" rel="noopener noreferrer">
								<Icon icon={l.icon} class="text-text-alt hover:text-secondary-alt" width={16} />
							</a>
						{/each}
					</p>
					<p class="text-text-alt text-sm">{c.byline}</p>
				</div>
			</div>
		{/each}
	</div>
</div>
