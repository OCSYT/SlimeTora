import { appConfigDir, join } from "@tauri-apps/api/path";
import { readTextFile, exists } from "@tauri-apps/plugin-fs";
import { browser } from "$app/environment";
import { info, error } from "$lib/log";
import { writable, derived } from "svelte/store";

type Translations = Record<string, any>;
type TranslationParams = Record<string, string | number>;

const AVAILABLE_LOCALES = ["en", "ja"];
const DEFAULT_LOCALE = "en";

export const locale = writable<string>(DEFAULT_LOCALE);
export const translations = writable<Record<string, Translations>>({});
export const loading = writable<boolean>(true);
export const initialized = writable<boolean>(false);

export const locales = writable<string[]>(AVAILABLE_LOCALES);

function getNestedValue(obj: any, path: string): any {
	return path.split(".").reduce((current, key) => {
		return current && typeof current === "object" ? current[key] : undefined;
	}, obj);
}

function replaceVariables(text: string, params: TranslationParams = {}): string {
	return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
		return params[key]?.toString() || match;
	});
}

export const t = derived([translations, locale], ([$translations, $locale]) => {
	return (key: string, params: TranslationParams = {}): string => {
		const localeTranslations = $translations[$locale];

		if (!localeTranslations) {
			console.warn(`No translations found for locale: ${$locale}`);
			return key;
		}

		const normalizedKey = key.toLowerCase();

		function getCaseInsensitiveNestedValue(obj: any, path: string): any {
			return path.split(".").reduce((current, keyPart) => {
				if (current && typeof current === "object") {
					const foundKey = Object.keys(current).find((k) => k.toLowerCase() === keyPart.toLowerCase());
					return foundKey ? current[foundKey] : undefined;
				}
				return undefined;
			}, obj);
		}

		const value = getCaseInsensitiveNestedValue(localeTranslations, normalizedKey);

		if (typeof value === "string") {
			return replaceVariables(value, params);
		}

		// fallback to default locale if translation not found
		if ($locale !== DEFAULT_LOCALE) {
			const fallbackValue = getCaseInsensitiveNestedValue($translations[DEFAULT_LOCALE], normalizedKey);
			if (typeof fallbackValue === "string") {
				return replaceVariables(fallbackValue, params);
			}
		}

		// return key if no translation found
		console.warn(`Translation not found for key: ${key}`);
		return key;
	};
});

async function loadLocaleTranslations(targetLocale: string): Promise<Translations | null> {
	if (!browser) return null;

	try {
		const baseAppConfigPath = await appConfigDir();
		const filePath = await join(baseAppConfigPath, "langs", `${targetLocale}.json`);

		if (await exists(filePath)) {
			const content = await readTextFile(filePath);
			const parsed = JSON.parse(content);
			info(`Loaded translations for locale: ${targetLocale}`);
			return parsed;
		} else {
			error(`Translation file not found: ${filePath}`);
			return null;
		}
	} catch (err: any) {
		error(`Error loading translations for ${targetLocale}: ${err.message || err}`);
		return null;
	}
}

export async function initTranslations(initialLocale: string = DEFAULT_LOCALE): Promise<void> {
	if (!browser) return;

	loading.set(true);

	try {
		const allTranslations: Record<string, Translations> = {};

		// load all available locales in %identifier%/langs/
		for (const loc of AVAILABLE_LOCALES) {
			const localeTranslations = await loadLocaleTranslations(loc);
			if (localeTranslations) {
				allTranslations[loc] = localeTranslations;
			}
		}

		translations.set(allTranslations);

		if (AVAILABLE_LOCALES.includes(initialLocale)) {
			locale.set(initialLocale);
		} else {
			locale.set(DEFAULT_LOCALE);
		}

		initialized.set(true);
		info(`Translations initialized. Available locales: ${Object.keys(allTranslations).join(", ")}`);
	} catch (err: any) {
		error(`Failed to initialize translations: ${err.message || err}`);
	} finally {
		loading.set(false);
	}
}

export function changeLocale(newLocale: string): void {
	if (AVAILABLE_LOCALES.includes(newLocale)) {
		locale.set(newLocale);
		info(`Locale changed to: ${newLocale}`);
	} else {
		error(`Unsupported locale: ${newLocale}. Available locales: ${AVAILABLE_LOCALES.join(", ")}`);
	}
}
