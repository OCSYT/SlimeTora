// Tauri doesn't have a Node.js server to do proper SSR
// so we will use adapter-static to prerender the app (SSG)
// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
import type { LayoutLoad } from "./$types";
import { browser } from "$app/environment";
import { loadTranslations } from "$lib/lang";

export const prerender = true;
export const ssr = false;

export const load: LayoutLoad = async ({ url }) => {
	const { pathname } = url;
	const initLocale = getInitialLocale();

	try {
		await loadTranslations(initLocale, pathname);
	} catch (error) {
		console.error(`[i18n]: Failed to load translation for locale '${initLocale}' and route '${pathname}'. Error:`, error);
	}

	return { locale: initLocale, route: pathname };
};

function getInitialLocale(): string {
	if (browser) {
		try {
			return window.navigator.language.split("-")[0];
		} catch (e) {
			return "en";
		}
	}

	return "en";
}
