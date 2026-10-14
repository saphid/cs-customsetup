# Fortnite reference for a Loadout station

Checked 2026-10-14 from web sources only; nothing here was tested on a real
Fortnite install. Items marked (unverified) need a test on a Windows station
before anyone builds on them.

**Verdict: Partial.** Resolution, display mode, frame cap and Windows mouse
settings are in local files and work like CS2. Sensitivity, keybinds,
controller settings, HUD and audio are in `ClientSettings.Sav`. That is a
binary file that belongs to the Epic account and is stored in Epic's cloud.
Unlike CS2, Fortnite has no text cfg and no `+exec`. It also has no
import/export or share code for settings.

## Files on a Windows PC

| Setting | Where | Format | Synced to Epic account |
|---|---|---|---|
| Resolution (incl. stretched), display mode, frame rate limit, VSync, graphics quality | `%LOCALAPPDATA%\FortniteGame\Saved\Config\WindowsClient\GameUserSettings.ini`, section `[/Script/FortniteGame.FortGameUserSettings]`: `ResolutionSizeX/Y`, `LastUserConfirmedResolutionSizeX/Y`, `FrameRateLimit`, `bUseVSync`, `sg.*` | UE text ini | No (local) |
| Mouse X/Y sensitivity, targeting (ADS) and scope sensitivity, build/edit multipliers | `ClientSettings.Sav` | Binary | Yes |
| Keybinds (KBM) | `ClientSettings.Sav` (unverified that no part is in `Input.ini`) | Binary | Yes (community reports) |
| Controller: look sensitivity, deadzones, build/edit sens, presets and custom binds | `ClientSettings.Sav` (unverified) | Binary | Yes |
| HUD layout, audio volumes, game options | `ClientSettings.Sav` (unverified per field) | Binary | Yes (unverified) |

- Local copy of the cloud file: `%LOCALAPPDATA%\FortniteGame\Saved\Cloud\<epicAccountId>\ClientSettings.Sav`.
  Reset scripts on GitHub delete exactly this path. Older guides name
  `Saved\Config\ClientSettings.Sav`; the station should check both.
- Cloud copy: Fortnite cloudstorage service,
  `fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/cloudstorage/user/{accountId}/ClientSettings.Sav`
  (GET/PUT, OAuth scope `fortnite:cloudstorage:user:{accountId}:ClientSettings.sav`).
  Consoles use other files such as `ClientSettingsPS5.sav`, so PC settings are
  stored per platform. This API is undocumented and was reverse-engineered by the
  community.
- Format: magic `0x44464345`, an engine version, then a zlib-compressed Unreal
  property-serialized blob (Fortnite version string, custom versions, then
  properties). Community editors (AltimorTASDK ClientSettingsEditor, Galaxy
  Swapper) have broken after Fortnite updates ("Failed to deserialize").
- `Input.ini` in the same `WindowsClient` folder is a stock Unreal file. Whether
  Fortnite still reads binds from it is unverified. Assume it does not.

## Epic accounts

Fortnite needs an Epic account to play, so a station has to sign in to a
station Epic account. `ClientSettings.Sav` belongs to whichever account is
signed in. When a player uses the station account, they get the station
account's settings. Nothing that reaches the station account's settings
passes through local text files.
Players who log in to their own account bring their own sensitivity, binds and
HUD with them, because the settings follow the account (community reports;
Epic documents only progress sync). FNCS 2026 also requires MFA on competitors'
accounts. At official events, players therefore use their own accounts, and the
cloud sync already moves their setup.

## Can a helper write files before launch and keep them?

| Action | Expected result |
|---|---|
| Write `GameUserSettings.ini` resolution keys, then set the file read-only | Works. Pros and guides use this widely for stretched resolution, so Fortnite does not reset it at startup. Read-only also blocks in-game video changes, so the station must clear the flag on Reset. |
| Write the local `Saved\Cloud\<id>\ClientSettings.Sav` before launch | Probably replaced by the cloud copy at login (unverified, needs a test). Galaxy Swapper downloads from the cloud API before it edits, which suggests the game treats the cloud copy as authoritative. |
| Make `ClientSettings.Sav` read-only | "Settings not saving" guides list this as a cause, so read-only blocks saves. Whether it also stops the cloud download is unverified. Even if it does, the station still needs a correctly serialized binary file. |
| PUT an edited file to the station account through the cloudstorage API | Technically possible, because swappers do it. Do not do this: the API is undocumented, it needs station account OAuth tokens, the format breaks with updates, and it is close to EULA terms on modifying or reverse-engineering the game. |
| Turn off Epic Games Launcher "Cloud Saves" | Probably no effect. Fortnite's settings sync uses its own cloudstorage service, not the launcher's save sync (unverified). One guide suggests it. Test before relying on it. |

## Anti-cheat (EAC and BattlEye)

- No Epic statement covers editing config files. Editing `GameUserSettings.ini`
  for stretched resolution is common, done openly by pros, and there are no
  known bans for it. The anti-cheat protects game binaries and paks, and
  verifying the install restores those.
- Editing `ClientSettings.Sav` with a third-party tool is a grey area. The
  tools come from the skin-swapper and TAS communities. Using one, or calling
  the private API, at an event station risks the station account. Avoid both.
- Do not touch anything under the game install directory (paks, binaries,
  `Engine.ini` tweaks that change rendering). Keep to `GameUserSettings.ini`
  and Windows settings.

## Sensitivity math

- Fortnite's yaw is 0.005555 deg/count per 1% (0.5555 at 100%). The menu shows
  a percentage. The config probably stores a fraction, for example
  `MouseX = 0.07` for 7% (unverified).
- From CS2 (`m_yaw` 0.022): **FN% = CS2 sens x 3.9604** at the same DPI. The
  number 2.525 sometimes quoted is not the CS2 factor. CS2 to Valorant is 3.18.
- cm/360 = 914.4 / (DPI x FN% x 0.005555). Example: 7% at 800 DPI = 29.3 cm.
- DPI conversion is the same as for CS2: `stationPct = playerPct x playerDpi / stationDpi`.
  X and Y are separate settings. Carry both.
- Targeting (ADS) and scope sensitivity are percentages relative to the base
  sensitivity. Because they are relative, they do not change when DPI changes.
  The build and edit multipliers work the same way.
- The menu slider does not allow exact values, so typed values may round
  (unverified for the current UI).
- Windows pointer speed and Enhance Pointer Precision work the same way as on
  the CS2 station. Fortnite uses raw input for aiming (unverified).
- What a controller profile can carry: look sensitivity (X/Y), ADS sensitivity,
  build and edit sensitivity, deadzones, the advanced/exponential curve, and
  button presets or custom binds. All of these are account settings only. DPI
  does not apply to a controller.

## How events handle setups today

- FNCS LANs (2026 Global Championship, Belgium, 26-27 Sept): players sign in to
  their own MFA-protected accounts, so the cloud brings their binds and
  sensitivity. They bring their own peripherals. Players and coaches set up the
  video settings and stretched resolution at the station (unverified for 2026:
  the fortnite.com rules page could not be fetched).
- Smaller LANs and LAN cafes: either players log in to their own accounts, or
  they re-enter settings by hand on a house account. Some rulebooks allow
  personal accounts only.
- Rules: the EULA (and, presumably, FNCS rules; unverified) prohibit modified clients and unauthorized software,
  and competitive accounts must be the player's own. No rule found addresses
  `GameUserSettings.ini` edits.

## Implementation sketch

Profile schema (`game: "fortnite"`):

| Field | Applied by station | How |
|---|---|---|
| `dpi`, `sensX`, `sensY` (percent) | No (show) | Convert to station DPI, then show the exact value to type in Settings > Mouse |
| `targetingPct`, `scopePct`, `buildMult`, `editMult` | No (show) | Shown as-is, since they do not depend on DPI |
| `resolution`, `stretched`, `displayMode`, `fpsLimit`, `vsync` | **Yes** | `GameUserSettings.ini`, then read-only |
| `windowsPointerSpeed`, `enhancePointerPrecision` | **Yes** | Same as CS2 (`SystemParametersInfo`) |
| `binds` (action to key), `controller` (preset, sens, deadzones) | No (show) | Checklist sorted by settings tab |
| `hud`, `audio` | No (show) | Checklist |

Station flow: snapshot `GameUserSettings.ini` (contents and read-only flag) and
the mouse registry values. Write the resolution keys, set read-only, apply
Windows mouse settings, launch with
`com.epicgames.launcher://apps/Fortnite?action=launch&silent=true` (unverified
URI form), and show a full-screen "type these values" sheet or a QR code back
to the phone view. On Reset: clear read-only, restore the ini and mouse
settings, and tell staff to press "Reset to default" in-game on the station
account. Only that resets the cloud `ClientSettings.Sav`.

What the station cannot do: set sensitivity, binds, HUD, audio or controller
settings on the station account without a player or staff member doing it in
the menu. The next player inherits the previous player's in-game changes
through the station account's cloud file. This is the Fortnite version of
the Steam Cloud problem in CS2, and it cannot be switched off.

Mitigation: use one Epic account per station. Snapshot the station account's
`Saved\Cloud\<id>\ClientSettings.Sav` as a known baseline (read-only, for
diffing). Add a staff "restore defaults" step to Reset. Encourage
own-account login for serious play, combined with only the local video and
mouse writes. Do not hand-edit or upload `ClientSettings.Sav`.

Open questions to test on a station: whether a local `ClientSettings.Sav`
survives login; whether a read-only `ClientSettings.Sav` blocks the cloud
download; and whether `Input.ini` has any effect.

## Sources

- https://prosettings.net/blog/how-to-use-stretched-resolution-in-fortnite
- https://www.thespike.gg/fortnite/beginner-guides/how-to-get-stretched-resolution
- https://prosbind.com/blog/fortnite-settings-not-saving
- https://www.keengamer.com/articles/features/troubleshooting/5-ways-to-fix-the-fortnite-settings-not-saving-on-a-windows-pc/
- https://www.makeuseof.com/windows-11-10-fortnite-not-saving-game-settings/
- https://www.epicgames.com/help/fortnite-battle-royale-c-202300000001636/a202300000017401 (Epic: settings not saving; fetch blocked, title only)
- https://www.epicgames.com/help/en-US/c-Category_EpicAccount/c-ConnectedAccounts/how-do-i-get-my-fortnite-fall-guys-or-rocket-league-progress-to-sync-across-all-of-my-devices-a000094355
- https://github.com/LeleDerGrasshalmi/FortniteEndpointsDocumentation (Cloudstorage/User/File/Update.md, List.md)
- https://github.com/GalaxySwapperOfficial/Galaxy-Swapper-v2/blob/main/Workspace/ClientSettings/ClientSettingsData.cs
- https://github.com/AltimorTASDK/ClientSettingsEditor
- https://steamcommunity.com/app/824270/discussions/0/1630789172628389586
- https://www.quora.com/In-Fortnite-is-there-a-way-to-save-the-PC-key-binds-configuration
- https://sensconverter.app/cs2-to-fortnite-sensitivity-converter/
- https://csdb.gg/sensitivity-converter/
- https://sensconverter.info/mouse-sensitivity-converter/fortnite/
- https://www.fortnite.com/competitive/rules-guidelines/rules-library/fortnite-championship-series-fncs-2026-official-rules (fetch blocked; search snippets only)
- https://www.fortnite.com/competitive/events/FNCS%20GC%20LAN/
- https://www.ggrecon.com/guides/does-fortnite-have-anti-cheat/
- https://assets.documentcloud.org/documents/4446722/Epicresponse.pdf (Epic EULA prohibitions, 2018 filing)
