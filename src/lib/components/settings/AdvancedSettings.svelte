<script lang="ts">
    import { invoke } from "@tauri-apps/api/core";
    import Icon from "@iconify/svelte";
    import Checkbox from "./Checkbox.svelte";
    import Select from "./Select.svelte";
	import Button from "./Button.svelte";
    
    let bypassSerialLimit = $state(false);
    let writeLogs = $state(false);
    let loggingMode = $state("minimal");
    
    async function openLogsFolder() {
        try {
            await invoke("open_logs_folder");
        } catch (error) {
            console.error("Failed to open logs folder:", error);
        }
    }
</script>

<div class="bg-panel rounded-lg p-6 shadow">
    <h2 class="text-2xl font-heading mb-6 flex items-center gap-2">
        <Icon icon="ri:tools-line" class="text-secondary" width={28} />
        Advanced Settings
    </h2>
    
    <div class="flex flex-col gap-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div class="flex flex-col gap-4">
                <h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
                    Serial Settings
                    <Icon icon="ri:information-line" width={20} class="text-text-alt hover:text-white transition-colors" />
                </h3>
                <div class="flex flex-col gap-3 pl-1">
                    <Checkbox
                        label="Bypass serial port limit"
                        checked={bypassSerialLimit}
                        onChange={(value) => (bypassSerialLimit = value)}
                    />
                </div>
            </div>
            
            <div class="flex flex-col gap-4">
                <h3 class="text-lg font-heading flex items-center gap-2 pb-2 border-b border-secondary/50">
                    Logging
                    <Icon icon="ri:information-line" width={20} class="text-text-alt hover:text-white transition-colors" />
                </h3>
                <div class="flex flex-col gap-3 pl-1">
                    <Checkbox
                        label="Write logs"
                        checked={writeLogs}
                        onChange={(value) => (writeLogs = value)}
                    />
                    <Select
                        label="Logging Mode"
                        options={[
                            { value: "minimal", label: "Minimal data" },
                            { value: "debug", label: "Debug data" },
                            { value: "all", label: "All data (!!!)" }
                        ]}
                        selected={loggingMode}
                        onChange={(value) => (loggingMode = value)}
                    />
                    <div class="mt-2">
                        <Button
                            label="Open Logs Folder"
                            icon="ri:folder-open-line"
                            iconPosition="left"
                            background="quaternary"
                            onClick={openLogsFolder}
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>