export function PairingCard(port: string): string {
    return `
            <div class="card" id="com-port-${port}">
                <header class="card-header">
                    <div>
                        <p
                            class="card-header-title with-padding is-centered inline-block"
                            data-i18n="pairing.card.title"
                        >
                            COM port:
                        </p>
                        <span class="has-text-white has-text-weight-bold" id="port-name">${port}</span>
                    </div>
                </header>
                <div class="card-content">
                    <div class="content">
                        <div class="columns">
                            <!-- Port ID 0 section -->
                            <div class="column is-6" id="port-id-0">
                                <div class="card">
                                    <header class="card-header">
                                        <p class="card-header-title" data-i18n="pairing.card.id.title.0">
                                            Port ID 0
                                        </p>
                                    </header>
                                    <div class="card-content">
                                        <div>
                                            <p class="inline-block" data-i18n="pairing.card.id.status.title">
                                                Status:
                                            </p>
                                            <span id="status">Unpaired</span>
                                        </div>
                                        <div>
                                            <p class="inline-block" data-i18n="pairing.card.id.tracker.title">
                                                Tracker:
                                            </p>
                                            <span id="tracker">N/A</span>
                                        </div>
                                    </div>
                                    <div class="card-footer">
                                        <div class="card-footer-item">
                                            <button
                                                class="button is-info"
                                                onclick="manageTracker('${port}-manage-0')"
                                                data-i18n="pairing.card.id.manage"
                                            >
                                                Pair/Unpair
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- Port ID 1 section -->
                            <div class="column is-6" id="port-id-1">
                                <div class="card">
                                    <header class="card-header">
                                        <p class="card-header-title" data-i18n="pairing.card.id.title.1">
                                            Port ID 1
                                        </p>
                                    </header>
                                    <div class="card-content">
                                        <div>
                                            <p class="inline-block" data-i18n="pairing.card.id.status.title">
                                                Status:
                                            </p>
                                            <span id="status">Unpaired</span>
                                        </div>
                                        <div>
                                            <p class="inline-block" data-i18n="pairing.card.id.tracker.title">
                                                Tracker:
                                            </p>
                                            <span id="tracker">N/A</span>
                                        </div>
                                    </div>
                                    <div class="card-footer">
                                        <div class="card-footer-item">
                                            <button
                                                class="button is-info"
                                                onclick="manageTracker('${port}-manage-1')"
                                                data-i18n="pairing.card.id.manage"
                                            >
                                                Pair/Unpair
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <div class="card-footer-item">
                        <button
                            class="button is-info"
                            onclick="manageTracker('${port}-manage-all')"
                            data-i18n="pairing.card.manage"
                        >
                            Unpair all
                        </button>
                    </div>
                    <div class="card-footer-item">
                        <div class="select">
                            <select id="channel-select">
                                <!-- Port channels get populated here -->
                            </select>
                        </div>
                    </div>
                </div>
            </div>
    `;
}
