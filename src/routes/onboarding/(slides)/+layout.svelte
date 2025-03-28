<script>
    import Header from "$lib/components/layout/Header.svelte";

    let { children } = $props();
</script>

<div class="flex flex-col h-full min-h-screen">
    <Header />
    <div class="flex flex-row flex-grow">
        <div class="flex-1">
            {@render children()}
        </div>
    </div>
</div>
