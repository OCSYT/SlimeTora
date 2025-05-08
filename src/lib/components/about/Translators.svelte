<script lang="ts">
	import Icon from "@iconify/svelte";

	interface Props {
		translators: Array<{
			language: string;
			contributors: Array<{
				name: string;
				pfp: string;
				link: string;
			}>;
		}>;
	}

	let { translators }: Props = $props();
</script>

<div class="flex flex-col gap-3">
	<div class="flex items-center gap-2 text-xl font-heading">
		<Icon icon="ri:translate-2" class="text-secondary" width={20} />
		Translators
	</div>
	<div class="bg-panel rounded-xl p-4 shadow flex flex-col gap-5 text-text-alt min-w-[338px]">
		{#each translators as t}
			<div>
				<h3 class="font-heading text-base mb-2">{t.language}</h3>
				<div class="flex gap-4 items-center text-sm flex-wrap">
					{#each t.contributors as c, i}
						<div class="flex items-center gap-2">
							<a href={c.link} target="_blank" rel="noopener noreferrer">
								<img src={c.pfp} alt={c.name} class="w-5 h-5 rounded-full bg-black object-cover" />
							</a>
							<a
								href={c.link}
								target="_blank"
								rel="noopener noreferrer"
								class="hover:underline hover:text-secondary-alt">{c.name}</a
							>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>
