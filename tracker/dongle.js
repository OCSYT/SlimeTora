// This is an adaptation of my (JovannMC) python code which communicates with the GX6 dongle, into JavaScript for the SlimeTora project
// https://github.com/JovannMC/haritora-gx6-poc/

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline')

let latestData = 'exampleData'

let ports = {};

const trackerPort = new Map([
    ['Tracker0', 'COM4'], // o0
    ['Tracker1', 'COM4'], // o1
    ['Tracker2', 'COM5'], // o0
    ['Tracker3', 'COM5'], // o1
    ['Tracker4', 'COM6'], // o0
    ['Tracker5', 'COM6']  // o1
]);

let trackerData = new Map([
    ['Tracker0', 'Tracker0-Data'], // COM4-Tracker0
    ['Tracker1', 'Tracker1-Data'], // COM4-Tracker1
    ['Tracker2', 'Tracker2-Data'], // COM5-Tracker0
    ['Tracker3', 'Tracker3-Data'], // COM5-Tracker1
    ['Tracker4', 'Tracker4-Data'], // COM6-Tracker0
    ['Tracker5', 'Tracker5-Data']  // COM6-Tracker1
]);

let trackerSettings = new Map([
    ['Tracker0', 'Tracker0-Setting'], // COM4-Tracker0
    ['Tracker1', 'Tracker1-Setting'], // COM4-Tracker1
    ['Tracker2', 'Tracker2-Setting'], // COM5-Tracker0
    ['Tracker3', 'Tracker3-Setting'], // COM5-Tracker1
    ['Tracker4', 'Tracker4-Setting'], // COM6-Tracker0
    ['Tracker5', 'Tracker5-Setting']  // COM6-Tracker1
]);

let trackerBattery = new Map([
    ['Tracker0', 'Tracker0-Battery'], // COM4-Tracker0
    ['Tracker1', 'Tracker1-Battery'], // COM4-Tracker1
    ['Tracker2', 'Tracker2-Battery'], // COM5-Tracker0
    ['Tracker3', 'Tracker3-Battery'], // COM5-Tracker1
    ['Tracker4', 'Tracker4-Battery'], // COM6-Tracker0
    ['Tracker5', 'Tracker5-Battery']  // COM6-Tracker1
]);

/*
*   Settings
*/

const portNames = ['COM4', 'COM5', 'COM6'];
const baudRate = 500000; // from the haritora_setting.json in HaritoraConfigurator

function startDongleCommunication() {
    portNames.forEach(portName => {
        const port = new SerialPort({
            path: portName,
            baudRate: baudRate
        });
        const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

        ports[portName] = port;

        function getTrackerId(trackerNum, portName) {
            if (portName === 'COM4') {
                trackerKey = `Tracker${trackerNum}`;
            } else if (portName === 'COM5') {
                trackerKey = `Tracker${trackerNum + 2}`;
            } else if (portName === 'COM6') {
                trackerKey = `Tracker${trackerNum + 4}`;
            } else {
                console.log(`Invalid port name: ${portName}`);
                return null;
            }
            return trackerKey;
        }
    
        /*
        *   Data processing
        */
    
        function processData(data) {
            const firstColonIndex = data.indexOf(':');
            if (firstColonIndex !== -1) {
                // Makes sure to only split the first colon found
                const label = data.substring(0, firstColonIndex);
                const dataContent = data.substring(firstColonIndex + 1);
                const trackerNumber = null;
                if (label.includes('X')) {
                    // IMU tracker data
                    trackerNumber = parseInt(label.split('X').pop(), 10);
                    processTrackerData(dataContent, trackerNumber);
                } else if (label.includes('a')) {
                    // Other tracker data
                    trackerNumber = parseInt(label.split('a').pop(), 10);
                    processOtherTrackerData(dataContent, trackerNumber);
                } else if (label.includes('r')) {
                    // Tracker button info
                    trackerNumber = parseInt(label.split('r').pop(), 10);
                    processButtonData(dataContent, trackerNumber);
                } else if (label.includes('v')) {
                    // Tracker battery info
                    trackerNumber = parseInt(label.split('v').pop(), 10);
                    processBatteryData(dataContent, trackerNumber);
                } else if (label.includes('o')) {
                    trackerNumber = parseInt(label.split('o').pop());
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
            //console.log(`${portName} - Received ankle motion data: ${data}`);
        }
    
        function logRotationAndGravity(trackerNum, rotation, gravity) {
            //console.log(`${portName} - Tracker ${trackerNum} rotation: (${rotation.x.toFixed(5)}, ${rotation.y.toFixed(5)}, ${rotation.z.toFixed(5)}, ${rotation.w.toFixed(5)})`);
            //console.log(`${portName} - Tracker ${trackerNum} gravity: (${gravity.x.toFixed(5)}, ${gravity.y.toFixed(5)}, ${gravity.z.toFixed(5)})`);
        }
    
        function processTrackerData(data, trackerNum) {
            // Set raw tracker IMU data in map
            trackerKey = getTrackerId(trackerNum, portName)
            if (trackerData.has(trackerKey)) {
                trackerData.set(trackerKey, data);
            } else {
                console.log(`No data found for ${trackerKey}`);
            }
    
            // Process raw tracker IMU data
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
    
        /*
        * Tracker button data
        * Here we're processing the button pressed, the 7th/10th character in the decoded data is the
        * amount of times the main/sub buttons were pressed respectively.
        */
    
        function processButtonData(data, trackerNum, prevMainButtonPressCount, prevSubButtonPressCount) {
            if (trackerNum === 0) {
                let mainButtonPressCount = parseInt(data[6], 16);  // 7th character (0-indexed)
                let subButtonPressCount = parseInt(data[9], 16);  // 10th character (0-indexed)
    
                [prevMainButtonPressCount, prevSubButtonPressCount] = processButtonPress(trackerNum, mainButtonPressCount, subButtonPressCount, prevMainButtonPressCount, prevSubButtonPressCount);
            } else if (trackerNum === 1) {
                let mainButtonPressCount = parseInt(data[6], 16);  // 7th character (0-indexed)
                let subButtonPressCount = parseInt(data[9], 16);  // 10th character (0-indexed)
    
                [prevMainButtonPressCount, prevSubButtonPressCount] = processButtonPress(trackerNum, mainButtonPressCount, subButtonPressCount, prevMainButtonPressCount, prevSubButtonPressCount);
            }
    
            return [prevMainButtonPressCount, prevSubButtonPressCount];
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
        * Tracker battery info
        * This contains the information about the battery, voltage, and charge status of the tracker.
        * Can be used to forward to other software such as SlimeVR's server!
        */
    
        function processBatteryData(data, trackerNum) {
            // Set tracker battery data in map
            trackerKey = getTrackerId(trackerNum, portName)
            if (trackerBattery.has(trackerKey)) {
                trackerBattery.set(trackerKey, data);
            } else {
                console.log(`No data found for ${trackerKey}`);
            }

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
    
        function setTrackerSettings(trackerName, fpsMode, sensorMode, sensorAutoCorrection, ankleMotionDetection) {
            console.log(`Setting tracker settings for ${trackerName}...`)
            const sensorModeBit = sensorMode === 1 ? '1' : '0'; // If a value other than 1, default to mode 2
            const postureDataRateBit = fpsMode === 50 ? '0' : '1'; // If a value other than 1, default to 100FPS
            const ankleMotionDetectionBit = ankleMotionDetection ? '1' : '0'; // If a value other than 1, default to disabled
            let sensorAutoCorrectionBit = 0;
            if (sensorAutoCorrection.includes("Accel")) sensorAutoCorrectionBit |= 0x01;
            if (sensorAutoCorrection.includes("Gyro")) sensorAutoCorrectionBit |= 0x02;
            if (sensorAutoCorrection.includes("Mag")) sensorAutoCorrectionBit |= 0x04;

            let hexValue = null;
            let modeValueBuffer = null;
            
            if (trackerName === 'Tracker0' || trackerName === 'Tracker2' || trackerName === 'Tracker4') {
                // o0
                let number = Number(trackerName.match(/\d+/)[0]);
                number += 1;
                otherTrackerName = `Tracker${number}`;
            
                hexValue = `00000${postureDataRateBit}${sensorModeBit}010${sensorAutoCorrectionBit}00${ankleMotionDetectionBit}`;
                modeValueBuffer = Buffer.from("o0:" + hexValue + '\r\n' + "o1:" + trackerSettings.get(otherTrackerName) + '\r\n', 'utf-8');
                console.log(`${portName} - ${trackerName} aka o0 - Calculated hex value: ${hexValue}`);
            } else if (trackerName === 'Tracker1' || trackerName === 'Tracker3' || trackerName === 'Tracker5') {
                // o1
                let number = Number(trackerName.match(/\d+/)[0]);
                number -= 1;
                otherTrackerName = `Tracker${number}`;
            
                hexValue = `00000${postureDataRateBit}${sensorModeBit}010${sensorAutoCorrectionBit}00${ankleMotionDetectionBit}`;
                modeValueBuffer = Buffer.from("o0:" + trackerSettings.get(otherTrackerName) + '\r\n' + "o1:" + hexValue + '\r\n', 'utf-8');
                console.log(`${portName} - ${trackerName} aka o1 - Calculated hex value: ${hexValue}`);
            } else {
                console.log(`Invalid tracker name: ${trackerName}`);
                return;
            }

            console.log(`${portName} - Setting the following settings onto the trackers:`)
            console.log(`${portName} - FPS mode: ${fpsMode}`)
            console.log(`${portName} - Sensor mode: ${sensorMode}`)
            console.log(`${portName} - Sensor auto correction: ${sensorAutoCorrection}`)
            console.log(`${portName} - Ankle motion detection: ${ankleMotionDetection}`)
            console.log(`${portName} - Raw hex data calculated to be sent: ${hexValue}`)

            try {
                console.log(`${portName} - Sending tracker settings to ${trackerName} which is ${trackerPort.get(trackerName)}: ${modeValueBuffer.toString()}`);
                ports[trackerPort.get(trackerName)].write(modeValueBuffer, (err) => {
                    if (err) {
                        console.error(`${trackerPort.get(trackerName)} - Error writing data to serial port: ${err.message}`);
                    } else {
                        trackerSettings.set(trackerName, hexValue);
                        console.log(`${trackerPort.get(trackerName)} - Data written to serial port for tracker ${trackerName} on ${trackerPort.get(trackerName)}: ${modeValueBuffer.toString()}`);
                    }
                });
            } catch (error) {
                console.error('Error sending tracker settings:', error.message);
            }
        }

        function setAllTrackerSettings(fpsMode, sensorMode, sensorAutoCorrection, ankleMotionDetection) {
            try {
                const sensorModeBit = sensorMode === 1 ? '1' : '0';
                const postureDataRateBit = fpsMode === 100 ? '1' : '0';
                let sensorAutoCorrectionBit = 0;
                if (sensorAutoCorrection.includes("Accel")) sensorAutoCorrectionBit |= 0x01;
                if (sensorAutoCorrection.includes("Gyro")) sensorAutoCorrectionBit |= 0x02;
                if (sensorAutoCorrection.includes("Mag")) sensorAutoCorrectionBit |= 0x04;
                const ankleMotionDetectionBit = ankleMotionDetection ? '1' : '0';
        
                const hexValue = `00000${postureDataRateBit}${sensorModeBit}010${sensorAutoCorrectionBit}00${ankleMotionDetectionBit}`;
                const modeValueBuffer = Buffer.from('o0:' + hexValue + '\r\n' + 'o1:' + hexValue + '\r\n', 'utf-8');
    
                console.log(`${portName} - Setting the following settings onto all the trackers:`)
                console.log(`${portName} - FPS mode: ${fpsMode}`)
                console.log(`${portName} - Sensor mode: ${sensorMode}`)
                console.log(`${portName} - Sensor auto correction: ${sensorAutoCorrection}`)
                console.log(`${portName} - Ankle motion detection: ${ankleMotionDetection}`)
                console.log(`${portName} - Raw hex data calculated to be sent: ${hexValue}`)
        
                for (let portName in ports) {
                    let port = ports[portName];
                    port.write(modeValueBuffer, (err) => {
                        if (err) {
                            console.error(`${portName} - Error writing data to serial port: ${err.message}`);
                        } else {
                            console.log(`${portName} - Data written to serial port: ${modeValueBuffer.toString()}`);
                            trackerSettings.forEach((value, key) => {
                                trackerSettings.set(key, hexValue);
                            });
                        }
                    });
                }
            } catch (error) {
                console.error('Error sending tracker settings:', error.message);
            }
        }
    
        function processTrackerSettings(data, trackerNum) {
            // Set raw tracker settings data in map
            trackerKey = getTrackerId(trackerNum, portName)
            console.log(`Processing tracker settings for tracker ${trackerKey} aka ${trackerNum}...`)

            // Process tracker settings data
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
    
            console.log(`${portName} - Tracker ${trackerKey} aka ${trackerNum} settings:`);
            console.log(`${portName} - Sensor Mode: ${sensorModeText}`);
            console.log(`${portName} - Posture Data Transfer Rate: ${postureDataRateText}`);
            console.log(`${portName} - Sensor Auto Correction: ${sensorAutoCorrectionText}`);
            console.log(`${portName} - Ankle Motion Detection: ${ankleMotionDetectionText}`);
            console.log(`${portName} - Raw data: ${data}`)

            if (trackerSettings.has(trackerKey) && trackerSettings.get(trackerKey).includes('Setting')) {
                trackerSettings.set(trackerKey, data);
            }
        }
    
        port.on('open', () => {
            
        });
    
        parser.on('data', (data) => {
            latestData = data;
            processData(data);
        });
    
        port.on('error', (err) => {
            console.error('Serial port error: ', err.message);
        });

        module.exports.processTrackerSettings = processTrackerSettings
        module.exports.setTrackerSettings = setTrackerSettings
        module.exports.setAllTrackerSettings = setAllTrackerSettings
    })
}

function getTrackerData() {
    return trackerData
}

function getTrackerSettings() {
    return trackerSettings
}

function getTrackerBattery() {
    return trackerBattery
}

function getLatestData() {
    return latestData
}

module.exports = {
    startDongleCommunication: startDongleCommunication,
    getTrackerData: getTrackerData,
    getTrackerSettings: getTrackerSettings,
    getTrackerBattery: getTrackerBattery,
    getLatestData: getLatestData
};