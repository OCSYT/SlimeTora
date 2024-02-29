// This is an adaptation of my (JovannMC) python code which communicates with the GX6 dongle, into JavaScript for the SlimeTora project
// https://github.com/JovannMC/haritora-gx6-poc/

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline')

/*
*   Serial port setup
*/

let portNames = ['COM4', 'COM5', 'COM6']
const baudRate = 500000; // from the haritora_setting.json in HaritoraConfigurator

portNames.forEach( portName => {
    /*
    *   Settings
    */

    const port = new SerialPort({
        path: portName,
        baudRate: baudRate
    });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    /*
    *   Data processing
    */

    function processData(data) {
        const firstColonIndex = data.indexOf(':');
        if (firstColonIndex !== -1) {
            // Makes sure to only split the first colon found
            const label = data.substring(0, firstColonIndex);
            const dataContent = data.substring(firstColonIndex + 1);
            if (label.includes('X')) {
                // IMU tracker data
                const trackerNumber = parseInt(label.split('X').pop(), 10);
                processTrackerData(dataContent, trackerNumber);
            } else if (label.includes('a')) {
                // Other tracker data
                const trackerNumber = parseInt(label.split('a').pop(), 10);
                processOtherTrackerData(dataContent, trackerNumber);
            } else if (label.includes('r')) {
                // Tracker button info
                const trackerNumber = parseInt(label.split('r').pop(), 10);
                processButtonData(dataContent, trackerNumber);
            } else if (label.includes('v')) {
                // Tracker battery info
                const trackerNumber = parseInt(label.split('v').pop(), 10);
                processBatteryData(dataContent, trackerNumber);
            } else if (label.includes('o')) {
                const trackerNumber = parseInt(label.split('o').pop());
                if (!isNaN(trackerNumber)) {
                    processTrackerSettings(dataContent, trackerNumber)
                } else {
                    console.log(`${portName} - Unknown data received: ${data}`);
                }
            } else {
                console.log(`${portName} - Unknown data received: ${data}`);
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
        console.log(`${portName} - Received ankle motion data: ${data}`);
    }

    function logRotationAndGravity(trackerNum, rotation, gravity) {
        console.log(`${portName} - Tracker ${trackerNum} rotation: (${rotation.x.toFixed(5)}, ${rotation.y.toFixed(5)}, ${rotation.z.toFixed(5)}, ${rotation.w.toFixed(5)})`);
        console.log(`${portName} - Tracker ${trackerNum} gravity: (${gravity.x.toFixed(5)}, ${gravity.y.toFixed(5)}, ${gravity.z.toFixed(5)})`);
    }

    function processTrackerData(data, trackerNum) {
        try {
            if (data.endsWith('==') && data.length === 24) {
                // Other trackers
                try {
                    const { rotation, gravity } = decodeIMUPacket(data);
                    logRotationAndGravity(trackerNum, rotation, gravity);
                } catch (err) {
                    console.log(`${portName} - Error decoding tracker ${trackerNum} IMU packet: ${data}`);
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
                        console.log(`${portName} - Error decoding tracker ${trackerNum} IMU packet: ${decodedData}`);
                    }
                } else {
                    console.log(`${portName} - Invalid or short data received. Skipping processing of data: ${data}`);
                }
            }
        } catch (err) {
            console.log(`${portName} - Error decoding data: ${data}`);
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
            console.log(`${portName} - Searching for tracker ${trackerNum}...`);
        } else {
            console.log(`${portName} - Other tracker ${trackerNum} data processed: ${decodedData}`);
        }
    }

    function processButtonPress(trackerNum, mainButtonPressCount, subButtonPressCount, prevMainButtonPressCount, prevSubButtonPressCount) {
        if (mainButtonPressCount !== prevMainButtonPressCount) {
            console.log(`${portName} - Tracker ${trackerNum} main button pressed. Pressed ${mainButtonPressCount + 1} times.`);
            prevMainButtonPressCount = mainButtonPressCount;
        }
        if (subButtonPressCount !== prevSubButtonPressCount) {
            console.log(`${portName} - Tracker ${trackerNum} sub button pressed. Pressed ${subButtonPressCount + 1} times.`);
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
            console.log(`${portName} - Tracker ${trackerNum} remaining: ${batteryInfo['battery remaining']}%`);
            console.log(`${portName} - Tracker ${trackerNum} voltage: ${batteryInfo['battery voltage']}`);
            console.log(`${portName} - Tracker ${trackerNum} Status: ${batteryInfo['charge status']}`);
        } catch (err) {
            console.log(`${portName} - Error processing battery data: ${err}`);
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

            const buffer = Buffer.from(data, 'base64');
            const rotationX = buffer.readInt16LE(0);
            const rotationY = buffer.readInt16LE(2);
            const rotationZ = buffer.readInt16LE(4);
            const rotationW = buffer.readInt16LE(6);
            const gravityX = buffer.readInt16LE(8);
            const gravityY = buffer.readInt16LE(10);
            const gravityZ = buffer.readInt16LE(12);

            const rotation = {
                x: rotationX / 180.0 * 0.01,
                y: rotationY / 180.0 * 0.01,
                z: rotationZ / 180.0 * 0.01 * -1.0,
                w: rotationW / 180.0 * 0.01 * -1.0
            };

            const gravity = {
                x: gravityX / 256.0,
                y: gravityY / 256.0,
                z: gravityZ / 256.0
            };

            return { rotation, gravity };
        } catch (error) {
            throw new Error("Error decoding IMU packet: " + error.message);
        }
    }

    /*
    *   Tracker settings
    */

    function setTrackerSettings(fpsMode, sensorMode, sensorAutoCorrection, ankleMotionDetection) {
        try {
            const sensorModeBit = sensorMode === 1 ? '1' : '0';
            const postureDataRateBit = fpsMode === 100 ? '1' : '0';
            let sensorAutoCorrectionBit = 0;
            if (sensorAutoCorrection.includes("Accel")) sensorAutoCorrectionBit |= 0x01;
            if (sensorAutoCorrection.includes("Gyro")) sensorAutoCorrectionBit |= 0x02;
            if (sensorAutoCorrection.includes("Mag")) sensorAutoCorrectionBit |= 0x04;
            const ankleMotionDetectionBit = ankleMotionDetection ? '1' : '0';
    
            const hexValue = `00000${postureDataRateBit}${sensorModeBit}010${sensorAutoCorrectionBit}00${ankleMotionDetectionBit}`;
    
            const labelO0 = 'o0:';
            const labelO1 = 'o1:';
            const modeValueBuffer = Buffer.from(labelO0 + hexValue + '\r\n' + labelO1 + hexValue, 'utf-8');

            console.log(`${portName} - Setting the following settings onto the trackers:`)
            console.log(`${portName} - FPS mode: ${fpsMode}`)
            console.log(`${portName} - Sensor mode: ${sensorMode}`)
            console.log(`${portName} - Sensor auto correction: ${sensorAutoCorrection}`)
            console.log(`${portName} - Ankle motion detection: ${ankleMotionDetection}`)
            console.log(`${portName} - Raw hex data calculated to be sent: ${hexValue}`)
    
            port.write(modeValueBuffer, (err) => {
                if (err) {
                    console.error(`${portName} - Error writing data to serial port: ${err.message}`);
                } else {
                    console.log(`${portName} - Data written to serial port: ${modeValueBuffer.toString()}`);
                }
            });
        } catch (error) {
            console.error('Error sending tracker settings:', error.message);
        }
    }

    function processTrackerSettings(data, trackerNum) {
        const sensorMode = parseInt(data[6]);
        const postureDataRate = parseInt(data[5]);
        const sensorAutoCorrection = parseInt(data[10]);
        const ankleMotionDetection = parseInt(data[13]);

        const sensorModeText = sensorMode === 0 ? "Mode 2" : "Mode 1";
        const postureDataRateText = postureDataRate === 0 ? "50FPS" : "100FPS";
        const ankleMotionDetectionText = ankleMotionDetection === 0 ? "Disabled" : "Enabled";

        const sensorAutoCorrectionComponents = [];
        if (sensorAutoCorrection & 1) {
            sensorAutoCorrectionComponents.push("Accel");
        }
        if (sensorAutoCorrection & 2) {
            sensorAutoCorrectionComponents.push("Gyro");
        }
        if (sensorAutoCorrection & 4) {
            sensorAutoCorrectionComponents.push("Mag");
        }

        const sensorAutoCorrectionText = sensorAutoCorrectionComponents.join(', ');

        console.log(`${portName} - Tracker ${trackerNum} settings:`);
        console.log(`${portName} - Sensor Mode: ${sensorModeText}`);
        console.log(`${portName} - Posture Data Transfer Rate: ${postureDataRateText}`);
        console.log(`${portName} - Sensor Auto Correction: ${sensorAutoCorrectionText}`);
        console.log(`${portName} - Ankle Motion Detection: ${ankleMotionDetectionText}`);
        console.log(`${portName} - Raw data: ${data}`)
    }

    parser.on('data', (data) => {
        processData(data);
    });

    port.on('error', (err) => {
        console.error('Error:', err.message);
    });
})

/*
*   Rotation and gravity classes
*/

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