<script lang="ts">
    import Icon from "@iconify/svelte";
    import { invoke } from "@tauri-apps/api/core";

    function toggleConnection() {
        // example rn
        const status = document.getElementById("tracker-status")!;
        const count = document.getElementById("tracker-count")!;
        const button = document.querySelector(".power-button")!;

        if (status.innerText === "Trackers are not connected") {
            status.innerText = "Trackers are connected";
            count.innerText = "2";
            button.classList.add("connected");
            invoke("start");
        } else {
            status.innerText = "Trackers are not connected";
            count.innerText = "0";
            button.classList.remove("connected");
            invoke("stop");
        }
    }
</script>

<div class="flex flex-col justify-center items-center w-full h-full gap-12">
    <div class="power-button-bg"></div>

    <p class="text-2xl font-heading" id="tracker-status">Trackers are not connected</p>
    <button class="power-button" onclick={toggleConnection}>
        <Icon class="icon text-white" icon="ri:shut-down-line" width={78} />
    </button>
    <p class="text-xl text-text-alt font-heading"><span id="tracker-count">0</span> connected trackers</p>
</div>

<style>
    @reference "../../app.css";

    .power-button-bg {
        @apply absolute w-[200px] h-[200px] rounded-full z-[-10];
        background: linear-gradient(135deg, #9a48ee 0%, #f05d38 100%);
        filter: blur(100px);
    }

    .power-button {
        @apply w-[200px] h-[200px] flex justify-center items-center rounded-full shadow-lg relative;
        background: var(--slimetora-gradient-alt);
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

    button:hover {
        @apply bg-secondary/24;
    }

    button:active {
        @apply bg-secondary/12;
    }
</style>
