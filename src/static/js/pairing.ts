import { PairingCard } from "./templates/pairing-card.js";

const params = new URLSearchParams(window.location.search);
const ports = JSON.parse(params.get("ports"));

let paired: string;
let unpaired: string
let pairing: string;
let none: string;

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

    paired = await t("pairing.card.id.status.paired");
    unpaired = await t("pairing.card.id.status.unpaired");
    pairing = await t("pairing.card.id.status.pairing");
    none = await t("pairing.card.id.tracker.none");

    populateComPorts();
    updateComPorts();
});

window.ipc.on("device-paired", (_event, arg) => {
    const { trackerName, port, portId } = arg;

    window.log(`Received paired device: ${trackerName} on ${port} with ID ${portId}`, "pairing");

    const portElement = document.querySelector(`#com-port-${CSS.escape(port)}`);
    if (!portElement) return;

    const portIdElement = portElement.querySelector(`#port-id-${portId}`);
    if (!portIdElement) return;

    const statusElement = portIdElement.querySelector("#status");
    if (statusElement) statusElement.textContent = paired;

    const trackerElement = portIdElement.querySelector("#tracker");
    if (trackerElement) trackerElement.textContent = trackerName;

    window.log(`Updated status of ${port} with ID ${portId} to paired`, "pairing");
});

function populateComPorts() {
    const columnsDiv = document.querySelector(".columns.is-multiline");
    if (!columnsDiv) return;

    ports.forEach((port: string) => {
        window.log(`Found COM port: ${port}`, "pairing");
        const comPortDiv = document.createElement("div");
        comPortDiv.classList.add("column", "is-12");
        comPortDiv.innerHTML = PairingCard(port);
        columnsDiv.appendChild(comPortDiv);
    });

    return;
}

function updateComPorts() {
    // get the COM ports and update the status/tracker of each
    // for every element with class card, get the tracker port and ID of each
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

async function manageTracker(element: string) {
    const match = element.match(/^(.*)-manage-(.*)$/);
    if (!match) throw new Error("Invalid element format");

    let port = match[1];
    const escapedPort = CSS.escape(port);
    const portId = match[2];

    const statusElement = document.querySelector(`#com-port-${escapedPort} #port-id-${portId} #status`);
    if (!statusElement) return;

    let status = statusElement.textContent === paired ? "paired" : "unpaired";

    // Simulate cancellation of pairing if status is "pairing"
    if (statusElement.textContent === pairing) {
        window.log("Cancelling pairing", "pairing");
        status = "paired";
    }

    const response = await window.ipc.invoke("manage-tracker", { port, portId, status });

    // If response is true, has started pairing, otherwise has been unpaired
    const newStatus = response ? pairing : unpaired;
    if (statusElement) statusElement.textContent = newStatus;

    const trackerElement = document.querySelector(`#com-port-${escapedPort} #port-id-${portId} #tracker`);
    if (trackerElement) trackerElement.textContent = none;
}

const t = window.translate;
window.manageTracker = manageTracker;

// Required to prevent variable conflicts from other files
export {};
