# Call of Duty reference (Black Ops 7 / Warzone)

Researched 2026-10-14 from web sources and one community copy of a Black Ops 6
`s.1.0.cod24.txt0` on GitHub. Nothing here has been tested on a real station yet.
Current title: Black Ops 7 (released 14 November 2025), with Warzone in the same
"Call of Duty" HQ app on Battle.net, Steam and the Xbox PC app. Modern Warfare 4
(Infinity Ward) releases 23 October 2026, nine days after this check, so re-check
file names and settings after that date.

## Where settings live

The game has two layers. The local text file holds machine settings. The
account profile holds the player's aim and control settings.

| Setting | Where | Writable by a station? |
|---|---|---|
| Video: resolution, display mode, aspect ratio, refresh rate, FPS caps, render scale, upscalers, quality | `s.1.0.cod25.txt0` and `.txt1` (local text) | Yes |
| Audio: master and per-channel volumes, audio mix preset, devices | same file (`Volume`, `EffectsVolume`, `AudioMixPreset`, ...) | Yes |
| Raw input, HUD on/off, blood, map-cursor speed | same file (`MouseUsesRawInput`, `EnableHUD`) | Yes |
| Cloud sync switch for the local file | same file, `ConfigCloudStorageEnabled` ("Allows locally stored files to be synced in with the cloud") | Yes |
| Mouse sensitivity, ADS multiplier, ADS sensitivity type, monitor distance coefficient, ADS transition timing | account profile ("Cloud Saved Settings") | No (see below) |
| Keybinds (keyboard and mouse) | account profile | No |
| Controller: layout, stick sensitivity, deadzones, response curve, aim assist type, trigger effects | account profile | No |
| FOV, ADS FOV, HUD layout and colours, crosshair-like options, minimap | account profile | No |

Folder (BO7): `%LOCALAPPDATA%\Activision\Call of Duty\players\`. Black Ops 6
and some guides use `Documents\Call of Duty\players\`; a OneDrive-redirected
Documents folder then syncs it. PC Game Pass installs of BO7 may still use the
`cod24` name. Older titles kept the profile locally as
`gamerprofile.0.BASE.cst` (Battle.net) or `gamerprofile.pc.0.BASE` (Xbox app)
and `settings.3.local.cod22.cst`; one forum report places BO7 sensitivity in a
`g.cod25.1.0.l.txt0`-style file (unverified). The station should glob
`s.1.0.cod*.txt0` and record what it finds instead of hard-coding a name.

File format (from the BO6 copy; BO7 guides describe the same layout):

```
// Use raw mouse input.
MouseUsesRawInput@0;57752;20945 = true
Resolution@0;56178;35888 = 1920x1080
DisplayMode@0;22564;43096 = Fullscreen borderless window // one of Windowed, Fullscreen, ...
MaxFpsInGame@0;13305;58861 = 285 // 30 to 300
```

`Name@index;a;b = value // range`, sections `// Audio`, `// Display`,
`// Gameplay`, `// System`. The meaning of the two numbers after `@` is unknown
(they repeat across settings of the same type, and `WindowMaximized ... = true`
shares its pair with settings set to `false`, so they are not a checksum of the
current value; unverified). Guides edit `txt0` and `txt1` identically; the game
recreates both with defaults if they are deleted. The file has no mouse
sensitivity, ADS, FOV, keybind or controller-stick lines; gamepad `YawSpeed`
and `PitchSpeed` (140) are engine limits, not the menu sensitivity.

Cloud Saved Settings: Treyarch's Cold War note says "all but hardware-related
settings will be saved with your Activision Account"; the toggle sits in
Settings > Account & Network, and BO6 still has it. BO7 adds Settings > Account
& Network > Import Settings, which copies controls, controller sensitivity and
audio from the same account's BO6 profile (single source, unverified). There is
no settings share code; BO7 build codes cover weapon loadouts only and need
the weapons unlocked on the account that imports them.

## Accounts

Playing needs an Activision account linked to the launcher account. Activision
treats account transfer as a Terms of Use breach and discourages sharing logins;
a venue-owned station account used by many players is a grey area (unverified
whether Activision tolerates it for LANs). Profile settings follow whichever
account is signed in, so on a shared station account every player inherits the
previous player's sensitivity and binds unless they change them, and with Cloud
Saved Settings on, those changes are uploaded.

## Can the station write files before launch?

- Local file: yes. Guides (JordanTBH, GamerTagZero) edit both files with the
  game fully closed; the game reads them at start. Seasonal and mid-season
  patches rewrite them, so guides set them read-only. A read-only file stops the
  game saving the player's in-game changes and is not needed if the station
  writes the file at every load.
- Profile settings: no supported way. Whether a locally cached profile file can
  be edited and then wins over the cloud copy is unverified, and editing an
  undocumented binary-ish `.cst` is riskier than a commented text file. Treat it
  as out of scope until tested on a real install.
- Other things that break saving: Windows Defender Controlled Folder Access
  blocking `cod.exe` writes, and OneDrive syncing Documents (BO6 path).

## Anti-cheat (Ricochet)

Ricochet has a kernel driver. Black Ops 7 requires TPM 2.0 and Secure Boot on PC,
checked with remote attestation, so station PCs must have both enabled in
firmware. No source reports bans for editing `s.1.0.*.txt0`; popular
optimisers (for example the open-source Warzone optimiser Hardline) edit it, but
Activision has published nothing that permits it (unverified as safe). Stay
away from anything that touches the running process or input: no injection,
no memory reads or writes, no AutoHotkey or macro scripts, no input remappers
(reWASD reports bans), no Cronus-style devices. Only write files while no
`cod.exe` process exists.

## Sensitivity

| Quantity | Value |
|---|---|
| Hipfire yaw | 0.0066 degrees per count per sensitivity unit (MW2/MW3/Warzone/BO6/BO7; Overwatch uses the same) |
| CS2 to CoD | `cod = cs2 * 0.022 / 0.0066 = cs2 * 3.3333` |
| DPI change | `sens_station = sens_player * dpi_player / dpi_station` |
| cm/360 | `2.54 * 360 / (dpi * sens * 0.0066)` |

Hipfire rotation per count does not depend on FOV. ADS sensitivity:
- ADS Sensitivity Type "Relative" scales ADS sensitivity by the zoom (FOV)
  change. Monitor Distance Coefficient sets the screen point that stays matched:
  0 = focal-length (tan ratio), 1.33 (default) = 133% of half the vertical,
  which equals 75% of the horizontal half-width on 16:9 and the CS
  `zoom_sensitivity_ratio 1` behaviour. "Legacy" scales linearly by FOV.
- ADS Sensitivity Multiplier (per zoom level in Legacy) is a ratio on top.
- ADS Sensitivity Transition Timing: Instant or Gradual.
- These are all ratios, so they carry between DPIs unchanged; only the hipfire
  value needs the DPI conversion. Converting a CS2 player's zoom: `zoom_sensitivity_ratio`
  r with MDC 1.33 gives ADS multiplier r (unverified for BO7's exact formula).

Controller values (stick sensitivity, deadzone inner/outer, response curve,
aim assist type, trigger deadzones) do not depend on DPI and carry as-is. Mouse
sensitivity only matches if raw input is on; with `MouseUsesRawInput = false`
Windows pointer speed and Enhance Pointer Precision change aim, so the station
should keep raw input on.

## Tournaments today

- Call of Duty League: console, controller only; players sign in to their own
  accounts on provided consoles and settings come with the account (PS5 in
  2024-2025; 2026 platform unverified). Matches use the in-game "CDL"
  competitive ruleset.
- PlayVS college BO7 rulebook: PC, PS5 or Xbox, controllers only, mouse and
  keyboard banned, turbo and macro controllers banned, each player on their own
  Activision account for the whole competition.
- World Series of Warzone LAN finals: developer-certified PCs with only the game
  installed; online qualifiers on players' own machines.
- Community LANs (for example LAN ETS 2026) are bring-your-own-computer, so the
  station problem does not arise there.

## Verdict: Partial

Only the machine layer (video, audio, raw input, FPS caps) is local text the
station can write like CS2. Sensitivity, ADS, keybinds, controller and FOV are
account-bound. A station on a shared account cannot load them from a code
without driving the in-game menus, which this project should not do.

## Implementation sketch

Profile schema (`games.cod`):
- `video`: `resolution`, `displayMode`, `aspectRatio`, `refreshRate`, `maxFpsInGame`
- `audio`: `volume`, `effectsVolume`, `musicVolume`, `voiceVolume`, `audioMixPreset`
- `mouse`: `sensitivity`, `dpi`, `adsMultiplier`, `adsType` (relative/legacy), `mdc`, `adsTransition`, `fov`, `adsFov` (affected/independent)
- `controller`: `stickH`, `stickV`, `deadzoneLeftMin`, `deadzoneRightMin`, `responseCurve`, `aimAssist`
- `binds`: action to key map

Station (`-Game cod`):
1. Refuse to load while `cod.exe` runs. Baseline: copy every
   `players\s.1.0.cod*.txt0/.txt1` in both candidate folders.
2. Edit only known keys in both files (`Name@... = value`, keep the `@` part),
   force `MouseUsesRawInput = true` and `ConfigCloudStorageEnabled = false`.
3. Show a "set in game" card (and QR back to the phone) with the account-bound
   values: hipfire sensitivity converted to the station DPI, ADS multiplier,
   MDC, transition, FOV, binds and controller values. These are typed by the
   player.
4. Launch through the installed launcher (Battle.net, Steam or Xbox app).
5. Reset restores the baseline files; account settings must be reset to the
   station's defaults by hand, or by a player using their own account.

Risks and mitigations: profile settings on a shared account persist and sync;
venues should turn Cloud Saved Settings off on station accounts (unverified
whether it then keeps them local only) or ask players to sign in with their own
accounts. Patches rename files (`cod24`, `cod25`, MW4). TPM and Secure Boot
must be on. Do not edit `.cst` profile files.

## Sources

- https://mp1st.com/news/call-of-duty-modern-warfare-4-announced-releases-october-23
- https://jordantbh.tv/title/blackops7/settings/configuration/
- https://jordantbh.tv/title/blackops6/settings/configuration/
- https://gamertagzero.com/black-ops-7-mouse-input-fix-to-stop-missing-shots/
- https://twistedvoxel.com/how-to-boost-fps-in-call-of-duty-black-ops-7-pc/
- https://github.com/Ven0m0/Win/blob/main/user/.dotfiles/config/games/bo6/s.1.0.cod24.txt0
- https://github.com/adrianlunamx/Hardline
- https://www.mouse-sensitivity.com/forums/topic/9493-call-of-duty-black-ops-6/
- https://www.mouse-sensitivity.com/forums/topic/9482-call-of-duty-mw-3-folder-in-xbox-app-on-pc/
- https://steamcommunity.com/app/1938090/discussions/0/3884976499347149510
- https://steamcommunity.com/app/1938090/discussions/0/4634860720019788976
- https://steamcommunity.com/app/1938090/discussions/0/4634861275507103558/
- https://www.callofduty.com/blog/2020/11/Black-Ops-Cold-War-Controls-and-Settings-PC
- https://www.charlieintel.com/black-ops-cold-war/how-to-fix-cold-war-settings-reset-glitch-127843/
- https://allthings.how/how-to-import-settings-in-black-ops-7-from-previous-call-of-duty-games/
- https://esports.gg/guides/call-of-duty/how-to-send-and-enter-loadout-build-codes-in-black-ops-7
- https://www.callofduty.com/blog/2025/09/call-of-duty-black-ops-7-beta-ricochet-anti-cheat-update
- https://www.guru3d.com/story/call-of-duty-black-ops-7-system-requirements-tpm-20-and-secure-boot
- https://forum.rewasd.com/forum/rewasd/technical-questions-aa/241198-rewasd-baned-by-activision
- https://conductatlas.com/platform/activision/activision-terms-of-use/provision/CA-P-039292/prohibition-on-transferring-accounts-or-service-provided-content/
- https://csdb.gg/sensitivity-converter/
- https://mouse-sensitivity.com/forums/topic/7276-cod-black-ops-cold-war-hipfire-to-ads-difference-between-monitor-distance-coefficient
- https://help.playvs.com/en/articles/16192053-playvs-college-league-call-of-duty-black-ops-7-competition-rulebook
- https://www.ggrecon.com/articles/wsow-producer-on-european-cod-algs-inspiration-and-hacker-prevention
- https://liquipedia.net/callofduty/Lan_ETS/2026
- https://www.esports.net/news/cod/call-of-duty-league-announces-2026-season-schedule/
