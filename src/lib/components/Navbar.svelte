<script lang="ts">
    import Icon from "@iconify/svelte";
    import { currentPath, externalNavLinks, navLinks } from "$lib/store";

    let path = $currentPath;
    currentPath.subscribe((value) => {
        path = value;
    });
</script>

<nav class="w-16 h-full bg-panel drop-shadow-xl flex flex-col justify-between">
    <div>
        {#each navLinks as { name, icon, link }}
            {@const same = path === link}
            <a
                href={link}
                class="flex flex-col items-center justify-center h-16 {same ? 'selected' : ''}"
            >
                <Icon class={same ? "text-white" : "text-text-alt"} {icon} width={28} />
            </a>
        {/each}
    </div>

    <div>
        {#each externalNavLinks as { name, icon, link }}
            <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                class="flex flex-col items-center justify-center h-16"
            >
                <Icon class="text-text-alt" {icon} width={28} />
            </a>
        {/each}
    </div>
</nav>

<style>
    @reference "../../app.css";

    .selected {
        @apply bg-secondary/24 border-r-2 border-secondary;
    }
</style>
