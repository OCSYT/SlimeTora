document.addEventListener("DOMContentLoaded", async () => {
    const i18nElements = document.querySelectorAll("[data-i18n]");
    const translationPromises: Promise<void>[] = [];

    i18nElements.forEach((element) => {
        const key = element.getAttribute("data-i18n");
        const translationPromise = window.translate(key).then((translation) => {
            if (translation && translation !== key) {
                // could be a slight security risk, but makes it so much easier to format text
                element.innerHTML = translation;
            }
        });
        translationPromises.push(translationPromise);
    });

    await Promise.all(translationPromises);
});

async function getSetting(key: string, defaultValue: any) {
    const exists = await window.ipc.invoke("has-setting", key);
    window.log(`Setting "${key}" exists with value: ${exists}`);
    return exists ? await window.ipc.invoke("get-setting", key) : defaultValue;
}

// Required to prevent variable conflicts from other files
export {};
