# Overwatch 2 reference for CS Setup

Checked 2026-10-14. Desk research only: nothing here has been tested on a real Overwatch 2
install. Overwatch 2 runs through Battle.net or Steam; both need a Battle.net account
login (the Steam copy links to a Battle.net account). There is no offline play.

## Where settings live

| Setting | Where | Notes |
|---|---|---|
| Sensitivity, per-hero sensitivity and zoom sensitivity, crosshair/reticle, keybinds (global and per hero), HUD and gameplay options, hero options | Battle.net account, server side (per platform since cross-progression) | Not in any local file found |
| Resolution, window mode, refresh, frame cap, graphics quality, FOV, brightness, audio volumes, performance overlay | `%USERPROFILE%\Documents\Overwatch\Settings\Settings_v0.ini` | Plain INI; one file per Windows user |
| Heroes, skins, rank | Battle.net account | n/a |

`Settings_v0.ini` sections (from an open-source OW2 settings editor, 2023): `[Render.13]`
(`FullScreenWidth`, `FullScreenHeight`, `FullScreenRefresh`, `FullscreenWindow`,
`WindowedFullscreen`, `FrameRateCap`, `UseCustomFrameRates`, `HorizontalFOV`, quality
levels, `ShowFPSCounter`, ...), `[Sound.3]` (`MasterVolume`, `MusicVolume`, `SFXVolume`,
`VoiceVolume`), `[GPU.6]`, `[Input.1]` (`HighTickInput`), `[Cinematics.1]`,
`[Subtitles.1]`. The section version numbers change between patches (unverified for
2026), so read the real file and edit only known keys.

- No sensitivity, reticle or keybind keys appear in that schema, which supports the
  forum and Blizzard statements that gameplay settings are kept with the account and only
  graphics stay local. Blizzard's 2022 cross-progression FAQ says gameplay settings are
  kept per platform on the account.
- One 2023 forum post claims keybinds are stored locally per account; the schema above
  and the beta-era reports disagree. Treat account-bound as the working assumption and
  confirm it in a real test.

## Can a helper write files and have them stick?

- **Account-bound settings: no.** There is no local file to write. They load with the
  Battle.net login.
- **Video and audio: probably yes.** `Settings_v0.ini` is local and per Windows user. The
  station can snapshot it, write resolution/window mode/FOV/frame cap/volumes, and restore
  it later. Users report the game rewrites it when settings change, and that Windows
  "Controlled folder access" can block writes to Documents (verify on stations).
- **Share codes:** Overwatch 2 has import codes only for custom game lobbies and Workshop
  modes. There are no crosshair codes or settings codes, and a forum request for keybind
  import/export (2023) went unanswered.

## Anti-cheat (Defense Matrix / Warden)

- Defense Matrix is Blizzard's umbrella for anti-cheat and anti-disruption. Blizzard
  defines cheat software as third-party software that reads and processes game
  information; that is banned under the Code of Conduct and Battle.net EULA.
- Editing `Settings_v0.ini` while the game is closed changes only options the game itself
  exposes, and community tools do it. No Blizzard statement on it was found (unverified,
  but low risk).
- Avoid: macros or input automation of the Overwatch or Battle.net UI, anything that runs
  while the game is open and touches it, and installing tools on organiser PCs without
  approval (EWC 2026 OWCS rule 4.2).

## Sensitivity math

- Yaw: 0.0066 degrees per count at sensitivity 1 (KovaaK's). CS2 uses 0.022.
- CS2 to OW2: `ow = cs2 * 0.022 / 0.0066 = cs2 * 3.3333`. Example: CS2 2.0 becomes 6.67.
- cm/360: `cm360 = 914.4 / (dpi * sens * 0.0066)`.
- DPI change: `sens_station = sens_player * dpi_player / dpi_station`.
- Sensitivity is set to two decimals in game; rounding error is tiny.
- "Relative aim sensitivity while zoomed" is a percentage (default 30), separate from
  hipfire, and can be overridden per hero. Overwatch uses raw input.

## Tournaments and LANs today

- OWCS is PC-only; players need Battle.net accounts in good standing (OWCS 2024 rules,
  2026 FAQ). The administration chooses the environment (FACEIT, Live, LAN client).
- OWCS Midseason Championship at EWC 2026: players get 5 minutes before a match and 1
  minute between games "to adjust personal preferences, USB connected peripherals, device
  software and game settings"; no software may be installed and no USB devices inserted
  on organiser PCs without approval; monitor settings other than volume need an
  official's permission; players bring their own mouse (and keyboard, IEMs).
- Whether official LANs use the player's own Battle.net account or tournament accounts was
  not found in the 2026 rulebooks (unverified). Community LANs generally have players log
  into their own accounts, which brings their settings automatically.

## Verdict: Account-only

Everything a player cares about most (sensitivity, reticle, binds, per-hero options) is
tied to the Battle.net login. The station can set only video, FOV and audio, plus Windows
mouse settings.

## Implementation sketch

Profile schema (`games.overwatch2`):

- `sensitivity` (from the shared cm/360), `zoomPercent`, optional `heroOverrides`
  (hero name, sens, zoom) shown as guidance.
- `reticle` (type, colour, thickness, length, gap, opacity, outline, dot) shown as a
  checklist; no code exists to import.
- `video`: `resX`, `resY`, `refresh`, `displayMode`, `fov` (80-103), `fpsCap`.
- `audio`: master, music, SFX, voice volumes.
- `binds`: checklist only.

Station:

- Snapshot and write `Documents\Overwatch\Settings\Settings_v0.ini` keys in `[Render.*]`
  and `[Sound.*]` (match the section by prefix because of version suffixes). Restore on
  reset.
- Set Windows pointer speed and Enhance Pointer Precision, as for CS2.
- Launch Battle.net (`Battle.net.exe --exec="launch Pro"` is the commonly cited form;
  unverified on 2026 builds) and show a checklist screen with converted sensitivity,
  zoom, reticle and binds.

Cannot do: write sensitivity, reticle, binds or hero settings; log in for the player;
reset what a player changed on a shared station Battle.net account (the next player
inherits it). Risks: section names change between patches; OneDrive-redirected
Documents folders move the file; GPU scaling is still the player's job.

## Sources

- `Settings_v0.ini` path (Blizzard forum): https://eu.forums.blizzard.com/en/overwatch/t/video-settings-not-updating/27517
- `Settings_v0.ini` sections and keys (OW2 settings editor schema, 2023): https://github.com/Marqasa/overwatch-settings
- Settings saved to account except graphics (beta-era forum): https://us.forums.blizzard.com/en/overwatch/t/settings-transfer-to-overwatch-2/691543
- Keybind import/export request (2023): https://us.forums.blizzard.com/en/overwatch/t/exportimport-keybinds-feature/819860
- Cross-progression FAQ (gameplay settings per platform): https://overwatch.blizzard.com/en-us/news/23824001/cross-progression-is-coming-to-overwatch-2-account-merge-faq/
- Custom game import codes: https://www.ggrecon.com/guides/overwatch-2-custom-game-codes/
- Defense Matrix: https://overwatch.blizzard.com/en-us/news/24173281/
- Yaw values: https://kovaaks.com/kovaaks/sens-converter
- OWCS Midseason Championship at EWC 2026 rulebook: https://cdn.esportsworldcup.com/resources/uploads/OWCS_Midseason_Championship_at_2026_Esports_World_Cup_Rulebook_6957159841.pdf
- OWCS 2024 official rules: https://esports.overwatch.com/Overwatch_Champions_Series_2024%E2%80%93Official_Rules_v1.0.pdf
- OWCS FAQ: https://esports.overwatch.com/en-us/faq
