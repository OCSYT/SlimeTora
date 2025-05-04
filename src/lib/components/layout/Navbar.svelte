<script lang="ts">
	import Icon from "@iconify/svelte";
	import { currentPath, externalNavLinks, navLinks } from "$lib/store";

	let path = $currentPath;
	currentPath.subscribe((value) => {
		path = value;
	});
</script>

<nav class="fixed w-16 h-[calc(100vh-64px)] top-16 bg-panel drop-shadow-xl flex flex-col justify-between">
	<div>
		{#each navLinks as { name, icon, link }}
			{@const same = path === link}
			<a href={link} class="link {same ? 'selected' : ''}">
				<Icon class={same ? "text-white" : "text-text-alt"} {icon} width={28} />
			</a>
		{/each}
	</div>

	<div>
		{#each externalNavLinks as { name, icon, link }}
			<a href={link} target="_blank" rel="noopener noreferrer" class="link">
				<Icon class="text-text-alt" {icon} width={28} />
			</a>
		{/each}
	</div>
</nav>

<style>
	@reference "../../../app.css";

	.link {
		@apply flex flex-col items-center justify-center h-16;
	}

	.link:hover {
		@apply bg-secondary/12;
	}

	.link:active {
		@apply bg-secondary/6;
	}

	.selected {
		@apply bg-secondary/24 pl-[2px] border-r-2 border-secondary;
	}
</style>
