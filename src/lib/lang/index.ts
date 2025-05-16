import i18n, { type Config } from "sveltekit-i18n";
import fs from "fs";
import path from "path";
const config: Config = {
    initLocale: "en",
    loaders: [
        {
            locale: "en",
            key: "",
            loader: async () => (await import("./en.json")).default,
        },
        // dynamically load all other language JSON files
        // TODO: probably copy translation files to app directory and load translations from there instead on first launch / doesnt exist, to allow users to make their own translations easily / add new ones
        ...(() => {
            try {
                const langDir = path.resolve(__dirname, "./lang");
                const files = fs.readdirSync(langDir);
                return files
                    .filter(file => file.endsWith(".json") && file !== "en.json")
                    .map(file => {
                        const locale = file.replace(".json", "");
                        return {
                            locale,
                            key: "",
                            loader: async () => (await import(`./lang/${file}`)).default,
                        };
                    });
            } catch (error) {
                console.error(`Error loading language files: ${error}`);
                return [];
            }
        })(),
    ],
};

export const { t, loading, locales, locale, initialized, translations, loadTranslations } = new i18n(config);
