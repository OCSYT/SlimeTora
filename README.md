<!--suppress HtmlDeprecatedAttribute -->
<div align="center">
<img src="docs/icon.png" width="128px">

# SlimeTora

A program that connects the HaritoraX trackers to the [SlimeVR server](https://docs.slimevr.dev/server/index.html), supporting both the `HaritoraX Wireless` and `HaritoraX Wired` (1.1b/1.1/1.0). Supports `Bluetooth` (low energy), `Bluetooth` (classic) (w/ `COM`), and the `GX(6/2)` communication dongles (w/ `COM`).

Read the wiki to get started: https://github.com/OCSYT/SlimeTora/wiki

### For support, join the Discord server: https://discord.gg/XdfnKD9QVM

</div>

# Screenshots

|                      Connection section                       |                          Tracker info section                           |
| :-----------------------------------------------------------: | :---------------------------------------------------------------------: |
|   ![SlimeTora Connection section](docs/slimetora_ss_1.png)    |            ![Tracker Info section](docs/slimetora_ss_2.png)             |
|                    Global settings section                    |                    Per-tracker settings page (chest)                    |
| ![SlimeTora global settings section](docs/slimetora_ss_3.png) | ![SlimeTora per-tracker (chest) settings page](docs/slimetora_ss_4.png) |
|                         About section                         |                            Debugging section                            |
|      ![SlimeTora about section](docs/slimetora_ss_5.png)      |         ![SlimeTora debugging section](docs/slimetora_ss_6.png)         |

# Features

-   Support for all currently-released HaritoraX trackers
    -   Supports `HaritoraX Wireless` and `HaritoraX Wired` (1.1b/1.1/1.0)
    -   Unknown support for `Haritora` (before Shiftall // DIY)
-   `Bluetooth` (LE/Classic) and `COM`/`GX(6/2)` support (with all at the same time supported on `HaritoraX Wireless`)
-   Use of [haritorax-interpreter](https://github.com/JovannMC/haritorax-interpreter) package to process tracker data
-   **(v1.2.0-beta2)** Set up the app easily with settings auto-detection
    -   Automatically detect your tracker model, connection mode (including COM ports), and tracker settings
-   Set tracker settings per-tracker (`HaritoraX Wireless` only)
-   Localization support
    -   You can help translate the program! Clone the repo and make a new file under `/src/static/languages/` with a two-letter language identifier (ending with .json, e.g. `jp.json`)!
-   Linux support
    -   This was done as SlimeVR is supported on Linux, making this the first time HaritoraX trackers work on Linux!
    -   ..however this needs more testing. Please let us know if there are issues.
-   Button bindings to SlimeVR functions (e.g. resets)
    -   Read more on the [SlimeVR basics](https://github.com/OCSYT/SlimeTora/wiki/SlimeVR#resets--calibration) wiki page
-   Tracker visualization
-   Magnetometer statuses
-   Per-tracker battery information (in-app and SlimeVR/SteamVR)
-   Censor tracker serial numbers in-app
-   Debugging options
-   ..and many more improvements coming soon!

# Known issues

-   Battery and mag info for `HaritoraX Wireless` trackers (connected via BT) not displaying
    -   Fixed with the `v1.2.0` betas, check [releases](https://github.com/OCSYT/SlimeTora/releases).
-   Detection of being unable to access trackers unreliable
    -   Fixed with the `v1.2.0` betas, check [releases](https://github.com/OCSYT/SlimeTora/releases).
-   Battery information jumps to incorrect percentages/voltage randomly
    -   Unfortunately this is an issue I can't fix.. because it's literally an issue with the trackers themselves.
    -   This has been slightly mitigated with [v1.2.0-beta2](https://github.com/OCSYT/SlimeTora/releases/v1.2.0-beta2), which uses a "stable average" of the battery percentage and voltage instead.
-   **(v1.2.0-beta2)** "Auto-detect settings" assumes anyone with "HaritoraX Wireless" and "GX6" uses elbows, thus enabling "Bluetooth" even if the user does not have/use elbows
-   **(v1.2.0-beta2)** (?) Program may not launch correctly - actions in the app stop working until a restart
    -   Seems to be some sort of asynchronous issue again with the languages (which I have no idea why happens, because this issue should literally not exist)

# Documentation & Getting Started

Read the wiki to get started: https://github.com/OCSYT/SlimeTora/wiki

For support, join the Discord server: https://discord.gg/XdfnKD9QVM
