# Apex Legends reference for CS Setup

Checked 2026-10-14. Desk research only: nothing here has been tested on a real Apex
install. Apex runs through Steam or the EA app; both need an EA account login. The game
uses Respawn's Source-derived engine, so its files look much like CS:GO/CS2 files.

## Where settings live

All per Windows user under `%USERPROFILE%\Saved Games\Respawn\Apex\`:

| Setting | File | Format / example keys |
|---|---|---|
| Mouse sensitivity, ADS multipliers, acceleration, keybinds, audio | `local\settings.cfg` | Source cvars: `mouse_sensitivity "1.5"`, `mouse_use_per_scope_sensitivity_scalars "0"`, `mouse_zoomed_sensitivity_scalar_0`..`_7`, `m_acceleration "0"`, `sound_volume_*`; binds as `bind_US_standard "1" "weaponSelectPrimary0" 0` and `bind_held_US_standard "4" "+strafe" 1` |
| Resolution, display mode, graphics | `local\videoconfig.txt` | KeyValues like CS2's video file: `"setting.defaultres" "1920"`, `"setting.defaultresheight" "1080"`, `"setting.fullscreen" "1"` |
| FOV, HUD options, colour-blind mode, controller tuning | `profile\profile.cfg` | `cl_fovScale "1.47143"` (scales the base FOV; exact menu-to-cvar mapping unverified), `hud_setting_*`, `colorblind_mode`, `damage_indicator_style_pilot` |
| Optional autoexec | `<install>\cfg\autoexec.cfg` (create `cfg`), run with launch option `+exec autoexec` | Steam: `steamapps\common\Apex Legends\cfg`; EA app: `EA Games\Apex\cfg` |
| Legends, skins, rank | EA account, server side | n/a |

- Key names and layout come from a 2022 GitHub config repo and 2026 user reports; check
  them against a current install before writing (some keys may have moved).
- Several users report that settings are **not tied to the EA account**: whoever plays on
  a Windows user gets that user's `settings.cfg`, and people share PCs by swapping the
  file. That is exactly the CS2-like model the station needs.
- Cloud sync: Origin had a cloud-sync prompt where "cloud vs local" affected keybinds
  and settings; a GitHub guide says to disable Origin cloud sync to keep local configs.
  Whether the EA app or Steam Cloud currently syncs `Saved Games\Respawn\Apex` is
  unverified. Assume it can, as with Steam Cloud for CS2, and turn both off on stations.

## Can a helper write files and have them stick?

- **Yes, before launch.** Write `settings.cfg`, `profile.cfg` and `videoconfig.txt` with
  the game closed. The game rewrites them when settings change in game or on exit, so the
  station must restore its baseline after the session, as it does for CS2.
- **Autoexec as the override layer.** A `cfg\autoexec.cfg` run with `+exec autoexec`
  re-applies the player's sensitivity and binds after the game's own config, like
  `+exec cssetup` in CS2. Apex rejects many cvars inherited from other Source games
  (cheat-flagged or absent), so only use cvars that appear in Apex's own `settings.cfg`
  and `profile.cfg`, and check the console for errors. An older repo warns launch options
  can crash the game; 2026 guides still recommend `+exec autoexec`.
- Read-only `videoconfig.txt` is a known trick to stop resets but blocks in-game changes;
  not needed if the station writes before every launch.
- Settings reset after some patches (EA forum reports, 2026), which also wipes station
  baselines. Re-run `-SaveBaseline` after big updates.
- Share codes: none for settings or crosshair. Apex has only a reticle colour option.

## Anti-cheat (Easy Anti-Cheat)

- Config files and autoexec contain console commands the client parses itself; guides
  note the same commands typed in the console have the same effect and nothing is
  injected. No EA statement was found; low risk but unverified.
- ALGS rules have historically allowed editing exactly `local.cfg`, `autoexec.cfg`,
  `videoconfig.txt` and launch options (Year 2), with `fps_max` and letterbox lines named
  in 2021. Keep station edits within settings the game's menus expose.
- Avoid: modifying game binaries or VPKs, macro/scroll-wheel bind tricks that tournaments
  ban, any cvar the console rejects or flags as cheat.

## Sensitivity math

- Yaw: 0.022 degrees per count at sensitivity 1, same as CS2, so hipfire sensitivity
  carries over 1:1 at the same DPI. Example: CS2 2.0 = Apex 2.0.
- cm/360: `cm360 = 914.4 / (dpi * sens * 0.022)`.
- DPI change: `sens_station = sens_player * dpi_player / dpi_station`.
- ADS: `mouse_zoomed_sensitivity_scalar_N` per optic (0 = 1x, up to 10x; slot 7 unused),
  only applied when `mouse_use_per_scope_sensitivity_scalars "1"`; otherwise a single ADS
  multiplier. Copy them as is.
- FOV (`cl_fovScale`) changes how sensitivity feels but not cm/360 in hipfire.
- Apex uses raw input by default; Windows pointer settings affect only the desktop.

## Tournaments and LANs today

- ALGS Year 6 rules: competitors need an EA account with 2FA; at live events officials
  may provide computers, monitors, headsets and "EA or Game accounts". Competitors bring
  their own mice, keyboards or controllers, approved by officials.
- ALGS Year 2: competitors had to use the registered or EA-provided account and could not
  log out of it.
- Because settings are per Windows user rather than per EA account, players at LANs who
  log into their own account still get the station's settings, not their own. That makes
  this tool more useful for Apex than for account-bound games.

## Verdict: Full

Settings are local text files per Windows user, in Source formats close to CS2's. A
station can write and restore them and add an autoexec layer. Main risks: cloud sync,
key drift between patches, and cvars the game rejects.

## Implementation sketch

Profile schema (`games.apex`):

- `sensitivity` (from the shared cm/360; equals CS2 sens at same DPI), `adsMultiplier`,
  `perScope` (bool) and `scopeScalars[0..6]`, `mouseAcceleration` (off).
- `fov` (70-110, stored as `cl_fovScale`; mapping verify), `video`: `resX`, `resY`,
  `fullscreen` (0/1/2 for windowed/full/borderless; verify).
- `binds`: action/key pairs mapped to `bind_US_standard` / `bind_held_US_standard`.
- `audio`: master, music, dialogue volumes; `hud`: a small allow-list of `hud_setting_*`.

Station:

- Baseline: `%USERPROFILE%\Saved Games\Respawn\Apex\local\*` and `profile\*`, plus any
  existing `<install>\cfg\autoexec.cfg`.
- Load: merge player keys into `settings.cfg`, `profile.cfg`, `videoconfig.txt` (reuse
  the CS2 `cs2_video.txt` writer); write `cfg\cssetup.cfg` with sensitivity and binds;
  launch with `+exec cssetup` (Steam: `steam.exe -applaunch 1172470 +exec cssetup`, as for
  CS2; unverified for Apex. EA app launch options are set in its UI and may not be
  scriptable).
- Set Windows pointer speed and Enhance Pointer Precision.
- Reset: restore the baseline files and delete `cssetup.cfg`.
- Admin guidance: disable Steam Cloud for Apex and EA app cloud saves on every station.

Cannot do: mouse DPI/polling rate, GPU scaling for stretched, player's EA login.

## Sources

- File paths and `settings.cfg`/`profile.cfg`/`videoconfig.txt` keys (2022 repo): https://github.com/XyrizTan/apex-legends-config
- `videoconfig.txt` location: https://www.esportstales.com/apex-legends/how-to-increase-fps-videoconfig-settings-launch-options
- Settings reset reports, `settings.cfg` and `profile.cfg` (EA forum, 2026): https://forums.ea.com/idea/apex-legends-bug-reports-en/pcsteam-sept-15-settings-reset-missing-profile-cfg-launch-options-ignored/13710671
- Settings shared per Windows user, not EA account: https://forums.ea.com/discussions/apex-legends-technical-issues-en/a-very-odd-case-settings-sharing-in-apex-legends/5272617 and https://steamcommunity.com/app/1172470/discussions/0/3001047413714410086/
- Cloud sync and keybinds: https://dotesports.com/apex-legends/news/apex-legends-cloud-sync-error-fix
- Autoexec location, `+exec autoexec`, rejected cvars, read-only videoconfig, anti-cheat note (2026-08): https://ghostcfg.com/apex-config
- Autoexec and launch options (2026): https://github.com/moffa89/Apex-Legends-Autoexec-2026
- Per-optic ADS scalars: https://www.mouse-sensitivity.com/forums/topic/7397-apex-legends-cfg-ads-sensitivity-settings/
- Yaw 0.022 / CS2 1:1: https://csdb.gg/sensitivity-converter/apex-to-cs2/
- ALGS Year 6 rules: https://algs.ea.com/rules (PDF; sections 4.2 and 4.3)
- ALGS Year 2 match rules (editable files, account rules): https://cdn.battlefy.com/apex-legends-global-series-year-2/rules/match-rules-english.pdf
- ALGS 2021 rules (local.cfg, autoexec.cfg): https://media.contentapi.ea.com/content/dam/apex-legends/compete/common/algs-rules/championship/championship-rules/algs-official-rules-complete-04072021-final-clean-docx.pdf
