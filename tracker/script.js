const store = {
    // Send a message to the main process to get data from the store
    get: async (key) => await ipc.invoke('get-data', key),

    // Send a message to the main process to set data in the store
    set: (key, value) => ipc.send('set-data', { key, value }),

    // Send a message to the main process to delete data from the store
    delete: (key) => ipc.send('delete-data', key),

    // Send a message to the main process to check if a key exists in the store
    has: async (key) => await ipc.invoke('has-data', key)
};


var smooth_val = 0.5;
var mag = false;

document.addEventListener("DOMContentLoaded", async function () {
    var smoothingCheckbox = document.getElementById("smoothing");
    if (await store.has("smoothingEnabled")) {
        smoothingCheckbox.checked = await store.get("smoothingEnabled");
    } else {
        smoothingCheckbox.checked = false;
    }

    var magnetometerCheckbox = document.getElementById("magnetometer");
    if (await store.has("magnetometer")) {
        magnetometerCheckbox.checked = await store.get("magnetometer");
    } else {
        magnetometerCheckbox.checked = false;
    }
    mag = magnetometerCheckbox.checked;

    if (await store.has("smoothinput")) {
        smooth_val = await store.get("smoothinput");
    }
    document.getElementById("smoothinput").value = smooth_val * 100;

    var isSmoothingEnabled = smoothingCheckbox.checked;
    if (isSmoothingEnabled) {
        saveSmoothValue();
    } else {
        smooth_val = 1;
    }

    smoothingCheckbox.addEventListener("change", function () {
        store.set("smoothingEnabled", smoothingCheckbox.checked);
        if (smoothingCheckbox.checked) {
            saveSmoothValue();
        } else {
            smooth_val = 1;
        }
    });
    magnetometerCheckbox.addEventListener("change", function () {
        store.set("magnetometer", magnetometerCheckbox.checked);
        mag = magnetometerCheckbox.checked;
    });
});

function justNumbers(string) {
    var numsStr = string.replace(/[^0-9]/g, '');

    if (!numsStr) {
        return 100;
    }

    return parseInt(numsStr);
}

function saveSmoothValue() {
    var userInputValue = justNumbers(document.getElementById("smoothinput").value) / 100;
    store.set("smoothinput", userInputValue);
    smooth_val = userInputValue;
}




var allowconnection = true;
var connecting = null;
async function connectToTrackers() {
    if (connecting == null) {
        connecting = setInterval(async () => {
            if (allowconnection) {
                allowconnection = false;
                ipc.send('connection', true);
                await connectToDevice();
            }
        }, 1000);
    }
}

async function disconnectAllDevices() {
    if (connecting) {
        const devicelist = document.getElementById("devicelist");
        trackercount.innerHTML = "Connected Trackers: " + Object.values(trackerdevices).length;
        devicelist.innerHTML = "<br><h1>Trackers: </h1><br></br>";
        ipc.send('connection', false);
        clearInterval(connecting);
        connecting = null;
    }
    for (const deviceId in trackerdevices) {
        const device = trackerdevices[deviceId][0];
        await disconnectDevice(device);
    }
    if (connecting) {
        trackerdevices = {};
        allowconnection = true;
    }
}

// Add this function to disconnect a specific device
async function disconnectDevice(device) {
    try {
        if (device) {
            if (trackerdevices[device.id]) {
                clearInterval(trackerdevices[device.id][1]);
            }
            delete trackerdevices[device];
            await device.gatt.disconnect();
            console.log("disconnected");
        }
    } catch (error) {
        console.error('Error disconnecting from Bluetooth device:', error);
    }
}
const trackercount = document.getElementById("trackercount");


function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end
}

function interpolateIMU(currentData, newData, t) {

    if (t == 1) {
        return newData;
    }

    const currentrot = new Quaternion(currentData["rotation"]);
    const newrot = new Quaternion(newData["rotation"]);
    const interpolatedQuaternion = currentrot.slerp(newrot)(t);
    const interpolatedData = {
        deviceName: newData.deviceName,
        deviceId: newData.deviceId,
        rotation: {
            x: interpolatedQuaternion.x,
            y: interpolatedQuaternion.y,
            z: interpolatedQuaternion.z,
            w: interpolatedQuaternion.w,
        },
        acceleration: {
            x: lerp(currentData.acceleration.x, newData.acceleration.x, t),
            y: lerp(currentData.acceleration.y, newData.acceleration.y, t),
            z: lerp(currentData.acceleration.z, newData.acceleration.z, t),
        },
        battery: newData.battery,
        yawReset: newData.yawReset
    };

    return interpolatedData;
}

async function getService(server, serviceId) {
    try {
        // Check if the GATT server is connected before retrieving the service
        if (server) {
            const service = await server.getPrimaryService(serviceId);
            return service;
        } else {
            return null;
        }
    } catch (error) {
        return null;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectToDevice() {
    var device = null
    try {
        const sensorServiceId = "00dbec3a-90aa-11ed-a1eb-0242ac120002";
        const settingId = "ef84369a-90a9-11ed-a1eb-0242ac120002";
        const batteryId = "0000180f-0000-1000-8000-00805f9b34fb";
        const deviceInfoId = "0000180a-0000-1000-8000-00805f9b34fb";

        try {
            device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'HaritoraXW-' }],
                optionalServices: [sensorServiceId, settingId, batteryId, deviceInfoId]
            });
            for (let i = 0; i < 10; i++) {
                if (connecting == null) {
                    await sleep(1000);
                    console.log("cancelling connection");
                    if (device != null) {
                        if (device.gatt != null) {
                            await device.gatt.disconnect();
                        }
                    }
                    allowconnection = true;
                    if (device) {
                        if (trackerdevices[device.id]) {
                            clearInterval(trackerdevices[device.id][1]);
                        }
                    }
                    return null;
                }
                else{
                    break;
                }
            }
        } catch {
            if (device != null) {
                if (device.gatt != null) {
                    await device.gatt.disconnect();
                }
            }
            allowconnection = true;
            if (device) {
                if (trackerdevices[device.id]) {
                    clearInterval(trackerdevices[device.id][1]);
                }
            }
            return null;
        }
        if (trackerdevices[device.id]) return;
        const server = await device.gatt.connect();

        const battery_service = await getService(server, batteryId);
        const sensor_service = await getService(server, sensorServiceId);
        const setting_service = await getService(server, settingId);
        const device_service = await getService(server, deviceInfoId);
        if (!battery_service || !sensorServiceId || !setting_service || !device_service) {
            await device.gatt.disconnect();
            allowconnection = true;
            if (device) {
                if (trackerdevices[device.id]) {
                    clearInterval(trackerdevices[device.id]);
                }
            }
            return null;
        }
        console.log('Connected to device:', device.name);

        const devicelist = document.getElementById("devicelist");
        const deviceelement = document.createElement("div");
        const iframe = document.createElement('iframe');

        // Set attributes for the iframe
        iframe.id = device.id + "threejs";
        iframe.src = './visualization.html';
        iframe.width = '100px';
        iframe.height = '100px';

        // Append the iframe to the body or any other container
        devicelist.appendChild(iframe);

        deviceelement.id = device.name;
        devicelist.appendChild(deviceelement);

        trackerdevices[device.id] = [device, null];
        battery[device.id] = 0;

        trackercount.innerHTML = "Connected Trackers: " + Object.values(trackerdevices).length;
        const sensor_characteristic = await sensor_service.getCharacteristic('00dbf1c6-90aa-11ed-a1eb-0242ac120002');
        const battery_characteristic = await battery_service.getCharacteristic('00002a19-0000-1000-8000-00805f9b34fb');
        const button_characteristic = await sensor_service.getCharacteristic('00dbf450-90aa-11ed-a1eb-0242ac120002');
        const fps_characteristic = await sensor_service.getCharacteristic("00dbf1c6-90aa-11ed-a1eb-0242ac120002");
        const mode_characteristic = await setting_service.getCharacteristic("ef8445c2-90a9-11ed-a1eb-0242ac120002");

        var sensor_value = await sensor_characteristic.readValue();
        var battery_value = await battery_characteristic.readValue();
        var button_value = (await button_characteristic.readValue()).getInt8(0);
        var fps_value = await fps_characteristic.readValue();
        var mode_value = await mode_characteristic.readValue();

        var new_button_value = null;
        var button_enabled = false;
        var postDataCurrent = null;
        var postData = null;
        var allowyawreset = false;

        var tpsCounter = 0;
        var lastTimestamp = 0;
        const updateValues = async () => {
            if (trackerdevices[device.id] == null) return;
            // Enable notifications for the characteristic
            await sensor_characteristic.startNotifications();
            await battery_characteristic.startNotifications();

            // Handle notifications
            sensor_characteristic.addEventListener('characteristicvaluechanged', (event) => {
                // Handle sensor data
                sensor_value = event.target.value;

                if (Date.now() - lastTimestamp >= 1000) {
                    const tps = tpsCounter / ((Date.now() - lastTimestamp) / 1000);
                    //console.log(`TPS: ${tps}`);
                    tpsCounter = 0;
                    lastTimestamp = Date.now();
                } else {
                    tpsCounter += 1;
                }

            });

            battery_characteristic.addEventListener('characteristicvaluechanged', (event) => {
                // Handle battery data
                battery_value = event.target.value;

                if (Date.now() - lastTimestamp >= 1000) {
                    const tps = tpsCounter / ((Date.now() - lastTimestamp) / 1000);
                    //console.log(`TPS: ${tps}`);
                    tpsCounter = 0;
                    lastTimestamp = Date.now();
                } else {
                    tpsCounter += 1;
                }

            });
        };

        // Start the update loop
        updateValues();


        const writeValues = async () => {
            if (trackerdevices[device.id] == null) return;
            try {
                const magvalue = new DataView(new ArrayBuffer(1));
                magvalue.setUint8(0, mag ? 5 : 8);
                mode_value = magvalue;
                await mode_characteristic.writeValue(magvalue);


                new_button_value = (await button_characteristic.readValue()).getInt8(0);
                if (button_value !== new_button_value) {
                    button_enabled = true;
                } else {
                    button_enabled = false;
                }
                if (button_enabled) {
                    console.log(button_enabled);
                }
                button_value = new_button_value;
                if (connecting) {
                    setTimeout(writeValues, 100);
                }
            } catch {

            }
        }
        writeValues();

        const trackercheck = setInterval(async () => {

            var yawreset = false;
            if (button_enabled == true && allowyawreset == true) {
                allowyawreset = false;
                yawreset = true;
            }
            else {
                if (button_enabled == false) {
                    allowyawreset = true;
                }
            }

            battery[device.id] = decodeBatteryPacket(device, battery_value)[1];;
            const lowestbattery = Math.min(...Object.values(battery));

            const IMUData = decodeIMUPacket(device, sensor_value);
            const iframe = document.getElementById(device.id + "threejs");

            postData = {
                deviceName: IMUData[0].name,
                deviceId: IMUData[0].id,
                rotation: {
                    x: IMUData[1].x,
                    y: IMUData[1].y,
                    z: IMUData[1].z,
                    w: IMUData[1].w
                },
                acceleration: {
                    x: IMUData[2].x,
                    y: IMUData[2].y,
                    z: IMUData[2].z
                },
                battery: lowestbattery,
                yawReset: yawreset
            };


            if (postDataCurrent == null) {
                postDataCurrent = postData;
            }
            postDataCurrent = interpolateIMU(postDataCurrent, postData, smooth_val);
            //remove lag

            ipc.send('sendData', postDataCurrent);
            if (iframe) {
                iframe.contentWindow.postMessage({
                    type: 'rotate',
                    rotationX: postDataCurrent["rotation"].x,
                    rotationY: postDataCurrent["rotation"].y,
                    rotationZ: postDataCurrent["rotation"].z,
                    rotationW: postDataCurrent["rotation"].w
                }, '*');
            }

            // rotation is given in radians
            const rotation = new Quaternion([postDataCurrent["rotation"].w, postDataCurrent["rotation"].x, postDataCurrent["rotation"].y, postDataCurrent["rotation"].z]);
            const rotation_Euler_raw = rotation.toEuler("XYZ");

            // Convert radians to degrees
            const rotation_Euler = {
                x: rotation_Euler_raw[0] * (180 / Math.PI),
                y: rotation_Euler_raw[1] * (180 / Math.PI),
                z: rotation_Euler_raw[2] * (180 / Math.PI)
            };

            const deviceName = postDataCurrent["deviceName"];
            const deviceId = postDataCurrent["deviceId"];
            const { x: rotX, y: rotY, z: rotZ } = rotation_Euler;
            const { x: accelX, y: accelY, z: accelZ } = postDataCurrent["acceleration"];
            const batteryPercentage = (battery[device.id] * 100);

            // Build the HTML content
            const content =
                "<strong>Device name:</strong> " + deviceName + "<br>" +
                "<strong>Device ID:</strong> " + deviceId + "<br>" +
                "<strong>Rotation:</strong> X: " + rotX.toFixed(0) + ", Y: " + rotY.toFixed(0) + ", Z: " + rotZ.toFixed(0) + "<br>" +
                "<strong>Acceleration:</strong> X: " + accelX.toFixed(0) + ", Y: " + accelY.toFixed(0) + ", Z: " + accelZ.toFixed(0) + "<br>" +
                "<strong>Battery:</strong> " + batteryPercentage.toFixed(0) + "% <br><br>";
            deviceelement.innerHTML = content;

        }, 10);
        trackerdevices[device.id][1] = trackercheck;

        device.addEventListener('gattserverdisconnected', async (event) => {
            try {
                if (connecting) {
                    await device.gatt.connect();
                }
                else {
                    if (device) {
                        if (trackerdevices[device.id]) {
                            clearInterval(trackerdevices[device.id][1]);
                        }
                    }
                    deviceelement.remove();
                    delete trackerdevices[device.id];
                    delete battery[device.id];
                    iframe.remove();
                    ipc.send("disconnect", device.name);
                    trackercount.innerHTML = "Connected Trackers: " + Object.values(trackerdevices).length;
                }
            } catch {
                if (device) {
                    if (trackerdevices[device.id]) {
                        clearInterval(trackerdevices[device.id][1]);
                    }
                }
                deviceelement.remove();
                delete trackerdevices[device.id];
                delete battery[device.id];
                iframe.remove();
                ipc.send("disconnect", device.name);
                trackercount.innerHTML = "Connected Trackers: " + Object.values(trackerdevices).length;
            }
        });
        allowconnection = true;
    } catch (error) {
        console.log(error);
        allowconnection = true;
        if (device) {
            if (trackerdevices[device.id]) {
                clearInterval(trackerdevices[device.id][1]);
            }
        }
        if(Object.values(trackerdevices).length == 0){
            const devicelist = document.getElementById("devicelist");
            trackercount.innerHTML = "Connected Trackers: " + Object.values(trackerdevices).length;
            devicelist.innerHTML = "<br><h1>Trackers: </h1><br></br>";
        }
    }
}

battery = {};
trackerdevices = {};

function decodeBatteryPacket(device, data) {
    const dataView = new DataView(data.buffer);
    const batteryLevel = dataView.getInt8(0, true) / 100.0;

    return [device, batteryLevel];

}

function calcGravityVec(qwxyz, gravVec) {
    var newgrav = {
        x: 0,
        y: 0,
        z: 0
    }

    newgrav.x = 2 * (qwxyz.y * qwxyz.w - qwxyz.x * qwxyz.z);
    newgrav.y = 2 * (qwxyz.x * qwxyz.y + qwxyz.z * qwxyz.w);
    newgrav.z = qwxyz.x * qwxyz.x - qwxyz.y * qwxyz.y - qwxyz.z * qwxyz.z + qwxyz.w * qwxyz.w;
    return newgrav;
}


function decodeIMUPacket(device, rawdata) {
    const dataView = new DataView(rawdata.buffer);

    const rotation = {
        x: dataView.getInt16(0, true) / 180.0 * 0.01,
        y: dataView.getInt16(2, true) / 180.0 * 0.01,
        z: dataView.getInt16(4, true) / 180.0 * 0.01 * -1.0,
        w: dataView.getInt16(6, true) / 180.0 * 0.01 * -1.0,
    };



    const gravityRaw = {
        x: dataView.getInt16(8, true) / 256.0,
        y: dataView.getInt16(10, true) / 256.0,
        z: dataView.getInt16(12, true) / 256.0,
    };

    const rc = [rotation.w, rotation.x, rotation.y, rotation.z];
    const r = [rc[0], -rc[1], -rc[2], -rc[3]];
    const p = [0.0, 0.0, 0.0, 9.8];

    const hrp = [
        r[0] * p[0] - r[1] * p[1] - r[2] * p[2] - r[3] * p[3],
        r[0] * p[1] + r[1] * p[0] + r[2] * p[3] - r[3] * p[2],
        r[0] * p[2] - r[1] * p[3] + r[2] * p[0] + r[3] * p[1],
        r[0] * p[3] + r[1] * p[2] - r[2] * p[1] + r[3] * p[0],
    ];

    const hfinal = [
        hrp[0] * rc[0] - hrp[1] * rc[1] - hrp[2] * rc[2] - hrp[3] * rc[3],
        hrp[0] * rc[1] + hrp[1] * rc[0] + hrp[2] * rc[3] - hrp[3] * rc[2],
        hrp[0] * rc[2] - hrp[1] * rc[3] + hrp[2] * rc[0] + hrp[3] * rc[1],
        hrp[0] * rc[3] + hrp[1] * rc[2] - hrp[2] * rc[1] + hrp[3] * rc[0],
    ];

    const gravity = {
        x: gravityRaw.x - hfinal[1] * -1.2,
        y: gravityRaw.y - hfinal[2] * -1.2,
        z: gravityRaw.z - hfinal[3] * 1.2,
    };

    return [device, rotation, gravity];
}
