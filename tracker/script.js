var smooth_val = 0.75;
document.addEventListener("DOMContentLoaded", function () {
    if (localStorage.getItem("smoothinput")) {
        smooth_val = localStorage.getItem("smoothinput");
    }
    document.getElementById("smoothinput").value = smooth_val * 100;


    var smoothingCheckbox = document.getElementById("smoothing");
    console.log(localStorage.getItem("smoothingEnabled"));

    // Convert the stored value to a boolean, or default to false if null
    var isSmoothingEnabled = smoothingCheckbox.checked;
    if (isSmoothingEnabled) {
        saveSmoothValue();
    }
    else {
        smooth_val = 1;
    }

    if(localStorage.getItem("smoothingEnabled")){
        smoothingCheckbox.checked = localStorage.getItem("smoothingEnabled") === "true";
    }   
    else{
        smoothingCheckbox.checked = true;
    }
    smoothingCheckbox.addEventListener("change", function () {

        isSmoothingEnabled = smoothingCheckbox.checked;

        localStorage.setItem("smoothingEnabled", isSmoothingEnabled);
        if (isSmoothingEnabled) {
            saveSmoothValue();
        }
        else {
            smooth_val = 1;
        }
    });

});

function justNumbers(string) {
    var numsStr = string.replace(/[^0-9]/g, '');

    // Check if numsStr is empty, and return 1 if true
    if (!numsStr) {
        return 100;
    }

    return parseInt(numsStr);
}
function saveSmoothValue() {
    // Get the user input value
    var userInputValue = justNumbers(document.getElementById("smoothinput").value) / 100;

    // Save the value in local storage
    localStorage.setItem("smoothinput", userInputValue);
    smooth_val = userInputValue;
}




var connecting = null;
async function connectToTrackers() {
    if (connecting == null) {
        connecting = setInterval(async () => {
            await connectToDevice();
        }, 1000);
    }
}

function disconnectAllDevices() {
    for (const deviceId in trackers) {
        const device = trackerdevices[deviceId];
        disconnectDevice(device);
    }
    if (connecting) {
        clearInterval(connecting);
        connecting = null;
    }
}

// Add this function to disconnect a specific device
async function disconnectDevice(device) {
    try {
        await device.gatt.disconnect();
    } catch (error) {
        console.error('Error disconnecting from Bluetooth device:', error);
    }
}
const trackercount = document.getElementById("trackercount");


function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end
}


function interpolateIMU(currentData, newData, t) {
    const interpolatedData = {
        deviceName: newData.deviceName,
        deviceId: newData.deviceId,
        rotation: {
            x: lerp(currentData.rotation.x, newData.rotation.x, t),
            y: lerp(currentData.rotation.y, newData.rotation.y, t),
            z: lerp(currentData.rotation.z, newData.rotation.z, t),
            w: lerp(currentData.rotation.w, newData.rotation.w, t),
        },
        acceleration: {
            x: lerp(currentData.acceleration.x, newData.acceleration.x, t),
            y: lerp(currentData.acceleration.y, newData.acceleration.y, t),
            z: lerp(currentData.acceleration.z, newData.acceleration.z, t),
        },
        battery: newData.battery
    };

    return interpolatedData;
}


async function connectToDevice() {
    try {
        const sensorServiceId = "00dbec3a-90aa-11ed-a1eb-0242ac120002";
        const settingId = "ef84369a-90a9-11ed-a1eb-0242ac120002";
        const batteryId = "0000180f-0000-1000-8000-00805f9b34fb";
        const deviceInfoId = "0000180a-0000-1000-8000-00805f9b34fb";

        const device = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'HaritoraXW-' }],
            optionalServices: [sensorServiceId, settingId, batteryId, deviceInfoId]
        });
        if (trackerdevices[device.id]) return;
        const server = await device.gatt.connect();

        const battery_service = await server.getPrimaryService(batteryId);
        const sensor_service = await server.getPrimaryService(sensorServiceId);
        console.log('Connected to device:', device.name);

        const devicelist = document.getElementById("devicelist");
        const deviceelement = document.createElement("p");
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
        trackerdevices[device.id] = device;
        trackercount.innerHTML = "Connected Trackers: " + Object.values(trackers).length;
        const sensor_characteristic = await sensor_service.getCharacteristic('00dbf1c6-90aa-11ed-a1eb-0242ac120002');
        const battery_characteristic = await battery_service.getCharacteristic('00002a19-0000-1000-8000-00805f9b34fb');
        var sensor_value = await sensor_characteristic.readValue();
        var battery_value = await battery_characteristic.readValue();
        var postDataCurrent = null;
        var postData = null;
        try {
            const updateValues = async () => {
                sensor_value = await sensor_characteristic.readValue();
                battery_value = await battery_characteristic.readValue();
                setTimeout(updateValues, 16.7);
            }
            updateValues();
            const trackercheck = setInterval(async () => {
                try {

                    const battery = decodeBatteryPacket(device, battery_value)[1];


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
                        battery: battery
                    };

                    
                    if (postDataCurrent == null) {
                        postDataCurrent = postData;
                    }
                    postDataCurrent = interpolateIMU(postDataCurrent, postData, smooth_val);
                    //remove lag

                    ipc.send('sendData', postDataCurrent);
                    iframe.contentWindow.postMessage({
                        type: 'rotate',
                        rotationX: postDataCurrent["rotation"].x,
                        rotationY: postDataCurrent["rotation"].y,
                        rotationZ: postDataCurrent["rotation"].z,
                        rotationW: postDataCurrent["rotation"].w
                    }, '*');

                    const rotation_Euler = quaternionToEulerAngles(postDataCurrent["rotation"]);
                    deviceelement.innerHTML =
                        "Device name: " + postDataCurrent["deviceName"] + "<br>" +
                        "Device ID: " + postDataCurrent["deviceId"] + "<br>" +
                        "Rotation: " + rotation_Euler.x.toFixed(0) + ", " + rotation_Euler.y.toFixed(0) + ", " + rotation_Euler.z.toFixed(0) + "<br>"
                        + "Accel: " + postDataCurrent["acceleration"].x.toFixed(0) + ", " + postDataCurrent["acceleration"].y.toFixed(0) + ", " + postDataCurrent["acceleration"].z.toFixed(0) + ", " + "<br>"
                        + "Battery: " + battery * 100 + "% <br><br>";


                } catch {

                }
            }, 16.7);

            device.addEventListener('gattserverdisconnected', (event) => {
                clearInterval(trackercheck);
                deviceelement.remove();
                delete trackerdevices[device.id];
                iframe.remove();
                ipc.send("disconnect", device.name);
                trackercount.innerHTML = "Connected Trackers: " + Object.values(trackers).length;
            });

        } catch {

        }


    } catch (error) {

    }
}

trackerdevices = {};

function quaternionToEulerAngles(q) {
    return { x: q.x * 100, y: q.y * 100, z: q.z * 100 }; //just removing w axis for now and multiplying by 100
}

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
