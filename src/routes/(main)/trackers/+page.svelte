<script lang="ts">
	import { goto } from "$app/navigation";
	import Card from "$lib/components/trackers/Card.svelte";
	import Icon from "@iconify/svelte";
</script>

<div class="flex flex-col p-4">
    <!-- god damn it why do i have to do it like this, i gotta alternate add between these two in the code -->
    <div class="flex flex-row gap-x-4">
        <div class="flex flex-col gap-y-4 flex-1" id="left-column">
            <Card trackerName="Tracker 1" trackerId="1" />
            <Card trackerName="Tracker 3" trackerId="3" />
            <Card trackerName="Tracker 5" trackerId="5" />
        </div>
        <div class="flex flex-col gap-y-4 flex-1" id="right-column">
            <Card trackerName="Tracker 2" trackerId="2" />
            <Card trackerName="Tracker 4" trackerId="4" />
        </div>
    </div>
    <!--  settings panel -->
    
    <div class="bg-panel w-full mt-8 p-6 rounded-lg shadow">
        <h2 class="text-lg font-semibold mb-4">Settings</h2>
        <div class="flex flex-row gap-4">
            <label class="flex items-center gap-x-2">
                <input type="checkbox" />
                <span>Write logs</span>
            </label>
            <label class="flex items-center gap-x-2">
                <span>Logging mode</span>
                <select>
                    <option value="minimal">Minimal data</option>
                    <option value="debug">Debug data</option>
                    <option value="all">All data (!!!)</option>
                </select>
            </label>
            <label class="flex items-center gap-x-2">
                <input type="checkbox" />
                <span>Bypass serial limit</span>
            </label>
        </div>
    </div>
</div>