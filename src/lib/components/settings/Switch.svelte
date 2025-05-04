<script lang="ts">
    interface Props {
        label?: string;
        selected: boolean;
        onChange: (selected: boolean) => void;
        className?: string;
    }

    let { label, selected, onChange, className }: Props = $props();
    const uniqueId = `switch-${Math.random().toString(36).substring(2, 9)}`;

    function handleChange(event: Event) {
        const target = event.target as HTMLInputElement;
        onChange(target.checked);
    }
</script>

<div class="relative flex items-center gap-3 {className}">
    <input
        type="checkbox"
        class="peer sr-only"
        bind:checked={selected}
        onchange={handleChange}
        id={uniqueId}
    />
    <label
        for={uniqueId}
        class="w-10 h-5 {selected
            ? 'bg-primary'
            : 'bg-quaternary'} rounded-full transition-colors duration-200 relative cursor-pointer"
    >
        <span
            class="absolute w-4 h-4 bg-white rounded-full transition-all duration-200 top-1/2 -translate-y-1/2
                {selected ? 'translate-x-5' : 'translate-x-0.5'}"
        ></span>
    </label>
    <span class="font-medium select-none">{label}</span>
</div>