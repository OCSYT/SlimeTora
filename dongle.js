const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline')

class Rotation {
    constructor(x, y, z, w) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }
}

class Gravity {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}


const portName = 'COM4';
const baudRate = 500000; // from the haritora_setting.json in HaritoraConfigurator

const port = new SerialPort({
    path: portName,
    baudRate: baudRate
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

parser.on('data', (data) => {
    processData(data);
});

port.on('error', (err) => {
    console.error('Error:', err.message);
});

function processData(data) {
    const parts = data.split(':', 2);
    if (parts.length === 2) {
        const [label, data] = parts;
        if (label.includes('X')) {
            // IMU tracker data
            const tracker_number = parseInt(label.split('X').pop(), 10);
            processTrackerData(data, tracker_number);
        } else if (label.includes('a')) {
            // Other tracker data
            const tracker_number = parseInt(label.split('a').pop(), 10);
            processOtherTrackerData(data, tracker_number);
        } else if (label.includes('r')) {
            // Tracker button info
            const tracker_number = parseInt(label.split('r').pop(), 10);
            processButtonData(data, tracker_number);
        } else if (label.includes('v')) {
            // Tracker battery info
            const tracker_number = parseInt(label.split('v').pop(), 10);
            processBatteryData(data, tracker_number);
        } else {
            console.log(`Unknown label: ${label}`);
            console.log(`Unknown label's data: ${data}`);
        }
    }
}

/*
* Tracker data
* This is obviously the IMU tracking data, the juicy stuff. Ankle motion data also included (if enabled).
* Can be used to forward to other software such as SlimeVR's server!
* Rotation has: x, y, z, w
* Gravity has: x, y, z
*/

function processAnkleMotionData(data) {
    // Process ankle motion data
    // TODO: see how to process the data, but we have it here
    console.log(`Received ankle motion data: ${data}`);
}

function logRotationAndGravity(trackerNum, rotation, gravity) {
    console.log(`Tracker ${trackerNum} rotation: (${rotation.x.toFixed(5)}, ${rotation.y.toFixed(5)}, ${rotation.z.toFixed(5)}, ${rotation.w.toFixed(5)})`);
    console.log(`Tracker ${trackerNum} gravity: (${gravity.x.toFixed(5)}, ${gravity.y.toFixed(5)}, ${gravity.z.toFixed(5)})`);
}

function processTrackerData(data, trackerNum) {
    try {
        if (data.endsWith('==') && data.length === 24) {
            // Other trackers
            try {
                const { rotation, gravity } = decodeIMUPacket(data);
                logRotationAndGravity(trackerNum, rotation, gravity);
            } catch (err) {
                console.log(`Error decoding tracker ${trackerNum} IMU packet: ${data}`);
            }
        } else {
            // Ankle trackers
            if (data && data.length === 24) {
                const decodedData = data;

                const ankleMotionData = decodedData.slice(-2);
                processAnkleMotionData(ankleMotionData);

                const imuData = decodedData.slice(0, -2);

                try {
                    const { rotation, gravity } = decodeIMUPacket(imuData);
                    logRotationAndGravity(trackerNum, rotation, gravity);
                } catch (err) {
                    console.log(`Error decoding tracker ${trackerNum} IMU packet: ${decodedData}`);
                }
            } else {
                console.log(`Invalid or short data received. Skipping processing of data: ${data}`);
            }
        }
    } catch (err) {
        console.log("Error decoding data:", data);
    }
}

/*
* Other tracker data
* Currently unsure what other data a0/a1 could represent other than trying to find the trackers,
* I see other values for it too. This could also be used to report calibration data when running the
* calibration through the software. Also, could be if the tracker is just turned on/off.
*/

function processOtherTrackerData(data, trackerNum) {
    const decodedData = data;
    if (decodedData.trim() === '7f7f7f7f7f7f') {
        console.log(`Searching for tracker ${trackerNum}...`);
    } else {
        console.log(`Other tracker ${trackerNum} data processed: ${decodedData}`);
    }
}

function processButtonPress(trackerNum, mainButtonPressCount, subButtonPressCount, prevMainButtonPressCount, prevSubButtonPressCount) {
    if (mainButtonPressCount !== prevMainButtonPressCount) {
        console.log(`Tracker ${trackerNum} main button pressed. Pressed ${mainButtonPressCount + 1} times.`);
        prevMainButtonPressCount = mainButtonPressCount;
    }
    if (subButtonPressCount !== prevSubButtonPressCount) {
        console.log(`Tracker ${trackerNum} sub button pressed. Pressed ${subButtonPressCount + 1} times.`);
        prevSubButtonPressCount = subButtonPressCount;
    }
    return [prevMainButtonPressCount, prevSubButtonPressCount];
}

/*
* Tracker button data
* Here we're processing the button pressed, the 7th/10th character in the decoded data is the
* amount of times the main/sub buttons were pressed respectively.
*/

function processButtonData(data, trackerNum, prevMainButtonPressCount, prevSubButtonPressCount) {
    const decodedData = data;

    if (trackerNum === 0) {
        let mainButtonPressCount = parseInt(decodedData[6], 16);  // 7th character (0-indexed)
        let subButtonPressCount = parseInt(decodedData[9], 16);  // 10th character (0-indexed)

        [prevMainButtonPressCount, prevSubButtonPressCount] = processButtonPress(trackerNum, mainButtonPressCount, subButtonPressCount, prevMainButtonPressCount, prevSubButtonPressCount);

    } else if (trackerNum === 1) {
        let mainButtonPressCount = parseInt(decodedData[6], 16);  // 7th character (0-indexed)
        let subButtonPressCount = parseInt(decodedData[9], 16);  // 10th character (0-indexed)

        [prevMainButtonPressCount, prevSubButtonPressCount] = processButtonPress(trackerNum, mainButtonPressCount, subButtonPressCount, prevMainButtonPressCount, prevSubButtonPressCount);
    }

    return [prevMainButtonPressCount, prevSubButtonPressCount];
}

/*
* Tracker battery info
* This contains the information about of the
* Can be used to forward to other software such as SlimeVR's server!
*/

function processBatteryData(data, trackerNum) {
    try {
        const batteryInfo = JSON.parse(data);
        console.log(`Tracker ${trackerNum} remaining: ${batteryInfo['battery remaining']}%`);
        console.log(`Tracker ${trackerNum} voltage: ${batteryInfo['battery voltage']}`);
        console.log(`Tracker ${trackerNum} Status: ${batteryInfo['charge status']}`);
    } catch (err) {
        console.log(`Error processing battery data: ${err}`);
    }
}

/*
* Decoding IMU packets
* The logic to decode the IMU packet received by the dongle. Thanks to sim1222's project for helping with the math :p
* https://github.com/sim1222/haritorax-slimevr-bridge/
*/

function decodeIMUPacket(data) {
    try {
        if (data.length < 14) {
            throw new Error("Too few bytes to decode IMU packet");
        }

        // Extract rotation values
        let rotation_x = data.readInt16LE(0);
        let rotation_y = data.readInt16LE(2);
        let rotation_z = data.readInt16LE(4);
        let rotation_w = data.readInt16LE(6);

        // Calculate rotation values
        let rotation = {
            x: rotation_x / 180.0 * 0.01,
            y: rotation_y / 180.0 * 0.01,
            z: rotation_z / 180.0 * 0.01 * -1.0,
            w: rotation_w / 180.0 * 0.01 * -1.0
        };

        // Extract gravity values
        let gravity_x, gravity_y, gravity_z;
        if (data.length >= 20) {
            gravity_x = data.readInt16LE(14);
            gravity_y = data.readInt16LE(16);
            gravity_z = data.readInt16LE(18);
        } else {
            gravity_x = gravity_y = gravity_z = 0.0;
        }

        // Calculate gravity values
        let gravity = {
            x: gravity_x / 256.0,
            y: gravity_y / 256.0,
            z: gravity_z / 256.0
        };

        return { rotation, gravity };
    } catch (error) {
        throw new Error("Error decoding IMU packet: " + error.message);
    }
}

