import { invoke } from '@tauri-apps/api/core';
import { writable, type Writable } from 'svelte/store';

export const isOn: Writable<Boolean | null> = writable(null);
isOn.subscribe(async (value) => {
    if (value) {
        await invoke('start');
    } else if (value === false) {
        await invoke('stop');
    }
});

export const currentPath = writable('/');
export const navLinks = [
    {
        name: "Home",
        icon: "ri:home-4-fill",
        link: "/",
    },
    {
        name: "Trackers",
        icon: "ri:gps-line",
        link: "/trackers",
    },
    {
        name: "Settings",
        icon: "ri:equalizer-line",
        link: "/settings",
    },
    {
        name: "About",
        icon: "ri:information-line",
        link: "/about",
    },
];
export const externalNavLinks = [
    {
        name: "GitHub",
        icon: "ri:github-line",
        link: "https://github.com/OCSYT/SlimeTora",
    },
    {
        name: "Docs",
        icon: "ri:book-marked-line",
        link: "https://github.com/OCSYT/SlimeTora/wiki",
    },
];