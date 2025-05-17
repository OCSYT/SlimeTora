import { appConfigDir, join } from "@tauri-apps/api/path";
import { readDir, readTextFile, exists } from "@tauri-apps/plugin-fs";
import i18n, { type Config } from "sveltekit-i18n";
import { browser } from "$app/environment";
import { info, error } from "$lib/log";
import { writable, type Readable, type Writable } from "svelte/store";
interface Params {
	value: any;
}

async function createI18nConfig(): Promise<Config<Params>> {
	const defaultConfig: Config<Params> = {
		initLocale: "en",
		fallbackLocale: "en",
		loaders: [],
	};

	if (browser) {
		try {
			const baseAppConfigPath = await appConfigDir();
			const langDirPath = await join(baseAppConfigPath, "langs");

			info(`Attempting to load language files from: ${langDirPath}`);

			if (!(await exists(langDirPath))) {
				error(`Language directory does not exist: ${langDirPath}.`);
				return defaultConfig;
			}

			const files = await readDir(langDirPath);
			info(`Files found in ${langDirPath}: ${files.map((f) => f.name ?? "[unknown]").join(", ")}`);

			const loaders = await Promise.all(
				files
					.filter((file) => file.isFile && file.name?.endsWith(".json"))
					.map(async (fileEntry) => {
						const locale = fileEntry.name!.replace(".json", "");
						const filePath = await join(langDirPath, fileEntry.name!);
						return {
							locale,
							key: "",
							loader: async () => {
								const content = await readTextFile(filePath);
								return JSON.parse(content);
							},
						};
					}),
			);
			if (!defaultConfig.loaders) defaultConfig.loaders = [];
			defaultConfig.loaders.push(...loaders);
			info(`Configured loaders for locales: ${loaders.map((l) => l.locale).join(", ")}`);
		} catch (err: any) {
			error(`Error preparing language loaders: ${err.message || err}`);
		}
	}
	return defaultConfig;
}

// honestly, i have no idea what this does, but this is so we can actually build
// the damn tauri app lmfao. basically, it would have empty entries at first, and then
// it will load the actual functions when subscribed, since we can't do top-level awaits

// --- Add these placeholder stores and function ---
const _t = writable((key: string) => key);
const _loading = writable(true);
const _locales = writable<string[]>([]);
const _locale = writable<string | null>(null);
const _initialized = writable(false);
const _translations = writable<any>({});
type LoadTranslationsArgs = Parameters<typeof i18n.prototype.loadTranslations>;
let _loadTranslationsFunc: (
	...args: LoadTranslationsArgs
) => ReturnType<typeof i18n.prototype.loadTranslations> = async () => {};

// --- Export these proxies instead of destructuring from i18nInstance ---
export const t = _t as Readable<(key: string, params?: any) => string>;
export const loading = _loading as Readable<boolean>;
export const locales = _locales as Readable<string[]>;
export const locale = _locale as Writable<string | null>;
export const initialized = _initialized as Readable<boolean>;
export const translations = _translations as Readable<any>;
export const loadTranslations = (...args: LoadTranslationsArgs) => _loadTranslationsFunc(...args);

// --- Update your async init to sync these proxies ---
createI18nConfig().then((config) => {
	const instance = new i18n(config);
	instance.t.subscribe((val) => _t.set(val));
	instance.loading.subscribe((val) => _loading.set(val));
	instance.locales.subscribe((val) => _locales.set(val));
	instance.locale.subscribe((val) => _locale.set(val));
	instance.initialized.subscribe((val) => _initialized.set(val));
	instance.translations.subscribe((val) => _translations.set(val));
	_loadTranslationsFunc = instance.loadTranslations;
});
