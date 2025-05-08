<script lang="ts">
	import Icon from "@iconify/svelte";

	interface Props {
		ghContribs: Array<{
			name: string;
			link: string;
			pfp: string;
		}>;
	}

	let { ghContribs }: Props = $props();
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center gap-2 text-xl font-heading">
		<Icon icon="ri:github-line" class="text-secondary" width={20} />
		GitHub Contributors
	</div>
	<div class="bg-panel rounded-xl p-4 shadow flex flex-col gap-4 min-w-[338px]">
		{#each ghContribs as c}
			<div class="flex items-center gap-3">
				<a href={c.link} target="_blank" rel="noopener noreferrer">
					<img src={c.pfp} alt={c.name} class="w-8 h-8 rounded-full bg-black object-cover" />
				</a>
				<div>
					<p class="font-heading text-base flex items-center gap-1">
						<a href={c.link} target="_blank" rel="noopener noreferrer" class="hover:underline">{c.name}</a>
					</p>
				</div>
			</div>
		{/each}
	</div>
</div>
