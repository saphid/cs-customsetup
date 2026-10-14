# Rainbow Six Siege X reference for CS Setup

Checked 2026-10-14. Desk research only: nothing here has been tested on a real Siege X
install yet. Rainbow Six Siege became "Rainbow Six Siege X" on 2025-06-10 as a free
update, with a Free Access tier (Quick Match, Unranked, Dual Front). Ranked and Siege Cup
need the paid game. It runs on PC through Ubisoft Connect or Steam. Both need a Ubisoft
account login, so there is no offline or anonymous play.

## Files on a Windows PC

| Setting | Where | Format |
|---|---|---|
| Mouse hipfire, ADS (global and per scope), controller sens and deadzones, toggles, FOV, resolution, window mode, aspect ratio, graphics, FPS limit, brightness, audio volumes, voice chat | `%USERPROFILE%\Documents\My Games\Rainbow Six - Siege\<Ubisoft profile ID>\GameSettings.ini` | Plain INI with sections `[DISPLAY_SETTINGS]`, `[QUALITY_SETTINGS]`, `[CUSTOM_PRESET_SETTINGS]`, `[INPUT]`, `[DISPLAY]`, `[AUDIO]`, `[GAMEPLAY]`, `[ONLINE]` |
| Key binds | Not in `GameSettings.ini` (Ubisoft Support, 2018). Probably account or cloud data (unverified) | Unknown, possibly binary |
| Loadouts, unlocks, progression | Server side, tied to the Ubisoft account | n/a |
| Launcher save data | `C:\Program Files (x86)\Ubisoft\Ubisoft Game Launcher\savegames\<user id>\635` (Ubisoft Connect) or `\1843` (Steam copy) | Binary, synced to Ubisoft Connect cloud |

- The subfolder is named after the Ubisoft profile ID, a GUID-like string. There is one
  folder for each Ubisoft account that has played on that Windows user. On a station the
  station account's folder is the one to write. A player who logs in with their own
  account gets a new folder the first time the game starts.
- No source says the folder layout changed with Siege X. Steam threads now titled
  "Siege X" still point to the same path (unverified on a 2026 build). The Siege X
  `GameSettings.ini` probably has more keys than the older samples. Read the real file
  before writing it, and change only the keys you need.
- Deleting the file makes the game regenerate defaults. Ubisoft staff say this resets
  graphics but not audio or controls. That suggests some control data lives outside the
  file (unverified).

### `[INPUT]` keys relevant to sensitivity

| Key | Default | Note |
|---|---|---|
| `MouseYawSensitivity`, `MousePitchSensitivity` | 50 | In-game sliders, integers 1-100 |
| `MouseSensitivityMultiplierUnit` | 0.02 | Ini only. Scales both sliders, so a fractional effective sens can be set |
| `XFactorAiming` / `ADSMouseMultiplierUnit` | 0.02 | ADS multiplier unit. The neutral ADS value is `1 / XFactorAiming` (50 at 0.02) |
| `AimDownSightsMouse`, `ADSMouseSensitivityGlobal` | 50 | Global ADS slider |
| `ADSMouseUseSpecific` | 0/1 | 1 = Advanced mode, per-zoom sliders |
| `ADSMouseSensitivity1x`, `1xHalf`, `2x`, `2xHalf`, `3x`, `3xHalf`, `4x`, `5x`, `8x`, `12x` | 50 | Per-zoom sliders (1x, 1.5x, 2x, 2.5x, 3x, 3.5x, 4x, 5x, 8x, 12x). 8x was added in Y11S3, per a community source |
| `RawInputMouseKeyboard` | 0/1 | Raw input toggle |
| `YawSensitivity`, `PitchSensitivity`, `AimDownSights`, `DeadzoneLeftStick`, `DeadzoneRightStick`, `AimAssist`, `InvertAxisY`, `Rumble` | | Controller (gamepad) settings |
| `ToggleAim`, `ToggleLean`, `ToggleSprint`, `ToggleCrouch`, `ToggleProne`, `ToggleWalk` | | Hold or toggle |

Display keys: `ResolutionWidth`, `ResolutionHeight`, `RefreshRate`, `WindowMode` (0 fullscreen,
1 windowed, 2 borderless), `AspectRatio` (0 display, 1 resolution, 2+ presets), `UseLetterbox`,
`DefaultFOV` (vertical degrees, 60-90), `RenderScaling`, and `[DISPLAY] FPSLimit` (below 30 turns
the limit off). Audio: `[AUDIO] Volume`, `VolumeMusic`, `VolumeSoundEffects`, `VolumeVoice`,
`VoiceChatCaptureMode`. The file has no HUD or crosshair customisation comparable to CS2.
Siege X HUD options exist in the game but their storage is unverified.

## Applying settings before launch

- **The game reads the ini at startup.** Community edits (FPS limit, `XFactorAiming`,
  multiplier, `DataCenterHint`) are made with the game closed and take effect at the next
  launch. Ubisoft's own sensitivity guide tells players to edit `XFactorAiming` there.
- **The game writes the ini back.** Changing options in the game rewrites the file. A
  read-only attribute is the usual way to lock edits, but Ubisoft Support lists read-only
  as a cause of "settings reset on launch". Use read-only only if a test shows the game
  otherwise overwrites the station's values at startup.
- **No equivalent of CS2's `+exec`.** There is no console and no launch option that applies
  a settings file afterwards. The station must write the file before launch, and the game
  must not be running.
- **No import or export or share codes** exist for Siege settings (none found), and there is
  no crosshair code. Copying `GameSettings.ini` between PCs is the community method, and it
  does not carry key binds.
- **Cloud sync.** Ubisoft Connect cloud saves are on by default (Settings > General >
  "Enable cloud save synchronisation for supported games"). Whether `GameSettings.ini` is
  part of the cloud set is unverified. The savegames folder is synced, and a player reported
  the ini regenerated "even with cloud saving off". Steam Cloud for the Steam copy (app
  359550) is also unverified.

## Anti-cheat

- PC uses BattlEye plus Ubisoft's QB system, now grouped under "R6 ShieldGuard" (Siege X).
  Editing `GameSettings.ini` while the game is closed is what Ubisoft Support and Ubisoft's
  own guides tell players to do. It is not memory or process tampering, and no bans for it
  were found.
- Mousetrap applies only to consoles. It detects mouse and keyboard spoofers (XIM-type
  adapters) and adds input latency. It does not affect PC stations.
- Avoid: touching game files under the install folder, injecting into or writing while
  `RainbowSix.exe` or BattlEye runs, and macro or rapid-fire software. BLAST R6 rules call
  macros cheating.

## Sensitivity math

Ubisoft (2019): hipfire yaw = input counts x `MouseSensitivityMultiplierUnit` x
`MouseYawSensitivity`, in units of 0.0001 rad per count at the default multiplier. That gives
**0.00572958 degrees per count per slider point at multiplier 0.02** (csdb and
mouse-sensitivity.com use the same constant). Hipfire does not depend on FOV.

```
deg_per_count = MouseYawSensitivity * (MouseSensitivityMultiplierUnit / 0.02) * 0.00572958
R6 slider     = CS2 sensitivity * 0.022 / 0.00572958   (= CS2 x 3.8397)
station sens  = player sens * player DPI / station DPI
```

Example: CS2 2.0 at 400 DPI (52 cm/360) gives R6 7.68 at 400 DPI, or 3.84 at 800 DPI. The
slider takes integers only, so the station should pick an integer slider value N (for
example the rounded value, at least 1) and write
`MouseSensitivityMultiplierUnit = 0.02 * target / N`. Write the same factor to pitch.

ADS since Y5S3 (Shadow Legacy, 2020): each zoom has its own slider, and 50 (= `1 /
XFactorAiming`) gives "visuomotor" matching, that is 0% monitor distance or focal-length
scaling:
`ADS deg/count = hipfire deg/count x (ADS slider x XFactorAiming) x tan(zoomVFOV/2) / tan(hipVFOV/2)`.
The exact formula is in images in Ubisoft's guide and was not read, so this is derived from
the text (unverified). The pre-2020 formula, `clamp(ADS x XFactorAiming x optic modifier,
0, 1)` with 0.6 for 1x and 0.35 for ACOG, is obsolete. For CS2 players the closest
equivalent is per-zoom 50, which matches `zoom_sensitivity_ratio 1` (CS2 also scales by
focal length). Recommend 50 unless the player sets a value.

Controller: `YawSensitivity`, `PitchSensitivity` (1-100), `AimDownSights` and the
deadzones copy across unchanged. DPI does not apply.

## Tournaments and LANs

- The BLAST R6 Global Rulebook 2025 governs Majors and the Six Invitational ecosystem. The
  organiser lists the equipment it provides and the equipment players bring, validates
  player equipment, and supervises any drivers or third-party software. Macros and
  "unauthorized third-party programs affecting gameplay" count as cheating. TO-provided
  PCs may be used "only for their approved function". There is no rule on config files;
  players set settings in the game.
- Players compete on their own Ubisoft accounts, which must be in good standing.
  A 2025 grassroots rulebook (US, based on BLAST R6) requires "their main account" and allow "minimal
  configuration settings" (sensitivity, resolution) but not registry changes. So at pro
  and semi-pro events players log in and their account-bound data follows them. Typically
  they re-enter sens by hand or copy their ini from a USB stick (common practice,
  unverified).

## Verdict: Partial

Sens (hipfire, ADS per zoom, multiplier), controller values, FOV, resolution, aspect ratio,
graphics, FPS limit and audio are local INI keys and can be written before launch, as with
CS2. Missing: key binds (not in the ini), HUD and crosshair (none to set or not located), no
post-launch override, and a Ubisoft login is always needed.

## Implementation sketch

- **Profile fields:** `r6.hipYaw`, `r6.hipPitch` (stored as effective float sens at the
  player's DPI), `r6.adsMode` (global or per zoom), `r6.ads{1x..12x}`, `r6.fovVertical`,
  `r6.resolution`, `r6.windowMode`, `r6.aspectRatio`, `r6.letterbox`, `r6.fpsLimit`,
  `r6.rawInput`, `r6.toggles`, `r6.audio{master,music,sfx,voice}`,
  `r6.controller{yaw,pitch,ads,deadzones,invertY}`, and `r6.binds` as a display-only
  checklist. Reuse the mouse DPI and Windows pointer fields.
- **Station:** Check that `RainbowSix*.exe` is not running. Back up every
  `Rainbow Six - Siege\<id>\GameSettings.ini` in the baseline, plus the Windows mouse
  settings. Edit only the listed keys in place, keeping unknown keys, encoding and line
  endings. Compute the integer slider plus multiplier as above. Launch with
  `uplay://launch/635/0` or `steam://rungameid/359550` (unverified for Siege X). Show the
  key binds checklist on screen. Reset restores the files and removes profile folders that
  appeared after the baseline, as the CS2 station does.
- **Player's own account:** their folder does not exist until the first launch on that PC.
  Offer "launch once, quit, load" or a watcher that writes once the folder appears and
  asks for a restart. Never touch their account-bound data.
- **Risks and mitigations:** Turn off Ubisoft Connect cloud save sync on station accounts,
  and Steam Cloud for app 359550 on Steam stations. Run Siege once per station before the
  baseline so the ini exists. A Siege X patch can rename keys, so validate against the live
  file and skip unknown keys with a warning. Use read-only only if testing proves it is
  needed. Test first on a real install: whether the ini is cloud-synced, where key binds
  live, and the ADS formula.

## Sources

- Ubisoft, FOV and input sensitivity (2019): https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/6kY6b5JByBY3P6vQWWinla/fov-and-input-sensitivity
- Ubisoft, Guide to ADS sensitivity in Y5S3: https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/3IMlDGlaRFgdvQNq3BOSFv/guide-to-ads-sensitivity-in-y5s3
- kurtextrem ADS converter (per-zoom ini keys): https://kurtextrem.de/sens
- Sample GameSettings.ini: https://github.com/cjLGH/game-settings/blob/master/r6siege/GameSettings.ini
- Ubisoft Support on file location and key binds (2018): https://steamcommunity.com/app/359550/discussions/1/1741094390472149961
- Key binds not in ini: https://steamcommunity.com/app/359550/discussions/0/1484358860950282895/
- Reset or read-only advice: https://devtrackers.gg/r6-siege/p/d0f9ebd1-issue-not-listed-how-can-i-reset-the-gamesettings-ini-file-to-default , https://devtrackers.gg/r6-siege/p/639d007f-everytime-i-start-up-my-siege-my-key-binds-reset-and-all-my-operator-loadouts-reset
- FPS limit edits: https://steamcommunity.com/app/359550/discussions/0/1744468917519215398/ , https://siege.gg/news/how-to-increase-fps-in-rainbow-six-siege-for-max-performance
- Ubisoft Connect cloud sync toggle: https://www.ubisoft.com/en-gb/help/connectivity-and-performance/article/disabling-cloud-save-synchroniation-in-ubisoft-connect-pc/000063189
- Savegame folders 635 and 1843: https://checkpoint64.com/games/rainbow-six-siege/save/ , https://www.pcgamingwiki.com/wiki/Tom_Clancy's_Rainbow_Six_Siege
- Siege X launch and Free Access: https://news.ubisoft.com/en-us/article/5tIdWMRe5DKP4wZj321qCP/rainbow-six-siege-x-launches-today-free-access-now-available
- Mousetrap (console): https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/65UBprZeK2lHJw1qKI8ygM
- Yaw constant: https://csdb.gg/sensitivity-converter/siege-to-cs2/ , https://www.mouse-sensitivity.com/n/cs2-to-rainbow-6-siege/
- BLAST R6 Global Rulebook 2025: https://staticctf.ubisoft.com/J3yJr34U2pZ2Ieem48Dwy9uqj5PNUQTn/53GxmEddEWemHwz8BBbJpZ/96a6decc0ca03defc9c1ae9e06bd0809/BLASTR6_GLOBALRULEBOOK_SEASON_2025.pdf
- Rainbow Six Siege Rulebook 2025 (grassroots, "Computer Configurations"): https://staticctf.ubisoft.com/177v1kh0db6l/1XNmcTeiAklhke8ZakXGQP/175376ab02833893e1cee4d770f4f82b/Rainbow_Six_Siege_Rulebook_2025.pdf
