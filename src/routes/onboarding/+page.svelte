<script>
	import { goto } from "$app/navigation";
</script>

<div class="flex flex-col justify-between text-center min-h-screen">
	<div class="flex flex-col justify-center items-center gap-6 flex-1">
		<div class="flex justify-center items-center">
			<div class="logo-bg"></div>
			<img src="/logo.png" alt="SlimeTora Logo" class="w-32 h-32 rounded-[20px] drop-shadow-lg" />
		</div>
		<div class="flex flex-col gap-3">
			<h1 class="text-[40px]">Welcome to SlimeTora!</h1>
			<p class="w-[600px] text-text-alt">
				SlimeTora is a middleware program that allows you to connect your HaritoraX trackers to the SlimeVR
				server, bypassing the official software!
			</p>
		</div>
	</div>

	<div class="w-full p-8 flex flex-col items-center gap-6 bg-panel">
		<p class="w-[600px] text-text-alt">
			Please select how you would like to setup SlimeTora. After you have set up the program, you will be guided
			on how to set up SlimeVR server.
		</p>
		<div class="flex flex-row gap-4">
			<button class="button bg-secondary hoverable" onclick={() => goto("/onboarding/setup")}>Guided Setup</button
			>
			<button class="button bg-button hoverable" onclick={() => goto("/")}>Manual Setup (Skip)</button>
		</div>
	</div>
</div>

<style>
	@reference "../../app.css";
	.logo-bg {
		@apply absolute w-[384px] h-[384px] z-[-10];
		background: linear-gradient(135deg, #9a48ee 0%, #f05d38 100%);
		filter: blur(175px);
	}
</style>
