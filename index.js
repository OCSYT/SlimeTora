const { app, BrowserWindow, ipcMain } = require('electron');
const dgram = require('dgram');
const sock = dgram.createSocket('udp4');

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


const http = require('http');
const fs = require('fs');
const path = require('path');

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

    mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
        event.preventDefault();
        console.log()

        const haritoraDevices = deviceList.filter(device =>
            device.deviceName.startsWith('HaritoraXW-') && !connectedDevices.includes(device.deviceName)
        );

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



ipcMain.on('sendData', (event, postData) => {

    buildRotationAndSend(postData["rotation"], connectedDevices.indexOf(postData["deviceName"]));
});

//broken
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
    //console.log(buffer);


    sock.send(buffer, 0, buffer.length, SLIME_PORT, SLIME_IP, (err) => {
        if (err) {
            console.error(`Error sending rotation packet for sensor ${trackerId}:`, err);
        } else {
            PACKET_COUNTER += 1;
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
