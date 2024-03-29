function MagnetometerComponent() {
    function create(parentElement, id, checked) {
        // Create container div
        const container = document.createElement("div");

        // Create elements
        const p = document.createElement("p");
        p.textContent = "Magnetometer";
        p.style.display = "inline";

        const label = document.createElement("label");
        label.className = "switch";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.id = id;
        input.checked = checked;

        const span = document.createElement("span");
        span.className = "slider round";

        const br1 = document.createElement("br");
        const br2 = document.createElement("br");
        const br3 = document.createElement("br");

        // Append elements to container
        label.appendChild(input);
        label.appendChild(span);
        container.appendChild(p);
        container.appendChild(br1);
        container.appendChild(label);
        container.appendChild(br2);
        container.appendChild(br3);

        // Append container to parentElement
        parentElement.appendChild(container);

        return {
            delete: function () {
                deleteComponent(container);
            }
        };
    }

    function deleteComponent(container) {
        // Remove the container
        container.remove();
    }

    return {
        create: create
    };
}

correction_value_target = 0;

const store = {
    // Send a message to the main process to get data from the store
    get: async (key) => await window.ipc.invoke('get-data', key),

    set: (key, value) => window.ipc.send('set-data', { key, value }),

    delete: (key) => window.ipc.send('delete-data', key),

    has: async (key) => await window.ipc.invoke('has-data', key)
};


document.getElementById('accel').addEventListener('change', function() {
    store.set('accel', this.checked);
    updateTargetValue();
});

document.getElementById('mag').addEventListener('change', function() {
    store.set('mag', this.checked);
    updateTargetValue();
});

document.getElementById('gyro').addEventListener('change', function() {
    store.set('gyro', this.checked);
    updateTargetValue();
});

// Function to load saved checkbox values
async function loadCheckboxValues() {
    var accel = null;
    if (await store.has("accel")) {
        accel = await store.get('accel');
    }
    else{
        accel = true
    }
    const mag = await store.get('mag');
    const gyro = await store.get('gyro');
    
    // Update checkbox states based on saved values
    document.getElementById('accel').checked = accel;
    document.getElementById('mag').checked = mag;
    document.getElementById('gyro').checked = gyro;

    updateTargetValue();
}

// Function to update the target value based on checkbox states
function updateTargetValue() {
    correction_value_target = 0;
    const accel = document.getElementById('accel').checked;
    const mag = document.getElementById('mag').checked;
    const gyro = document.getElementById('gyro').checked;
    if(accel){
        correction_value_target += 1;
    }
    if(mag){
        correction_value_target += 4;
    }
    if(gyro){
        correction_value_target += 2;
    }
}
var smooth_val = 0.5;

document.addEventListener("DOMContentLoaded", async function () {
    loadCheckboxValues();
    var smoothingCheckbox = document.getElementById("smoothing");
    if (await store.has("smoothingEnabled")) {
        smoothingCheckbox.checked = await store.get("smoothingEnabled");
    } else {
        smoothingCheckbox.checked = false;
    }

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
    const status = document.getElementById("status");
    status.innerHTML = "Status: Searching for trackers.";
    if (connecting == null) {
        connecting = setInterval(async () => {
            if (allowconnection) {
                allowconnection = false;
                ipc.send('connection', true);
                console.log("checking for connection");
                await connectToDevice();
            }
        }, 1000);
    }
}

async function disconnectAllDevices() {
    if (connecting) {
        const status = document.getElementById("status");
        status.innerHTML = "Status: Not searching.";
        const devicelist = document.getElementById("devicelist");
        trackercount.innerHTML = "Connected Trackers: " + 0;
        devicelist.innerHTML = "<br><h1>Trackers: </h1><br></br>";
        ipc.send('connection', false);
        clearInterval(connecting);
    }
    for (const deviceId in trackerdevices) {
        const device = trackerdevices[deviceId][0];
        await disconnectDevice(device);
    }
    trackerdevices = {};
    allowconnection = true;
    connecting = null;

}

// Add this function to disconnect a specific device
async function disconnectDevice(device) {
    try {
        if (device) {
            if (trackerdevices[device.id]) {
                clearInterval(trackerdevices[device.id][1]);
            }
            delete trackerdevices[device.id];
            delete battery[device.id];
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
    var mag = false;
    let magnetometerelement = null;
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
                else {
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
        iframe.width = '200px';
        iframe.height = '200px';

        // Append the iframe to the body or any other container
        devicelist.appendChild(iframe);

        deviceelement.id = device.name;
        devicelist.appendChild(deviceelement);

        trackerdevices[device.id] = [device, null];
        battery[device.id] = 0;

        const magcompoonent = new MagnetometerComponent();
        magnetometerelement = magcompoonent.create(devicelist, "magnetometer" + device.name, false);


        let magnetometerCheckbox = document.getElementById("magnetometer" + device.name);
        if (await store.has(("magnetometer" + device.name))) {
            magnetometerCheckbox.checked = await store.get("magnetometer" + device.name);
        } else {
            magnetometerCheckbox.checked = false;
        }
        mag = magnetometerCheckbox.checked;
        magnetometerCheckbox.addEventListener("change", function () {
            store.set("magnetometer" + device.name, magnetometerCheckbox.checked);
            mag = magnetometerCheckbox.checked;
        });


        trackercount.innerHTML = "Connected Trackers: " + Object.values(trackerdevices).length;

        const sensor_characteristic = await sensor_service.getCharacteristic('00dbf1c6-90aa-11ed-a1eb-0242ac120002');
        const battery_characteristic = await battery_service.getCharacteristic('00002a19-0000-1000-8000-00805f9b34fb');
        const button_characteristic = await sensor_service.getCharacteristic('00dbf450-90aa-11ed-a1eb-0242ac120002');
        const fps_characteristic = await sensor_service.getCharacteristic("00dbf1c6-90aa-11ed-a1eb-0242ac120002");
        const mode_characteristic = await setting_service.getCharacteristic("ef8445c2-90a9-11ed-a1eb-0242ac120002");
        const correction_characteristic = await setting_service.getCharacteristic("ef84c305-90a9-11ed-a1eb-0242ac120002");
        const tof_characteristic = await setting_service.getCharacteristic("ef8443f6-90a9-11ed-a1eb-0242ac120002");

        var sensor_value = await sensor_characteristic.readValue();
        var battery_value = await battery_characteristic.readValue();
        var button_value = (await button_characteristic.readValue()).getInt8(0);
        var fps_value = await fps_characteristic.readValue();
        var mode_value = await mode_characteristic.readValue();      
        var correction_value = await correction_characteristic.readValue();
        var ankle_tof_value = await tof_characteristic.readValue();
        console.log("originalval: " + correction_value.getInt8(0));

        var lastMagValue = null;
        var last_target_value = null;
        var button_enabled = false;
        var postDataCurrent = null;
        var postData = null;
        var allowyawreset = false;

        var tpsCounter = 0;
        var lastTimestamp = 0;
        const updateValues = async () => {
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


                if (mag !== lastMagValue || correction_value_target !== last_target_value) {
                    mode_value = new DataView(new ArrayBuffer(1));
                    mode_value.setUint8(0, mag ? 5 : 8);
                    await mode_characteristic.writeValue(mode_value);
                    lastMagValue = mag;


                    //correctionvalues
                    correction_value = new DataView(new ArrayBuffer(1));
                    correction_value.setUint8(0,correction_value_target);
                    await correction_characteristic.writeValue(correction_value);
                    last_target_value = correction_value_target;
                    console.log(correction_value_target);

                    //ankle
                    ankle_tof_value = new DataView(new ArrayBuffer(1));
                    ankle_tof_value.setUint8(0,0);
                    await tof_characteristic.writeValue(ankle_tof_value);
                }

                new_button_value = (await button_characteristic.readValue()).getInt8(0);
                if (button_value !== new_button_value) {
                    button_enabled = true;
                } else {
                    button_enabled = false;
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
                    rotationW: postDataCurrent["rotation"].w,
                    gravityX: IMUData[2].x,
                    gravityY: IMUData[2].y,
                    gravityZ: IMUData[2].z,
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
            if (trackerdevices[device.id]) {
                clearInterval(trackerdevices[device.id][1]);
            }
            deviceelement.remove();
            delete trackerdevices[device.id];
            delete battery[device.id];
            iframe.remove();
            magnetometerelement.delete();
            ipc.send("disconnect", device.name);
            trackercount.innerHTML = "Connected Trackers: " + Object.values(trackerdevices).length;
        });
        allowconnection = true;
    } catch (error) {
        console.log(error);
        allowconnection = true;
        if (device) {
            if (trackerdevices[device.id]) {
                clearInterval(trackerdevices[device.id][1]);
            }
            ipc.send("disconnect", device.name);
        }
        if (Object.values(trackerdevices).length == 0) {
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
let initialRotations = {};
let initialAccel = {};
let startTimes = {};
let calibrated = {};
let driftvalues = {};
let trackerrotation = {};
let trackeraccel = {};
const DriftInterval = 15000;
function decodeIMUPacket(device, rawdata) {
    const deviceId = device.id;
    const dataView = new DataView(rawdata.buffer);

    const elapsedTime = Date.now() - startTimes[deviceId];

    const rotation = {
        x: dataView.getInt16(0, true) / 180.0 * 0.01,
        y: dataView.getInt16(2, true) / 180.0 * 0.01,
        z: dataView.getInt16(4, true) / 180.0 * 0.01 * -1.0,
        w: dataView.getInt16(6, true) / 180.0 * 0.01 * -1.0,
    };
    trackerrotation[deviceId] = rotation;


    const gravityRaw = {
        x: dataView.getInt16(8, true) / 256.0,
        y: dataView.getInt16(10, true) / 256.0,
        z: dataView.getInt16(12, true) / 256.0,
    };

    const gravityRawGForce = {
        x: (dataView.getInt16(8, true) / 256.0) / 9.81,
        y: (dataView.getInt16(10, true) / 256.0) / 9.81,
        z: (dataView.getInt16(12, true) / 256.0) / 9.81,
    };

    trackeraccel[deviceId] = gravityRaw;

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


    if (elapsedTime >= DriftInterval) {
        if (!calibrated[deviceId]) {
            calibrated[deviceId] = {
                pitch: driftvalues[deviceId].pitch,
                roll: driftvalues[deviceId].roll,
                yaw: driftvalues[deviceId].yaw
            }
        }
    }

    if (elapsedTime < DriftInterval) {
        if (!driftvalues[deviceId]) {
            driftvalues[deviceId] = { pitch: 0, roll: 0, yaw: 0 };
        }

        const rotationDifference = calculateRotationDifference(
            new Quaternion(initialRotations[deviceId].w, initialRotations[deviceId].x, initialRotations[deviceId].y, initialRotations[deviceId].z).toEuler("XYZ"),
            new Quaternion(rotation.w, rotation.x, rotation.y, rotation.z).toEuler("XYZ")
        );

        const prevMagnitude = Math.sqrt(driftvalues[deviceId].pitch ** 2 + driftvalues[deviceId].roll ** 2 + driftvalues[deviceId].yaw ** 2);
        const currMagnitude = Math.sqrt(rotationDifference.pitch ** 2 + rotationDifference.roll ** 2 + rotationDifference.yaw ** 2);

        if (currMagnitude > prevMagnitude) {
            driftvalues[deviceId] = rotationDifference;
            console.log(driftvalues[deviceId]);
        }
    }


    if (elapsedTime >= DriftInterval && calibrated[deviceId]) {
        const driftCorrection = {
            pitch: calibrated[deviceId].pitch * (elapsedTime / DriftInterval) % (2 * Math.PI),
            roll: calibrated[deviceId].roll * (elapsedTime / DriftInterval) % (2 * Math.PI),
            yaw: calibrated[deviceId].yaw * (elapsedTime / DriftInterval) % (2 * Math.PI),
        };

        const rotQuat = new Quaternion([rotation.w, rotation.x, rotation.y, rotation.z]);

        const rotationDriftCorrected = RotateAround(rotQuat, trackeraccel[deviceId], driftCorrection.yaw);

        console.log("Applied fix");
        console.log(rotation);
        console.log(rotationDriftCorrected, driftCorrection.yaw);

        return [device, rotationDriftCorrected, gravity];
    }
    // Return original rotation data
    return [device, rotation, gravity];
}

function RotateAround(quat, vector, angle) {
    // Create a copy of the input quaternion
    var initialQuaternion = new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w);

    var rotationAxis = new THREE.Vector3(vector.x, vector.y, vector.z);

    // Create a rotation quaternion
    var rotationQuaternion = new THREE.Quaternion();
    rotationQuaternion.setFromAxisAngle(rotationAxis.normalize(), angle);
    // Apply the rotation to the copy of the input quaternion
    initialQuaternion = initialQuaternion.multiply(rotationQuaternion).normalize();

    // Return the resulting quaternion as a dictionary
    return {
        x: initialQuaternion.x,
        y: initialQuaternion.y,
        z: initialQuaternion.z,
        w: initialQuaternion.w
    };
}



function calculateRotationDifference(prevRotation, currentRotation) {
    const pitchDifferenceRad = currentRotation[0] - prevRotation[0];
    const rollDifferenceRad = currentRotation[1] - prevRotation[1];
    const yawDifferenceRad = currentRotation[2] - prevRotation[2];

    return { pitch: pitchDifferenceRad, roll: rollDifferenceRad, yaw: yawDifferenceRad };
}



function CalibrateDrift() {
    console.log("Started calibration");
    const status = document.getElementById("calibratingstatus");
    status.innerHTML = "Status: Calibrating";
    for (const deviceId in trackerrotation) {
        if (!initialRotations[deviceId]) {
            delete calibrated[deviceId];
            delete driftvalues[deviceId];
            initialRotations[deviceId] = trackerrotation[deviceId];
            startTimes[deviceId] = Date.now();
            initialAccel[deviceId] = trackeraccel[deviceId];
        }
    }
    setTimeout(function () {
        status.innerHTML = "Status: Finished Calibrating";
    }, DriftInterval);

}
function RemoveDriftOffsets() {
    const status = document.getElementById("calibratingstatus");
    for (const deviceId in trackerrotation) {
        delete calibrated[deviceId];
        delete initialRotations[deviceId];
        delete startTimes[deviceId];
        delete initialAccel[deviceId];
        delete driftvalues[deviceId];
    }
    status.innerHTML = "Status: No Calibration set, using default rotation.";
}





window.onbeforeunload = function (event) {
    ipc.send('connection', false);
    disconnectAllDevices();
};
