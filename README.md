<!--suppress HtmlDeprecatedAttribute -->
<div align="center">
<img src="docs/icon.png" width="128px">


# SlimeTora
A program that connects the HaritoraX trackers to the [SlimeVR server](https://docs.slimevr.dev/server/index.html), supporting both the `HaritoraX ireless` and `HaritoraX Wired` (1.1b/1.1/1.0). Supports `Bluetooth` (low energy), `COM` connections, and the `GX(6/2)` communication dongles (w/ `COM`).

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
+ `Bluetooth` and `COM`/`GX(6/2)` support (with all at the same time supported)
+ Set tracker settings per-tracker (wireless only)
+ Localization support
  + You can help translate the program! Clone the repo and make a new file under `/src/static/languages/` with a two-letter language identifier (ending with .json, e.g. `jp.json`)!
+ Linux support
  + This was done as SlimeVR is supported on Linux, making this the first time HaritoraX trackers work on Linux!
  + ..however this needs more testing. Please let us know if there are issues.
+ Button bindings to SlimeVR functions (e.g. resets)
+ Tracker visualization
+ Magnetometer statuses
+ Censor tracker serial numbers
+ Debugging options
+ ..and many more improvements coming soon!

# Known issues
- Battery information jumps to incorrect percentages/voltage randomly
  - Unfortunately this is an issue I can't fix.. because it's literally an issue with the trackers themsleves.
- Detection of being unable to access trackers unreliable(?)

# Documentation & Getting Started

Read the wiki to get started: https://github.com/OCSYT/SlimeTora/wiki
