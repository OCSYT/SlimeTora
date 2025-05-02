<script>
	import Header from "$lib/components/layout/Header.svelte";
	import Navbar from "$lib/components/layout/Navbar.svelte";

	let { children } = $props();
</script>

<div class="flex flex-col h-full min-h-screen">
	<Header />
	<div class="flex flex-row flex-grow">
		<div>
			<Navbar />
		</div>
		<div class="flex-1 mt-16 ml-16">
			{@render children()}
		</div>
	</div>
</div>
