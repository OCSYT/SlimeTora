<script lang="ts">
	import ContributorsPanel from "$lib/components/about/Contributors.svelte";
	import TranslatorsPanel from "$lib/components/about/Translators.svelte";
	import OtherCreditsPanel from "$lib/components/about/OtherCredits.svelte";

	const contributors = [
		{
			pfp: "/pfp/jovannmc.png",
			name: "JovannMC",
			byline: "Developer, has a tail",
			links: [
				{ icon: "ri:github-fill", url: "https://github.com/JovannMC" },
				{ icon: "ri:link", url: "https://jovann.me" },
			],
		},
		{
			pfp: "/pfp/bracketproto.png",
			name: "BracketProto",
			byline: "Developer, loves scugs",
			links: [
				{ icon: "ri:github-fill", url: "https://github.com/OCSYT" },
				{ icon: "ri:link", url: "https://bracketproto.com" },
			],
		},
		{
			pfp: "/pfp/realmy.jpg",
			name: "Realmy",
			byline: "UI designer, growls occasionally",
			links: [
				{ icon: "ri:github-fill", url: "https://github.com/Realmy" },
				{ icon: "ri:link", url: "https://realmy.net" },
			],
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
					link: "https://github.com/Realmy",
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
					name: "JowannWC, your sleep paralysis demon",
					pfp: "/pfp/jovannmc.png",
					link: "https://github.com/JowannWC",
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
			name: "another-package",
			link: "https://example.com",
			author: "Mr. Blue Sky",
		},
		{
			name: "love-and-appreciation",
			link: "https://example.com",
			author: "ur mom",
		},
	];
</script>

<div class="flex flex-row gap-8 p-4">
	<div class="flex flex-col gap-8">
		<ContributorsPanel {contributors} />
		<OtherCreditsPanel {others} />
	</div>
	<div class="flex flex-col gap-8 flex-1">
		<TranslatorsPanel {translators} />
	</div>
</div>
