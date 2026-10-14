# Cross-game station layer

Checked 2026-10-14. These are settings the station could apply for any game,
outside the game's own files. "Unverified" means not tested on a real station.

## Summary

| Layer | Scriptable from PowerShell, no install? | Verdict |
|---|---|---|
| Windows pointer speed / Enhance Pointer Precision | Yes (`SystemParametersInfo`), already done | Full |
| Resolution, refresh rate | Yes, `ChangeDisplaySettingsEx` (Win32, via `Add-Type`) | Full |
| Stretched (GPU/display scaling) | Partly: Win32 `DMDFO_STRETCH` / `SetDisplayConfig` scaling; vendor APIs need a native helper | Partial |
| NVIDIA per-game driver profile | Needs NVAPI DRS or Profile Inspector (third-party exe) | Partial |
| Steam Input per-game layout | Files only per Steam account; shared configs need the Steam client UI | Partial |
| Controller deadzones | Per game or per Steam Input layout; no Windows-wide XInput deadzone | Per game |
| Default audio device / volume | Volume: documented Core Audio. Default device: undocumented `IPolicyConfig` | Full (with caveat) |
| ROG mouse DPI / polling / LOD | Onboard; set by Armoury Crate or Gear Link (browser). No public CLI | Manual / staff |
| ROG keyboard actuation / Rapid Trigger / Speed Tap | Same: Armoury Crate or Gear Link, with Companion | Manual / staff |

## Windows mouse (done)

Pointer speed and Enhance Pointer Precision via `SystemParametersInfo`, with
baseline and restore (see `docs/games/counter-strike-2.md`). Sensitivity conversion
works from cm/360: when player DPI and station DPI differ, scale the in-game
sensitivity by `playerDpi / stationDpi`. This is game-agnostic.

## Display

- **Resolution and refresh rate:** `EnumDisplaySettings` then
  `ChangeDisplaySettingsEx` with `dmPelsWidth`, `dmPelsHeight` and
  `dmDisplayFrequency`, setting the matching `dmFields` bits. Start from the
  DEVMODE returned by `EnumDisplaySettings`. Use `CDS_UPDATEREGISTRY` only if
  the change must survive a restart; better to apply it per session and
  reset to the baseline mode.
- **Stretched without vendor tools:** set `DM_DISPLAYFIXEDOUTPUT` and
  `dmDisplayFixedOutput = DMDFO_STRETCH`. Microsoft documents that the legacy
  flag maps to stretched scaling in the newer display-configuration model.
  The modern call is `SetDisplayConfig` with `DISPLAYCONFIG_SCALING_STRETCHED`
  on the path's target. Whether the NVIDIA/AMD "perform scaling on GPU vs
  display" choice overrides it is **unverified**. Test on the event GPUs.
  Many esports titles (CS2) set the in-game resolution themselves; the
  desktop mode matters only for the scaling mode.
- **NVIDIA:** `nvidia-smi` does not control display scaling. NVAPI has it:
  `NvAPI_DISP_SetDisplayConfig` with
  `NV_DISPLAYCONFIG_PATH_ADVANCED_TARGET_INFO.scaling` =
  `NV_SCALING_GPU_SCALING_TO_NATIVE` (2, "Force GPU – Full Screen"),
  `…_TO_ASPECT_SCANOUT_TO_NATIVE` (5, aspect ratio) or
  `NV_SCALING_GPU_INTEGER_ASPECT_SCALING` (8) (NVIDIA/nvapi `nvapi.h`).
  NVAPI is a C API, so it needs a small native helper exe. Forum reports say
  it is poorly documented and crashes easily; unverified on current drivers.
  NVIDIA Profile Inspector (open source) edits per-game driver profiles
  (DRS: low-latency mode, V-Sync, frame cap) and can import `.nip` files from
  the command line. It does not handle desktop scaling.
- **AMD:** ADLX (AMD's current SDK) has `IADLXDisplayGPUScaling::SetEnabled`
  and `IADLXDisplayScalingMode::SetMode` (FULL_PANEL, PRESERVE_ASPECT_RATIO,
  CENTERED). It is also native, with C/C++ samples on GPUOpen. GPU scaling is
  forced on when Radeon Super Resolution is on.
- **Recommendation:** set GPU scaling to "Full screen" once per station at
  setup (staff), keep it in the baseline, and have the helper change only
  resolution and refresh rate. Stretched then works in every game.

## Steam Input

- A layout saved as a local/personal config is stored at
  `Steam\userdata\<id>\241100\remote\controller_config\<appid>\<name>.vdf`
  (Steamworks docs). Working copies and templates live under
  `Steam\steamapps\common\Steam Controller Configs\<id>\config\<app>\`
  (community-documented; exact naming unverified). The `241100\remote`
  path suggests these configs sync through Steam Cloud (inferred), so the
  same cloud caveat applies as in CS2.
- Sharing a layout: a published community layout opens with
  `steam://controllerconfig/<appid>/<configid>` (community-documented,
  reported to work only sometimes). It opens the Steam UI on the station's
  account, so the player still has to click Apply. No player account needed.
- **Station approach:** the profile stores the `configid` (or exported VDF).
  The helper opens the link, or copies the VDF into the station account's
  folder with Steam closed (unverified that Steam then picks it up), and
  removes it on reset.
- Fighting-game sticks and leverless controllers usually bypass Steam Input
  and are configured on the device (SOCD) and in the game.

## Controller deadzones

Windows/XInput has no global deadzone setting; each game or Steam Input
layout applies its own. Store deadzones in the profile and apply them per
game (in-game file or Steam Input layout). Third-party remappers (DS4Windows
etc.) are an install, so they are out of scope.

## Audio

- Volume and mute: Core Audio `IAudioEndpointVolume` (documented COM;
  callable from PowerShell through `Add-Type` C#).
- Default playback device: `IPolicyConfig::SetDefaultEndpoint`, undocumented
  but used by AudioDeviceCmdlets and AudioSwitchPS. Bundle a small C# snippet
  rather than installing the module. Baseline and restore both values.

## ASUS ROG peripherals (event hardware)

- **Settings live on the device.** Harpe Ace Mini: 42,000 DPI AimPoint Pro,
  up to 8,000 Hz wireless (polling-rate booster), four DPI stages switchable
  on the mouse, two LOD presets by button combination, profile switching by
  DPI + wheel click. Whether it has onboard **profile** memory is
  contradictory (some spec sheets say 5 profiles, some say none). Falchion
  Ace HFX: actuation 0.1–4.0 mm, Rapid Trigger (rear switch; WASD by default,
  other keys via software), Speed Tap = last-input-priority SOCD. Strix Scope
  II 96 Wireless uses mechanical NX switches with 5+1 onboard profiles and has
  **no** magnetic actuation or Rapid Trigger. No "Strix Scope II 96 HE" model
  was found; check the actual model at the event (perhaps the Azoth 96 HE or
  Falchion 75 HE).
- **Gear Link (key finding):** ASUS's browser configurator (Chrome, Edge or
  Opera on Windows/macOS; USB or 2.4 GHz receiver, not Bluetooth). Supported
  devices include the Harpe Ace Mini*, Harpe Mini Core, Falchion Ace HFX*,
  Strix Scope II 96 Wireless* and Strix Scope II RX*. * = needs the "Gear
  Link Companion" add-on for full functions (Windows only). Settings are
  written to device memory, so they stay when the mouse moves to another PC.
  The FAQ does not mention profile export, import or sharing, and no public
  API is documented. All ROG peripherals from 2026 onward support Gear Link.
- **Scripting:** no Armoury Crate CLI or documented settings SDK was found
  (the Aura SDK covers lighting only). OpenRGB covers lighting only.
  libratbag (Linux) supports older ROG mice (Harpe Wireless, Keris, Gladius
  II, Chakram, Omni Receiver) but not the Harpe Ace Mini or Harpe Mini Core.
  Gear Link runs in the browser, so its HID protocol could be studied with
  browser devtools. A WebHID page served by our own server could then set DPI
  and polling from the station browser. That would be reverse engineering, a
  research item rather than a plan.
- **Recommendation:** fix station mouse DPI and polling once per event
  (staff, via Gear Link) and record it as `-MouseDpi`. The helper converts
  sensitivity in software. For keyboards, show the player's preferred
  actuation, Rapid Trigger and Speed Tap as a checklist and let staff or the
  player set them in Gear Link. Warn that Speed Tap/snap-tap is banned or
  restricted in CS2 matchmaking and in Capcom-rule fighting-game events
  (see `street-fighter-6.md`).

## Prior art: "one profile, many games, any PC"

- **Café management software already does per-user game config sync, but by
  user login, not by code.**
  - **iCafeCloud "Game Save":** per game, the admin lists save/config paths
    (`%APPDATA%`, `%LOCALAPPDATA%` …, several separated by `|`). Data is
    stored per member at `\\server\iCafeCloudShare\users\<account>\<gameid>`
    (guests per PC). Steam `userdata` is redirected to a server share. Size
    limits and retention cleanup are included.
  - **Gizmo "Personal User Files" (PUF):** per game profile, a folder (and
    single registry values, per the changelog) is saved at logout and restored
    before the next launch, per customer.
  - **ggLeap:** no built-in feature found. ggCircuit's knowledge base gives a
    DIY "PUF" recipe: `Login.bat`/`Logout.bat` hooked as client commands that
    `xcopy` paths from `SavePaths.txt` to a network share per username, plus
    a community Ludusavi-to-USB wrapper. The June 2026 update added CS2 stats
    and account data retention, not configs.
  - **SENET:** lists "Saved game progress" with personal accounts, no
    details. Diskless sessions wipe client data at logout.
  - SmartLaunch: nothing found.
  - These systems sync whole folders per member on the venue's own PCs. They
    need a venue account, do not convert DPI, do not touch Windows/display
    settings, and do not let a player author a profile on a phone.
- **Config tools:** ConfigSave (CodeFev, Steam app 4279470, unreleased) backs
  up configs for CS2, CoD BO7, BF6, Rust and PUBG to the cloud and applies
  them on another PC, explicitly for LAN cafés. It needs an account; no DPI
  conversion or restore is described. Ludusavi (open source) backs up and
  restores save/config folders using the PCGamingWiki catalogue, and is the
  best path database to reuse.
- **Peripheral clouds:** Razer Synapse 4 syncs profiles across PCs by Razer
  ID (cloud sync for Synapse 2 and 3 ended 2025). It covers Razer devices
  only. Logitech G HUB not re-checked. ASUS Gear Link has no cloud profile.
- **Launcher/account clouds:** Steam Cloud and Riot/Valorant account settings
  follow the account, not a code, which is exactly what shared station
  accounts break.
- ProSettings, Mobalytics and Blitz publish or overlay settings. As far as
  known (not re-checked this session) none write configs onto a station.

## Sources

- DEVMODE / `dmDisplayFixedOutput`: https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-devmodew
- Scaling the desktop image (DMDFO mapping, SetDisplayConfig): https://learn.microsoft.com/en-us/windows-hardware/drivers/display/scaling-the-desktop-image
- NVAPI header (`NV_SCALING`, `NvAPI_DISP_SetDisplayConfig`): https://github.com/NVIDIA/nvapi/blob/main/nvapi.h
- NVAPI scaling forum reports: https://www.monitortests.com/forum/Thread-Switch-from-UHD-to-FHD-GPU-Scaling-make-blurred-fonts-How-to-fix-it, https://forums.developer.nvidia.com/t/changing-nvidia-card-settings-with-nvapi-issues-nvapi-disp-setdisplayconfig/30122
- ADLX GPU scaling / scaling mode: https://gpuopen.com/manuals/adlx/adlx-sdk-references/adlx-interfaces/display/iadlxdisplaygpuscaling, https://gpuopen.com/manuals/ADLX/adlx-_d_o_x__i_a_d_l_x_display_scaling_mode__set_mode
- Steam Input config files: https://partner.steamgames.com/doc/features/steam_controller/action_manifest_file, https://retrodeck.readthedocs.io/en/latest/wiki_development/general/steam-input/
- `steam://controllerconfig` links: https://steamcommunity.com/app/1675200/discussions/2/3498761686677051926
- AudioDeviceCmdlets / IPolicyConfig: https://github.com/frgnca/AudioDeviceCmdlets, https://github.com/seekator/AudioSwitchPS
- Gear Link FAQ (device list, requirements): https://www.asus.com/support/faq/1054795/
- Gear Link guide: https://rog.asus.com/articles/guides/how-to-customize-your-rog-peripherals-with-gear-link--no-downloads-required/
- ROG keyboard technology (Rapid Trigger, Speed Tap, actuation): https://rog.asus.com/content/rog-keyboard-technology/
- Harpe Ace Mini: https://rog.asus.com/ea/mice-mouse-pads/mice/ambidextrous/rog-harpe-ace-mini, https://pokde.net/review/asus-rog-harpe-ace-mini-review, https://www.turbovs.com/review/asus-rog-harpe-ace-mini-7097
- Strix Scope II 96 Wireless (no magnetic switches): https://www.pcgamer.com/asus-rog-strix-scope-ii-96-wireless-review/
- libratbag device list: https://github.com/libratbag/libratbag/tree/master/data/devices
- iCafeCloud Game Save: https://www.icafecloud.com/wiki-game-saves.htm
- Gizmo PUF: https://gizmo.tawk.help/article/how-to-save-game-progress-using-puf, https://gizmopowered.net/support/changelog
- ggCircuit PUF backup/restore: https://ggcircuit.atlassian.net/wiki/spaces/GKB/pages/15860347/Backing+Up+and+Restoring+Personal+User+Files+PUFs+for+Client+Machines
- ggLeap June 2026 update: https://blog.ggcircuit.com/2026/06/16/ggleap-june-2026-update-combo-deals-cs2-data-retention/
- SENET gaming centers: https://senet.cloud/gaming-centers
- ConfigSave: https://store.steampowered.com/app/4279470/, https://www.dekudeals.com/items/configsave
- Ludusavi: https://github.com/mtkennerly/ludusavi
- Razer Synapse sync: https://mysupport.razer.com/app/answers/detail/a_id/13859
