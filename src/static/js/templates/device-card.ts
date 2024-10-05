export function NormalCard(deviceName: string, deviceID: string) {
    return `
        <div class="card" id="${deviceID}">
            <header class="card-header">
                <div>
                    <p class="card-header-title with-padding is-centered inline-block" data-i18n="trackerInfo.deviceName">
                        Device:
                    </p><span class="has-text-white has-text-weight-bold" id="device-name">${deviceName}</span>
                </div>
                <div class="edit-button-container">
                    <button id="edit-button" class="button is-info" data-i18n="trackerInfo.edit">Edit</button>
                </div>
            </header>
            <div class="card-content">
                <div class="content">
                    <p class="inline-block" data-i18n="trackerInfo.deviceID">Device ID:</p> <span id="device-id">${deviceID}</span><br />
                    <p class="inline-block" data-i18n="trackerInfo.rotationData">Rotation Data:</p> <span id="rotation-data">0, 0, 0</span><br />
                    <p class="inline-block" data-i18n="trackerInfo.accelerationData">Acceleration Data:</p> <span id="acceleration-data">0, 0, 0</span><br />
                    <p class="inline-block" data-i18n="trackerInfo.battery">Battery:</p> <span id="battery">N/A</span><br />
                    <p class="inline-block" data-i18n="trackerInfo.magStatus">Mag status:</p> <span id="mag-status"></span><br />
                </div>
            </div>
            <footer class="card-footer">
                <div class="card-footer-item">
                    <button id="tracker-settings-button" data-i18n="trackerInfo.settings" onclick="openTrackerSettings('${deviceID}')" class="button is-info" data-i18n="trackerInfo.settings">Override tracker settings</button>
                </div>
            </footer>
        </div>
    `;
}

export function CompactCard(deviceName: string, deviceID: string) {
    return `
        <div class="card" id="${deviceID}">
            <div class="card-content is-flex is-align-items-center is-justify-content-space-between">
                <div>
                    <p data-i18n="trackerInfo.deviceName">Battery:</p>
                    <span id="device-name">${deviceName}</span>
                </div>
                <div>
                    <button
                        id="edit-button"
                        class="button is-info is-small"
                        data-i18n="trackerInfo.edit"
                    >
                        Edit
                    </button>
                </div>
                <div>
                    <p data-i18n="trackerInfo.battery">Battery:</p>
                    <span id="battery">N/A</span>
                </div>
                <div>
                    <p data-i18n="trackerInfo.magStatus">Mag status:</p>
                    <span class="mr-2" id="mag-status"></span>
                </div>
                <div>
                    <button
                        id="tracker-settings-button"
                        class="button is-info is-small"
                        data-i18n="trackerInfo.settings"
                        onclick="openTrackerSettings('${deviceID}')"
                    >
                        Override settings
                    </button>
                </div>
            </div>
        </div>
    `
}