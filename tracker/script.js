var connecting = false;
async function connectToTrackers() {
    if (!connecting) {
        connecting = true;
        for (let i = 0; i < 8; i++) {
            await connectToDevice();
        }
    }
    connecting = false;
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
        if (trackers[device.id]) return;
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
        trackers[device.id] = { x: 0, y: 0, z: 0 };

        try {
            const trackercheck = setInterval(async () => {
                const sensor_characteristic = await sensor_service.getCharacteristic('00dbf1c6-90aa-11ed-a1eb-0242ac120002');
                const sensor_value = await sensor_characteristic.readValue();

                const battery_characteristic = await battery_service.getCharacteristic('00002a19-0000-1000-8000-00805f9b34fb');
                const battery_value = await battery_characteristic.readValue();
                const battery = decodeBatteryPacket(device, battery_value)[1];


                const IMUData = decodeIMUPacket(device, sensor_value);
                const iframe = document.getElementById(device.id + "threejs");

                const rotation_Euler = quaternionToEulerAngles(IMUData[1]);
                iframe.contentWindow.postMessage({
                    type: 'rotate',
                    rotationX: IMUData[1].x,
                    rotationY: IMUData[1].y,
                    rotationZ: IMUData[1].z,
                    rotationW: IMUData[1].w
                }, '*');


                deviceelement.innerHTML =
                    "Device name: " + IMUData[0].name + "<br>" +
                    "Device ID: " + IMUData[0].id + "<br>" +
                    "Rotation: " + rotation_Euler.x.toFixed(0) + ", " + rotation_Euler.y.toFixed(0) + ", " + rotation_Euler.z.toFixed(0) + "<br>"
                    + "Accel: " + IMUData[2].x.toFixed(0) + ", " + IMUData[2].y.toFixed(0) + ", " + IMUData[2].z.toFixed(0) + ", " + "<br>"
                    + "Battery: " + battery;



                const postData = {
                    deviceName: IMUData[0].name,
                    deviceId: IMUData[0].id,
                    rotation: {
                        x: rotation_Euler.x,
                        y: rotation_Euler.y,
                        z: rotation_Euler.z
                    },
                    accel: {
                        x: IMUData[2].x,
                        y: IMUData[2].y,
                        z: IMUData[2].z
                    },
                    battery: battery
                };
                ipc.send('sendData', postData);


            }, 16.7);
            device.addEventListener('gattserverdisconnected', (event) => {
                clearInterval(trackercheck);
                deviceelement.remove();
                delete trackers[device.id];
                const iframe = document.getElementById(device.id + "threejs");
                iframe.remove();
                ipc.send("disconnect", device.name);

            });

        } catch {

        }


    } catch (error) {
        console.error('Error connecting to Bluetooth device:', error);
    }
}


trackers = {};

function quaternionToEulerAngles(q) {
    return { x: q.x, y: q.y, z: q.z }; //just removing w axis for now
}

function decodeBatteryPacket(device, data) {
    const dataView = new DataView(data.buffer);
    const batteryLevel = dataView.getInt8(0, true) / 100.0;

    return [device, batteryLevel];

}

function decodeIMUPacket(device, rawdata) {
    const dataView = new DataView(rawdata.buffer);

    const rotation = {
        x: dataView.getInt16(0, true) / 180.0 * 1,
        y: dataView.getInt16(2, true) / 180.0 * 1,
        z: dataView.getInt16(4, true) / 180.0 * 1 * -1.0,
        w: dataView.getInt16(6, true) / 180.0 * 1 * -1.0,
    };




    const rotationVec = quaternionToEulerAngles(rotation);


    const gravity = {
        x: dataView.getInt16(8, true) / 256.0,
        y: dataView.getInt16(10, true) / 256.0,
        z: dataView.getInt16(12, true) / 256.0,
    };

    const gravityAccell = {
        x: gravity.x - trackers[device.id].x,
        y: gravity.y - trackers[device.id].y,
        z: gravity.z - trackers[device.id].z,
    };

    trackers[device.id] = gravity;

    return [device, rotation, gravityAccell];
}
