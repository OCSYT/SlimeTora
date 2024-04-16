<!--suppress HtmlDeprecatedAttribute -->
<div align="center">
<img src="docs/icon.png" width="128px">


# SlimeTora
## The rewrite is almost complete and v1.0.0 will be released soon along with a video. Thanks for the support! You'll find full releases on the parent repo when released: https://github.com/OCSYT/SlimeTora
A program that connects the HaritoraX Wireless trackers to the [SlimeVR server](https://docs.slimevr.dev/server/index.html), supporting `Bluetooth` and the `GX(6/2)` communication dongles.

This fork rewrites improves on the stability and performance of the app by rewriting the entire program from scratch; frontend and backend.

</div>

# Screenshots

| SlimeTora connection page | SlimeTora tracker info page |
|:-:|:-:|
| ![SlimeTora connection page](docs/slimetora_ss_1.png) | ![SlimeTora tracker info page](docs/slimetora_ss_2.png) |
| SlimeTora settings page | SlimeTora about page |
| ![SlimeTora settings page](docs/slimetora_ss_3.png) | ![SlimeTora about page](docs/slimetora_ss_4.png) |

# New features
+ Entire frontend and backend rewrite (with [Bulma](https://bulma.io/) and [haritorax-interpreter](https://github.com/JovannMC/haritorax-interpreter))
  + The program now has a new UI, the code is cleaner and more maintainable, and should hopefully improve stability/performance.
+ Package app files with `asar`
  + No need to extract thousands of files anymore 😅
+ `Bluetooth` and `GX(6/2)` support (with all at the same time supported)
  + Welcome elbow tracker users!
+ Set tracker settings per-tracker (partial support)
  + Knee trackers currently have issues, and Bluetoth is not yet supported. Both are disabled automatically.
+ Localization support
  + You can help translate the program! Clone the repo and make a new file under `/src/languages/` with the two-letter language identifier (ending with .json)!
+ Linux support
  + This was done as SlimeVR is supported on Linux, and the first time HaritoraX trackers work on Linux!
  + ..however this is not tested at all. Please let me know if there are issues.
+ Dynamically grab version number from package.json (instead of relying on manually changing it per release)
+ Censor tracker serial numbers
+ Many new ways to debug the program
+ New SlimeTora logo
+ ..and many more improvements coming soon!

# Known issues
- Tracker auto correction and magnetometer (sensor mode) settings do not work for BT
  - Requires an update to [haritorax-interpreter](https://github.com/JovannMC/haritorax-interpreter). Help appreciated!
- Bluetooth tracker's battery report stays on N/A until reported by trackers (instead of instantly grabbing them)

# How to use
- Install the [SlimeVR server](https://docs.slimevr.dev/server/index.html)
- Download and run the latest [SlimeTora](https://github.com/JovannMC/SlimeTora/releases/latest) release
- Select the mode to connect to the trackers (BT/GX or both)
- (`GX(6/2)` dongles) Select up up to 4 COM ports that your trackers are on (3 if only using GX6, 4 if using GX6+GX2)
  - Usually, this is the first four (consecutive) available ports. `COM1`/`COM2` are usually already used by other devices, so the ports are likely `COM3`, `COM4`, `COM5` (and `COM6` for GX2)
  - Check `Device Manager` to see what ports are being used by the trackers as `USB Serial Device`s
    ![Image of Device Manager under the ports category](docs/comports.png)
- Start the SlimeVR server
- Turn on your trackers and press `Start connection`
- Assign your trackers in [SlimeVR server](https://docs.slimevr.dev/server/index.html) and enjoy! :)

# Development
- Clone the project - `git clone https://github.com/JovannMC/SlimeTora.git`
- Install the dependencies - `npm i`
- Start the dev environment - `npm start` or `npm run dev`
