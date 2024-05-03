<!--suppress HtmlDeprecatedAttribute -->
<div align="center">
<img src="docs/icon.png" width="128px">


# SlimeTora
A program that connects the HaritoraX trackers to the [SlimeVR server](https://docs.slimevr.dev/server/index.html), currently supporting the `HaritoraX Wireless` with other trackers coming soon. Supports `Bluetooth` and the `GX(6/2)` communication dongles.

Read the wiki to get started: https://github.com/OCSYT/SlimeTora/wiki

</div>

# Screenshots

| Connection section | Tracker info section |
|:-:|:-:|
| ![SlimeTora Connection section](docs/slimetora_ss_1.png) | ![Tracker Info section](docs/slimetora_ss_2.png) |
|  Global settings section | Per-tracker settings page (chest) |
| ![SlimeTora global settings section](docs/slimetora_ss_3.png) | ![SlimeTora per-tracker (chest) settings page](docs/slimetora_ss_4.png) |
| About section | Debugging section |
| ![SlimeTora about section](docs/slimetora_ss_5.png) | ![SlimeTora debugging section](docs/slimetora_ss_6.png) |

# Features
+ Use of [haritorax-interpreter](https://github.com/JovannMC/haritorax-interpreter) package to process tracker data
+ `Bluetooth` and `GX(6/2)` support (with all at the same time supported)
+ Set tracker settings per-tracker
+ Localization support
  + You can help translate the program! Clone the repo and make a new file under `/src/static/languages/` with a two-letter language identifier (ending with .json, e.g. `jp.json`)!
+ Linux support
  + This was done as SlimeVR is supported on Linux, making this the first time HaritoraX trackers work on Linux!
  + ..however this is not tested at all. Please let us know if there are issues.
+ Tracker visualization
+ Magnetometer statuses
+ Censor tracker serial numbers
+ Debugging options
+ ..and many more improvements coming soon!

# Known issues
- Battery information is slightly inaccurate on first connection
  - Fixes after the tracker reports the battery information by itself
- Battery data sent to SlimeVR server isn't per-tracker
  - Cannot really fix this, instead the program sends the lowest battery data from all the trackers to the server

# Documentation

Read the wiki to get started: https://github.com/OCSYT/SlimeTora/wiki