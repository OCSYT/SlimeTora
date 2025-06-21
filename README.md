<!--suppress HtmlDeprecatedAttribute -->
<div align="center">
<img src="docs/icon.png" width="128px">

# SlimeTora

A program that connects the HaritoraX trackers to the [SlimeVR server](https://docs.slimevr.dev/server/index.html), supporting the `HaritoraX 2`, `HaritoraX Wireless` and`HaritoraX Wired` (1.1b/1.1/1.0). Supports `Bluetooth` (low energy), `Bluetooth` (classic) (w/ `COM`), and the `GX(6/2)` communication dongles (w/ `COM`).

Read the wiki to get started: <https://github.com/OCSYT/SlimeTora/wiki>

### For support, join the Discord server: <https://discord.gg/XdfnKD9QVM>

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

- Support for all currently-released HaritoraX trackers
  - Supports `HaritoraX 2`, `HaritoraX Wireless`, and `HaritoraX Wired` (1.1b/1.1/1.0)
  - Unknown support for `Haritora` (before Shiftall // DIY)
- `Bluetooth` (LE/Classic) and `COM`/`GX(6/2)` support (with all at the same time supported on `HaritoraX 2` & `HaritoraX Wireless`)
- Use of [haritorax-interpreter](https://github.com/JovannMC/haritorax-interpreter) package to process tracker data
- Get started with the program (and SlimeVR Server) easily through the guided onboarding process!
  - Through the "automatic setup", run auto-detection to let the program **_set itself up for you_**!
  - Automatically detect your tracker model, connection mode (including COM ports), and tracker settings
- Manage GX(6/2) dongles in-app - tracker pairing & changing 2.4GHz channels
- Set tracker settings per-tracker (`HaritoraX 2` & `HaritoraX Wireless` only)
- Turn off one or all trackers (`HaritoraX 2` & `HaritoraX Wireless` only)
- Localization support
  - You can help translate the program! Clone the repo and make a new file under `/src/static/languages/` with a two-letter language identifier (ending with .json, e.g. `jp.json`)!
- Linux & macOS support
  - This was done as SlimeVR is supported on Linux and macOS, making this the first time HaritoraX trackers work on Linux and macOS!
- Button bindings to SlimeVR functions (e.g. resets)
  - Read more on the [SlimeVR basics](https://github.com/OCSYT/SlimeTora/wiki/SlimeVR#resets--calibration) wiki page
- Update checking (for app and translations)
- Tracker visualization
- Magnetometer statuses
- Per-tracker battery information (in-app and SlimeVR/SteamVR)
- Compact view of the trackers
- Censor tracker serial numbers in-app
- Debugging options
- ..and many more improvements coming soon!

# Known issues

- Bluetooth issues
  - e.g. unable to find trackers at all, some disconnections
  - This seems to be affecting a certain percentage of users and I'm unsure why this is the case - it seems to stem from a problem with the Bluetooth NPM package being used so it seems to be out of my control.
  - SlimeTora v2 will hopefully fix issues for these people, but there are some ways and builds to hopefully minimize these on my Discord and v1.5.1: <https://discord.gg/XdfnKD9QVM>
- macOS builds are unnecessarily large
- Battery information jumps to incorrect percentages/voltage randomly
  - Unfortunately this is an issue I can't fix.. because it's literally an issue with the trackers reporting those random values themselves
  - This has been slightly mitigated with [v1.2.0](https://github.com/OCSYT/SlimeTora/releases/v1.2.0), which uses a "stable average" of the battery percentage and voltage instead
- Running "auto-detection" more than once without restarting breaks tracker settings auto-detection (device/ports detection still works)
- Auto-detection _still_ does not work for HaritoraX Wired (1.1b/1.1/1.0) users

# Documentation - getting started & development

Read the wiki to get started on using/developing the program: <https://github.com/OCSYT/SlimeTora/wiki>

For support, join the Discord server: <https://discord.gg/XdfnKD9QVM>

# Support the project

Love SlimeTora? You can show your support to the developers of SlimeTora through their Ko-Fi links, check them out!

- JovannMC - <https://ko-fi.com/JovannMC>
- BracketProto (OCSYT) - <https://ko-fi.com/bracketproto>

### Special thanks to the project's supporters

- LuzianVR - <https://l.femboyfurry.net/supporters/luzian>
- The SlimeVR team:
  - Gorbit - <https://l.femboyfurry.net/supporters/gorbit>
  - Meia - <https://l.femboyfurry.net/supporters/meia>
  - Aoki - <https://l.femboyfurry.net/supporters/aoki>
- Ivy / Laker Turner - <https://l.femboyfurry.net/supporters/laker>
