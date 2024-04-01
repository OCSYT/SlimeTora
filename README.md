# SlimeTora (rewrite fork)
## **THIS IS NOT IN A WORKING STATE, VERY MUCH STILL WIP**

A program that connects the HaritoraX Wireless trackers to the [SlimeVR server](https://docs.slimevr.dev/server/index.html), supporting the GX6 communication dongle

This fork rewrites improves on the stability and performance of the app by rewriting the entire program from scratch; frontend and backend.

# Known issues
- N/A

# How to use
- Install the [SlimeVR server](https://docs.slimevr.dev/server/index.html)
- Download the latest [SlimeTora](https://github.com/OCSYT/SlimeTora/releases/latest) release
- Extract the zip file and run `SlimeTora.exe`
- Select the mode to connect to the trackers
- (GX6) Select the 3 COM ports that your trackers are on
  - Usually, this is the first three (consecutive) available ports. COM1-COM3 are usually already used by other programs, so they are likely COM4, COM5, and COM6.
  - Check `Device Manager` to see what ports are being used by the trackers.
- Turn on your trackers and press `Start connection`
- Assign your trackers in SlimeVR and enjoy! :)

Make sure you connect all trackers before assigning the roles in SlimeVR, and go through the usual calibration steps in the SlimeVR software after.

# Development
- Clone the project - `git clone https://github.com/JovannMC/SlimeTora.git`
- Install the dependencies - `npm i`
- Start the dev environment - `npm start`