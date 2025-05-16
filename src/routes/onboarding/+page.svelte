<script>
	import { goto } from "$app/navigation";
	import Button from "$lib/components/settings/Button.svelte";
	import { t } from "$lib/lang";
</script>

<div class="flex flex-col justify-between text-center min-h-screen">
	<div class="flex flex-col justify-center items-center gap-6 flex-1">
		<div class="flex justify-center items-center">
			<div class="logo-bg"></div>
			<img src="/logo.png" alt="SlimeTora Logo" class="w-32 h-32 rounded-[20px] drop-shadow-lg" />
		</div>
		<div class="flex flex-col gap-3">
			<h1 class="text-[40px]">{$t("onboarding.title")}</h1>
			<p class="w-[600px] text-text-alt">
				{$t("onboarding.welcome")}
			</p>
		</div>
	</div>

	<div class="w-full p-8 flex flex-col items-center gap-6 bg-panel">
		<p class="w-[600px] text-text-alt">
			{$t("onboarding.setup")}
		</p>
		<div class="flex flex-row gap-4">
			<Button
				type="onboarding"
				label="{$t("onboarding.start")}"
				background="secondary"
				onClick={() => goto("/onboarding/setup")}
			/>
			<Button type="onboarding" label="{$t("onboarding.skip")}" background="button" onClick={() => goto("/")} />
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
