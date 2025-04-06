<script lang="ts">
    import { goto } from "$app/navigation";
    import { isOn } from "$lib/store";
    import Icon from "@iconify/svelte";
	import { listen } from "@tauri-apps/api/event";
    import { onMount } from "svelte";

    onMount(async () => {
        isOn.subscribe((value) => {
            const status = document.getElementById("tracker-status")!;
            const count = document.getElementById("tracker-count")!;
            const button = document.querySelector(".power-button")!;

            if (value) {
                status.innerText = "Trackers are connected";
                button.classList.add("connected");
            } else {
                status.innerText = "Trackers are not connected";
                button.classList.remove("connected");
                count.innerText = "0";
            }
        });

        listen("device_connected", () => {
            // increment the count of connected trackers
            const count = document.getElementById("tracker-count")!;
            const currentCount = parseInt(count.innerText);
            count.innerText = (currentCount + 1).toString();
        });

        listen("device_disconnected", () => {
            // decrement the count of connected trackers
            const count = document.getElementById("tracker-count")!;
            const currentCount = parseInt(count.innerText);
            count.innerText = (currentCount - 1).toString();
        });
    });
</script>

<div class="flex flex-col justify-center items-center w-full h-full gap-12">
    <div class="power-button-bg"></div>

    <p class="text-2xl font-heading" id="tracker-status">Trackers are not connected</p>
    <button class="power-button hoverable" onclick={() => isOn.update((value) => !value)}>
        <Icon class="icon text-white" icon="ri:shut-down-line" width={78} />
    </button>
    <p class="text-xl text-text-alt font-heading"><span id="tracker-count">0</span> connected trackers</p>

    <button onclick={() => goto("/onboarding")}>Open onboarding</button>
</div>

<style>
    @reference "../../app.css";

    .power-button-bg {
        @apply absolute w-[200px] h-[200px] z-[-10];
        background: linear-gradient(135deg, #9a48ee 0%, #f05d38 100%);
        filter: blur(100px);
    }

    .power-button {
        @apply w-[200px] h-[200px] flex justify-center items-center rounded-full shadow-lg relative hover:bg-secondary/24 active:bg-secondary/12;
        background: var(--slimetora-gradient-alt);
    }

    .power-button:global(.connected) {
        background: var(--slimetora-gradient);
        z-index: 0;
    }

    .power-button:global(.connected)::before {
        background: rgba(0, 0, 0, 0.2);
    }

    .power-button::before {
        @apply absolute inset-0 rounded-full p-1 z-[-1];
        content: "";
        background: linear-gradient(180deg, #f05d38 0%, #9a48ee 100%);
        mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
        mask-composite: exclude;
    }
</style>
