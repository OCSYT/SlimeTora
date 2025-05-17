import { appConfigDir, join } from "@tauri-apps/api/path";
import { readDir, readTextFile, exists } from "@tauri-apps/plugin-fs";
import i18n, { type Config } from "sveltekit-i18n";
import { browser } from "$app/environment";
import { info, error } from "$lib/log";

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
				error(
					`Language directory does not exist: ${langDirPath}.`,
				);
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

const i18nConfig = await createI18nConfig();
const i18nInstance = new i18n(i18nConfig);

export const { t, loading, locales, locale, initialized, translations, loadTranslations } = i18nInstance;
