<script>
    import { onNavigate } from "$app/navigation";
    import { currentPath } from "$lib/store";
    import "../app.css";
    import "@fontsource/chakra-petch";

    let { children } = $props();

    onNavigate((event) => {
        currentPath.set(event.to?.url.pathname ?? "/");
    });
</script>

{@render children()}
