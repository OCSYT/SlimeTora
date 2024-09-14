import { PairingCard } from "./templates/pairing-card.js";

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

    populateComPorts();
});

async function populateComPorts() {
    const comPorts = await window.ipc.invoke("get-com-ports", null);
    const columnsDiv = document.querySelector(".columns.is-multiline");

    comPorts.forEach((port: string) => {
        const comPortDiv = document.createElement("div");
        comPortDiv.classList.add("column", "is-12");
        comPortDiv.innerHTML = PairingCard(port);
        columnsDiv.appendChild(comPortDiv);
    });
}

// Required to prevent variable conflicts from other files
export {};
