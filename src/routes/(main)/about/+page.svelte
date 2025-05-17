<script lang="ts">
	import ContributorsPanel from "$lib/components/about/Contributors.svelte";
	import TranslatorsPanel from "$lib/components/about/Translators.svelte";
	import OtherCreditsPanel from "$lib/components/about/OtherCredits.svelte";
	import GHContributors from "$lib/components/about/GHContributors.svelte";
	import { onDestroy, onMount } from "svelte";
	import { getVersion } from "@tauri-apps/api/app";
	import { error } from "$lib/log";
	import { t } from "$lib/lang";

	let appVersion = $state("0.0.0");
	let showingEasterEgg = $state(false);

	onMount(async () => {
		try {
			appVersion = await getVersion();
		} catch (err) {
			error("Failed to fetch app version:", err);
		}
	});

	const contributors = [
		{
			pfp: "/pfp/jovannmc.png",
			name: "JovannMC (Maya)",
			byline: $t("about.contributors.byline.jovannmc"), // Developer, has a tail
			links: [
				{ icon: "ri:link", url: "https://jovann.me" },
				{ icon: "ri:github-fill", url: "https://github.com/JovannMC" },
			],
		},
		{
			pfp: "/pfp/bracketproto.png",
			name: "BracketProto",
			byline: $t("about.contributors.byline.bracketproto"), // Developer, loves scugs
			links: [
				{ icon: "ri:link", url: "https://bracketproto.com" },
				{ icon: "ri:github-fill", url: "https://github.com/OCSYT" },
			],
		},
		{
			pfp: "/pfp/realmy.jpg",
			name: "Realmy",
			byline: $t("about.contributors.byline.realmy"), // UI designer, growls occasionally
			links: [
				{ icon: "ri:link", url: "https://realmy.net" },
				{ icon: "ri:github-fill", url: "https://github.com/RealmyTheMan" },
			],
		},
	];

	const contributorsEasterEgg = [
		{
			pfp: "/pfp/easter-egg/joe-van.png",
			name: "Joe-van",
			byline: $t("about.contributors.easter_egg.joe-van"), // Has Joe Biden, is a van, maybe a Joe-van
			links: [
				{ icon: "ri:link", url: "https://jovann.me" },
				{ icon: "ri:github-fill", url: "https://github.com/JovannMC" },
			],
		},
		{
			pfp: "/pfp/bracketproto.png",
			name: "BracketProto",
			byline: $t("about.contributors.easter_egg.bracketproto"), // Developer, loves scugs
			links: [
				{ icon: "ri:link", url: "https://bracketproto.com" },
				{ icon: "ri:github-fill", url: "https://github.com/OCSYT" },
			],
		},
		{
			pfp: "/pfp/realmy.jpg",
			name: "Grrealmy",
			byline: $t("about.contributors.easter_egg.grrealmy"), // grrgrgrhrtgrgrrrgtdg!!!grrr!!! !!
			links: [
				{ icon: "ri:link", url: "https://realmy.net" },
				{ icon: "ri:github-fill", url: "https://github.com/RealmyTheMan" },
			],
		},
	];

	const ghContribs = [
		{
			name: "Lillith",
			link: "https://github.com/lillithkt",
			pfp: "/pfp/lillithkt.png",
		},
		{
			name: "Francesca",
			link: "https://github.com/francescatanuki",
			pfp: "/pfp/francescatanuki.png",
		},
	];

	const translators = [
		{
			language: "English",
			contributors: [
				{
					name: "JovannMC",
					pfp: "/pfp/jovannmc.png",
					link: "https://github.com/JovannMC",
				},
				{
					name: "Realmy",
					pfp: "/pfp/realmy.jpg",
					link: "https://github.com/RealmyTheMan",
				},
			],
		},
		{
			language: "Japanese",
			contributors: [
				{
					name: "pikepikeid",
					pfp: "/pfp/pikepikeid.png",
					link: "https://github.com/pikepikeid",
				},
			],
		},
		{
			language: "uwu language",
			contributors: [
				{
					name: "JowannUwU, your sleep paralysis demon",
					pfp: "/pfp/jovannmc.png",
					link: "https://github.com/JovannMC",
				},
			],
		},
	];

	const others = [
		{
			name: "haritorax-interpreter",
			link: "https://github.com/JovannMC/haritorax-interpreter",
			author: "JovannMC",
		},
		{
			name: "haritorax-slimevr-bridge",
			link: "https://github.com/sim1222/haritorax-slimevr-bridge",
			author: "sim1222",
		},
		{
			name: "slimevr-rust",
			link: "https://github.com/SlimeVR/slimevr-rust",
			author: "SlimeVR",
		},
		{
			name: "slimevr-node",
			link: "https://github.com/SlimeVR/slimevr-node",
			author: "SlimeVR",
		},
		{
			name: "MoSlime",
			link: "https://MoSlime/MoSlime",
			author: "MoSlime",
		},
		{
			name: "Onboarding media",
			link: "https://github.com/SlimeVR/SlimeVR-Server",
			author: "SlimeVR",
		},
	];

	onMount(() => {
		// funny easter egg if holding shift
		document.addEventListener("keydown", (event) => {
			if (event.key === "Shift") {
				showingEasterEgg = true;
			}
		});
		document.addEventListener("keyup", (event) => {
			if (event.key === "Shift") {
				showingEasterEgg = false;
			}
		});
	});

	onDestroy(() => {
		// remove event listeners
		document.removeEventListener("keydown", () => {});
		document.removeEventListener("keyup", () => {});
	});
</script>

<div class="flex flex-col items-center">
	<div class="flex flex-col items-center p-4">
		<div class="bg-panel rounded-xl p-4 shadow flex flex-col items-center gap-4 w-full">
			<div class="flex items-center gap-3">
				<img src="/logo.png" alt="SlimeTora Logo" class="w-14 h-14 rounded-lg drop-shadow-lg" />
				<span class="text-3xl font-heading font-bold text-text"
					>SlimeTora <span class="text-xs text-text-alt">v{appVersion}</span></span
				>
			</div>
			<p class="text-center text-base text-text-alt max-w-lg">
				{$t("about.description")}
			</p>
		</div>
	</div>
	<div class="flex flex-row gap-8 p-4">
		<div class="flex flex-col gap-8">
			<ContributorsPanel contributors={!showingEasterEgg ? contributors : contributorsEasterEgg} />
			<GHContributors {ghContribs} />
		</div>
		<div class="flex flex-col gap-8 flex-1">
			<TranslatorsPanel {translators} />
			<OtherCreditsPanel {others} />
		</div>
	</div>
	<!-- <div class="flex flex-col items-center p-4">
		<div class="bg-panel rounded-xl p-4 shadow flex flex-col items-center gap-4 w-full">
			<div class="flex items-center gap-3">
				<img src="/logo.png" alt="SlimeTora Logo" class="w-14 h-14 rounded-lg drop-shadow-lg" />
				<span class="text-3xl font-heading font-bold text-text">SlimeTora <span class="text-xs text-text-alt">v{appVersion}</span></span>
			</div>
			<p class="text-center text-base text-text-alt">
				SlimeTora is a middleware program that allows you to connect the HaritoraX trackers to the
				SlimeVR server instead of the OEM software.
			</p>
		</div>
	</div> -->
</div>
