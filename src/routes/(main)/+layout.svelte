<script>
    import Header from "../../lib/components/Header.svelte";
    import Navbar from "../../lib/components/Navbar.svelte";

    let { children } = $props();
</script>

<div class="flex flex-col h-full min-h-screen">
    <Header />
    <div class="flex flex-row flex-grow">
        <div class="flex-1">
            <Navbar />
        </div>
        <div class="w-full h-full">
            {@render children()}
        </div>
    </div>
</div>
