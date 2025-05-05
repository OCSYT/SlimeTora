<script lang="ts">
	import ProgramSettings from "$lib/components/settings/ProgramSettings.svelte";
	import ConnectionSettings from "$lib/components/settings/ConnectionSettings.svelte";
	import TrackerSettings from "$lib/components/settings/TrackerSettings.svelte";
	import AdvancedSettings from "$lib/components/settings/AdvancedSettings.svelte";
</script>

<!-- TODO: implement config saving/loading and log files -->
<!-- TODO: AND FIX THAT DAMN TIMEOUT ADMSKG -->
<div class="flex flex-col p-4 gap-8">
	<ProgramSettings />
	<ConnectionSettings />
	<TrackerSettings />
	<AdvancedSettings />
</div>
