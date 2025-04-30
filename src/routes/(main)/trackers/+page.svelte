<script lang="ts">
	import { goto } from "$app/navigation";
	import Card from "$lib/components/trackers/Card.svelte";
	import Icon from "@iconify/svelte";
</script>

<div class="flex flex-row gap-x-4 p-4">
    <!-- god damn it why do i have to do it like this, i gotta alternate add between these two in the code -->
    <div class="flex flex-col gap-y-4 flex-1" id="left-column">
        <Card trackerName="Tracker 1" trackerId="1" batteryLevel={100} />
        <Card trackerName="Tracker 3" trackerId="3" batteryLevel={50} />
        <Card trackerName="Tracker 5" trackerId="5" batteryLevel={20} />
    </div>
    <div class="flex flex-col gap-y-4 flex-1" id="right-column">
        <Card trackerName="Tracker 2" trackerId="2" batteryLevel={75} />
        <Card trackerName="Tracker 4" trackerId="4" batteryLevel={60} />
    </div>
</div>