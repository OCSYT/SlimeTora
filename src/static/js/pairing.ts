import { PairingCard } from "./templates/pairing-card.js";

const params = new URLSearchParams(window.location.search);
const ports = JSON.parse(params.get("ports"));

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

    await populateComPorts();
    updateComPorts();
});

async function populateComPorts() {
    const columnsDiv = document.querySelector(".columns.is-multiline");

    ports.forEach((port: string) => {
        window.log(`Found COM port: ${port}`, "pairing");
        const comPortDiv = document.createElement("div");
        comPortDiv.classList.add("column", "is-12");
        comPortDiv.innerHTML = PairingCard(port);
        columnsDiv.appendChild(comPortDiv);
    });

    return true;
}

async function updateComPorts() {
    // get the COM ports and update the status/tracker of each
    // for every element with class card, get the tracker port and ID of each
    const paired = await t("pairing.card.id.status.paired");
    const unpaired = await t("pairing.card.id.status.unpaired");
    const none = await t("pairing.card.id.tracker.none");

    const cards = document.querySelectorAll(".card");
    cards.forEach(async (card) => {
        const port = card.id.replace("com-port-", "");
        if (!port) return;

        // Get all port IDs within the card
        const portIdElements = card.querySelectorAll(".card-content .card-header-title");
        portIdElements.forEach(async (portIdElement) => {
            const portId = portIdElement.textContent.replace("Port ID ", "").trim();
            if (!portId || isNaN(parseInt(portId))) return;

            const trackerName = await window.ipc.invoke("get-tracker-from-info", { port, portId });
            window.log(`Tracker name for ${port}, ${portId}: ${trackerName}`);

            const trackerElement = portIdElement.parentElement.parentElement.querySelector("#tracker");
            if (trackerElement && trackerName) trackerElement.textContent = trackerName;

            const statusElement = portIdElement.parentElement.parentElement.querySelector("#status");
            if (statusElement) statusElement.textContent = trackerName ? paired : unpaired;
        });
    });
}

function manageTracker(element: string) {
    const match = element.match(/^(.*)-manage-(.*)$/);
    if (!match) throw new Error("Invalid element format");

    const port = match[1];
    const portId = match[2];

    window.ipc.send("manage-tracker", { port, portId });
}

const t = window.translate;
window.manageTracker = manageTracker;

// Required to prevent variable conflicts from other files
export {};
