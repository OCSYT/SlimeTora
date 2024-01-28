const { app, BrowserWindow, ipcMain, screen } = require('electron');

const dgram = require('dgram');
const sock = dgram.createSocket('udp4');
const fs = require('fs');
const path = require('path');


const mainPath = app.isPackaged
    ? path.dirname(app.getPath('exe'))
    : __dirname;

const jsonFilePath = path.join(mainPath, 'store.json');

let inMemoryStore = {};
updateData();
ipcMain.handle('get-data', async (event, key) => {
    updateData();
    return inMemoryStore[key];
});

ipcMain.on('set-data', (event, { key, value }) => {
    inMemoryStore[key] = value;
    saveToJSON();
});

ipcMain.on('delete-data', (event, key) => {
    delete inMemoryStore[key];
    saveToJSON();
});


ipcMain.handle('has-data', async (event, key) => {
    updateData();
    return inMemoryStore.hasOwnProperty(key);
});


var allow_connection = false;
ipcMain.on('connection', (event, value) => {
    allow_connection = value;
});


function saveToJSON() {
    // Save the inMemoryStore to the JSON file
    const jsonData = JSON.stringify(inMemoryStore, null, 2);
    fs.writeFileSync(jsonFilePath, jsonData, 'utf8');
}
function updateData() {
    try {
        const data = fs.readFileSync(jsonFilePath, 'utf8');
        inMemoryStore = JSON.parse(data);
        //console.log(inMemoryStore);
    } catch (error) {
        // If the file doesn't exist or there is an error reading it, continue with an empty store
    }
}

var SLIME_IP = '0.0.0.0';
var SLIME_PORT = 6969;
let found = false;

var PACKET_COUNTER = 0;


sock.bind(9696, '0.0.0.0');

sock.on('message', (data, src) => {
    if (data.toString('utf-8').includes("Hey OVR =D")) {
        found = true;
        SLIME_IP = src.address;
        SLIME_PORT = src.port;
        console.log("Found SlimeVR at " + SLIME_IP + ":" + SLIME_PORT);
        PACKET_COUNTER += 1;
    }
});


function addIMU(trackerID) {
    var buffer = new ArrayBuffer(128);
    var view = new DataView(buffer);
    view.setInt32(0, 15);                           // packet 15 header
    view.setBigInt64(4, BigInt(PACKET_COUNTER)); // packet counter
    view.setInt8(12, trackerID);       // tracker id (shown as IMU Tracker #x in SlimeVR)
    view.setInt8(13, 0);                            // sensor status
    view.setInt8(14, 0);                    // imu type
    imuBuffer = new Uint8Array(buffer);

    sock.send(imuBuffer, SLIME_PORT, SLIME_IP, (err) => {
        if (err) {
            console.error('Error sending IMU packet:', err);
        } else {
            console.log(`Add IMU: ${trackerID}`);
            PACKET_COUNTER += 1;
        }
    });
}

let mainWindow;

let connectedDevices = [];

function stringToBinary(str) {
    let binaryString = '';

    for (let i = 0; i < str.length; i++) {
        const binaryChar = str[i].charCodeAt(0).toString(2);
        binaryString += '0'.repeat(8 - binaryChar.length) + binaryChar; // Ensure 8-bit representation
    }

    return binaryString;
}


function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            backgroundThrottling: false,
            preload: path.join(__dirname, 'preload.js')
        },
    });
    mainWindow.loadFile('./tracker/index.html');

    setInterval(() => {
        mainWindow.webContents.executeJavaScript(`
        document.activeElement.tagName.toUpperCase() !== 'INPUT' && document.activeElement.tagName.toUpperCase() !== 'TEXTAREA';
    `).then((result) => {
            if (result) {
                mainWindow.webContents.sendInputEvent({ type: 'mouseDown', x: 0, y: 0, button: 'left', clickCount: 1 });
                mainWindow.webContents.sendInputEvent({ type: 'mouseUp', x: 0, y: 0, button: 'left', clickCount: 1 });
            }
        }).catch((error) => {
            console.error(error);
        });
        // Get the position of the window
        const windowPosition = mainWindow.getPosition();
        const windowX = windowPosition[0];
        const windowY = windowPosition[1];

        // Get the size of the window
        const windowSize = mainWindow.getSize();
        const windowWidth = windowSize[0];
        const windowHeight = windowSize[1];

        // Calculate the coordinates relative to the window
        const xRelative = screen.getCursorScreenPoint().x; // Adjust as needed
        const yRelative = screen.getCursorScreenPoint().y; // Adjust as needed

        const x = xRelative - windowX;
        const y = yRelative - windowY - 50;
        mainWindow.webContents.sendInputEvent(
            { type: 'mouseMove', x: x, y: y });
    }, 1000);
    //fake user gesture

    mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
        event.preventDefault();

        const haritoraDevices = deviceList.filter(device =>
            device.deviceName.startsWith('HaritoraXW-') && !connectedDevices.includes(device.deviceName)
        );
        if (!allow_connection) {
            return;
        }
        if (haritoraDevices.length > 0) {
            const selectedDevice = haritoraDevices[0];
            console.log('Selected Haritora device:', selectedDevice.deviceName);
            if (connectedDevices.length == 0) {
                const fw_string = "Haritora";

                function buildHandshake() {
                    var buffer = new ArrayBuffer(128);
                    var view = new DataView(buffer);
                    var offset = 0;

                    view.setInt32(offset, 3);                                   // packet 3 header
                    offset += 4;
                    view.setBigInt64(offset, BigInt(PACKET_COUNTER));         // packet counter
                    offset += 8;
                    view.setInt32(offset, 0);                        // Board type
                    offset += 4;
                    view.setInt32(offset, 0);                          // IMU type
                    offset += 4;
                    view.setInt32(offset, 0);                          // MCU type
                    offset += 4;
                    for (var i = 0; i < 3; i++) {
                        view.setInt32(offset, 0);               // IMU info (unused)
                        offset += 4;
                    }
                    view.setInt32(offset, 0);                       // Firmware build
                    offset += 4;
                    view.setInt8(offset, fw_string.length);               // Length of fw string
                    offset += 1;
                    for (var i = 0; i < fw_string.length; i++) {
                        view.setInt8(offset, fw_string.charCodeAt(i));   // fw string
                        offset += 1;
                    }
                    var macAddress = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06];
                    for (var i = 0; i < macAddress.length; i++) {
                        view.setInt8(offset, macAddress[i]); // MAC address
                        offset += 1;
                    }

                    return new Uint8Array(buffer);
                }
                const handshake = buildHandshake();
                sock.send(handshake, 0, handshake.length, SLIME_PORT, SLIME_IP, (err) => {
                    if (err) {
                        console.error("Error sending handshake:", err);
                    }
                });
            }
            else {
                addIMU(connectedDevices.length);
            }
            connectedDevices.push(selectedDevice.deviceName);
            connectedDevices.sort();
            callback(selectedDevice.deviceId);
        } else {
            console.log('No available or connected Haritora devices.');
        }
    });

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.on('ready', createWindow);


let lastTimestamp = Date.now();
let tpsCounter = 0;
ipcMain.on('sendData', (event, postData) => {
    const deviceid = connectedDevices.indexOf(postData["deviceName"]);
    buildAccelAndSend(postData["acceleration"], deviceid);
    PACKET_COUNTER += 1;
    buildRotationAndSend(postData["rotation"], deviceid);
    PACKET_COUNTER += 1;
    if (postData["yawReset"] == true) {
        sendYawReset();
        PACKET_COUNTER += 1;
    }
    if (deviceid == 0) {
        sendBatteryLevel(postData["battery"]);
        PACKET_COUNTER += 1;
    }
    const currentTimestamp = Date.now();
    const timeDifference = currentTimestamp - lastTimestamp;
    if (deviceid == 0) {
        if (timeDifference >= 1000) {
            const tps = tpsCounter / (timeDifference / 1000);
            console.log(`TPS: ${tps}`);
            tpsCounter = 0;
            lastTimestamp = currentTimestamp;
        } else {
            tpsCounter += 1;
        }
    }
});

function sendYawReset() {
    var buffer = new ArrayBuffer(128);
    var view = new DataView(buffer);
    view.setInt32(0, 21);
    view.setBigInt64(4, BigInt(PACKET_COUNTER));
    view.setInt8(12, 3);
    sendBuffer = new Uint8Array(buffer);
    sock.send(sendBuffer, 0, sendBuffer.length, SLIME_PORT, SLIME_IP, (err) => {
        if (err) {
            console.error(`Error sending packet for sensor ${trackerId}:`, err);
        } else {

        }
    });
}

function sendBatteryLevel(batteryLevel) {
    var buffer = new ArrayBuffer(128);
    var view = new DataView(buffer);
    view.setInt32(0, 12);
    view.setBigInt64(4, BigInt(PACKET_COUNTER));
    view.setFloat32(12, 0);
    view.setFloat32(16, batteryLevel);
    sendBuffer = new Uint8Array(buffer);
    sock.send(sendBuffer, 0, sendBuffer.length, SLIME_PORT, SLIME_IP, (err) => {
        if (err) {
            console.error(`Error sending packet for sensor ${trackerId}:`, err);
        } else {

        }
    });
}


function buildAccelPacket(ax, ay, az, trackerID) {
    let buffer = new Uint8Array(128);
    let view = new DataView(buffer.buffer);

    view.setInt32(0, 4); // packet 4 header
    view.setBigInt64(4, BigInt(PACKET_COUNTER)); // packet counter
    view.setFloat32(12, ax);
    view.setFloat32(16, ay);
    view.setFloat32(20, az);
    view.setUint8(24, trackerID); // tracker id
    return buffer;
}





function buildAccelAndSend(acceleration, trackerId) {
    const ax = acceleration["x"];
    const ay = acceleration["y"];
    const az = acceleration["z"];
    const buffer = buildAccelPacket(ax, ay, az, trackerId);

    sock.send(buffer, 0, buffer.length, SLIME_PORT, SLIME_IP, (err) => {
        if (err) {
            console.error(`Error sending packet for sensor ${trackerId}:`, err);
        } else {

        }
    });
}

function buildRotationPacket(qx, qy, qz, qw, tracker_id) {
    let buffer = new Uint8Array(128);
    let view = new DataView(buffer.buffer);

    view.setInt32(0, 17);
    view.setBigInt64(4, BigInt(PACKET_COUNTER));
    view.setUint8(12, tracker_id);
    view.setUint8(13, 1);

    view.setFloat32(14, qx);
    view.setFloat32(18, qy);
    view.setFloat32(22, qz);
    view.setFloat32(26, qw);

    view.setUint8(30, 0);

    return buffer;
}



function buildRotationAndSend(rotation, trackerId) {
    const x = rotation["x"];
    const y = rotation["y"];
    const z = rotation["z"];
    const w = rotation["w"];
    const buffer = buildRotationPacket(x, y, z, w, trackerId);

    sock.send(buffer, 0, buffer.length, SLIME_PORT, SLIME_IP, (err) => {
        if (err) {
            console.error(`Error sending packet for sensor ${trackerId}:`, err);
        } else {

        }
    });
}




ipcMain.on('disconnect', (event, deviceName) => {
    console.log(`Device disconnected in main process: ${deviceName}`);

    // Remove the device ID from the connected devices
    connectedDevices = connectedDevices.filter(name => name !== deviceName);
    console.log(connectedDevices);

});


// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (mainWindow === null) createWindow();
});
