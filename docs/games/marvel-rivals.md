# Marvel Rivals reference for Loadout

Checked 2026-10-14. Desk research only: nothing here has been tested on a real Marvel
Rivals install, and NetEase publishes no documentation for its config files. Marvel
Rivals is an Unreal Engine 5 game from NetEase, free on Steam (app 2767030) and Epic.
It needs an online NetEase account, created through the Steam or Epic login.

## Where settings live

| Setting | Where | Format / notes |
|---|---|---|
| Resolution, window mode, frame cap, graphics quality | `%LOCALAPPDATA%\Marvel\Saved\Config\Windows\GameUserSettings.ini` | Unreal `GameUserSettings` INI (`ResolutionSizeX`, `ResolutionSizeY`, `FullscreenMode`, `FrameRateLimit`, ...). Some players report the file missing on fresh installs |
| Keybinds (global and per hero), likely sensitivity and other gameplay options | `%LOCALAPPDATA%\Marvel\Saved\Saved\Config\<id>\MarvelUserSetting.ini` (note the doubled `Saved`) | Per game account (`<id>` folder). A second `MarvelUserSetting.ini` directly in `...\Saved\Saved\Config\` appears to hold non-account defaults. Format undocumented |
| Heroes, skins, rank | NetEase account, server side | n/a |

- Paths come from PCGamingWiki and Steam discussions (2024-2025). One user also mentioned a
  `marvelusersettings.json` (2025-12), so the file name or format may have changed.
  Inspect a current install before building anything.
- Whether sensitivity and keybinds are also stored on NetEase servers is **unverified**.
  Players believe "none of the character settings are stored server-side", but an Epic
  user reported that copying `MarvelUserSetting.ini` from one account's `<id>` folder to
  another did not work. That could mean server sync, a checksum, or simply a wrong file.
- Steam Cloud use for these folders is unknown. Treat it like CS2: turn Steam Cloud off
  for Marvel Rivals on station accounts until tested.
- Marvel Rivals allows separate sensitivity and keybinds per hero, so a profile is more
  than one number.

## Can a helper write files and have them stick?

- **Video (`GameUserSettings.ini`): probably yes**, as with any Unreal game, with the
  game closed. Players report the game sometimes resets display settings, and setting
  the file read-only helped some and not others.
- **Keybinds and sensitivity (`MarvelUserSetting.ini`): unknown.** Must be tested: write
  the file for the station account's `<id>`, launch, check in game, change something,
  quit, restore, relaunch. If it reverts, the settings are server-backed.
- **Mouse acceleration:** before January 2025 people disabled it by adding
  `[/Script/Engine.InputSettings]` with `bEnableMouseSmoothing=False` and
  `bViewAccelerationEnabled=False`. The Season 1 Part 2 patch added in-game toggles for
  mouse smoothing and acceleration under Keyboard - Combat, so the INI hack is no longer
  needed and should not be used (see anti-cheat).
- Share codes: no settings or crosshair codes found.

## Anti-cheat (NetEase Anti-Cheat Expert, "NACE")

- NetEase's in-house anti-cheat starts with the game and cannot be disabled. Whether it
  has kernel components is not officially stated.
- In December 2024 a NetEase producer/community manager publicly told players not to
  tweak config files to change mouse acceleration. A 2025 ban wave targeted modded
  clients (mostly `.pak` mods); reports say config edits were not the target, but
  developers warned some edits could look like tampering.
- Ignite 2026 rules forbid "unauthorized software or hardware in connection with
  gameplay".
- Conclusion: only write keys the game itself writes from its own menus (resolution,
  window mode, frame cap, and, if tested, binds and sensitivity). Never add hidden engine
  keys (Engine.ini tweaks, input-smoothing hacks, FPS unlock scripts). Risk is unverified
  and higher than for CS2 or Apex.

## Sensitivity math

- Yaw: 0.0175 degrees per count at sensitivity 1, a quarter of VALORANT's 0.07. This is
  community-derived from pro settings and converter sites; not confirmed by NetEase or
  mouse-sensitivity.com. Some sites claim 0.022 instead; test before trusting either.
- CS2 to Marvel Rivals: `mr = cs2 * 0.022 / 0.0175 = cs2 * 1.2571`. Example: CS2 2.0
  becomes 2.51. From VALORANT: x4. From OW2: x0.377.
- cm/360: `cm360 = 914.4 / (dpi * sens * 0.0175)`.
- DPI change: `sens_station = sens_player * dpi_player / dpi_station`.
- Per-hero overrides and the FOV slider (max 103) are copied as is.
- Raw input: the game had acceleration and smoothing on by default at launch; the
  in-game toggles must be off for cm/360 to be exact.

## Tournaments and LANs today

- Marvel Rivals Ignite 2026 (official league, with LAN events such as the Mid-Season
  Finals in Los Angeles, 2026-07-29 to 08-01): PC only; players must use a PC account in
  good standing that meets the registration requirements; playing on other
  participants' accounts is forbidden. Players may use keyboard and mouse or a
  controller.
- The Preseason/Stage 1 rulebook does not cover LAN station setup or settings
  adjustment time; no LAN-specific rulebook was found. Expect players to log into their
  own accounts (unverified).

## Verdict: Partial

Video settings are in a local Unreal INI the station can write. Sensitivity and binds
are in a per-account local file whose cloud behaviour is unknown, and the anti-cheat and
developer stance make outside edits riskier than for CS2. Until a real test proves the
binds file sticks, ship guidance-only for sensitivity and binds.

## Implementation sketch

Profile schema (`games.marvelRivals`):

- `sensitivity` (from the shared cm/360), `adsMultiplier`, `heroOverrides` (hero, sens,
  optional binds).
- `video`: `resX`, `resY`, `fullscreenMode`, `fpsCap`, `fov`.
- `mouseAcceleration` and `mouseSmoothing` (expected off; checklist item).
- `binds`: global binds as a checklist, written only if the test above passes.

Station:

- Baseline: `%LOCALAPPDATA%\Marvel\Saved\Config\Windows\GameUserSettings.ini` and the
  whole `%LOCALAPPDATA%\Marvel\Saved\Saved\Config\` tree.
- Load: write resolution, fullscreen mode and frame cap into `GameUserSettings.ini`;
  set Windows pointer speed and Enhance Pointer Precision; launch via
  `steam.exe -applaunch 2767030`; show a checklist with converted sensitivity, per-hero
  values, acceleration/smoothing off, and binds.
- Phase 2 (after testing): merge keys into the station account's
  `MarvelUserSetting.ini` the same way.
- Reset: restore both trees.

Cannot do (today): reliable sensitivity and binds, per-hero settings, NetEase login for
the player. Risks: unverified yaw, undocumented file format, possible anti-cheat
sensitivity to file edits, display settings resetting.

## Sources

- `GameUserSettings.ini` path and read-only reports: https://steamcommunity.com/app/2767030/discussions/0/596260472619052294 and https://steamcommunity.com/app/2767030/discussions/0/591759268792825779
- `MarvelUserSetting.ini` in `Saved\Saved\Config\<id>`: https://steamcommunity.com/app/2767030/discussions/0/592888933793185624/ and https://www.pcgamingwiki.com/wiki/Marvel_Rivals
- Copying settings between accounts did not work: https://forums.nexusmods.com/topic/13510486-marvel-rivals-question-keybinds-and-keyboard-settings-transfer/
- INI mouse-acceleration fix: https://esports.gg/guides/marvel-rivals/how-to-turn-off-mouse-acceleration-in-marvel-rivals
- In-game acceleration and smoothing toggles (Season 1 Part 2): https://mp1st.com/?p=277153 and https://noping.com/blog/turn-on-off-marvel-rivals-mouse-acceleration
- Developer warning against config tweaks, ban wave: https://twitter.com/Facio_Leaks/status/1868712812182474782 and https://esportnow.gg/games/news/a-ban-wave-is-hitting-modded-marvel-rivals-players
- NACE anti-cheat: https://steamcommunity.com/app/2767030/discussions/0/4521137097811490035 and https://www.exitlag.com/blog/es/marvel-rivals-anti-cheat/
- Yaw 0.0175 and conversion factors: https://senslab.pro/guides/marvel-rivals-sensitivity and https://esports.gg/news/marvel-rivals/how-to-convert-your-overwatch-sensitivity-to-marvel-rivals/
- Per-hero sensitivity and binds: https://1v9.gg/blog/marvel-rivals-best-keyboard-mouse-settings-guide
- Ignite 2026 Preseason and Stage 1 rules: https://www.marvelrivals.com/Marvel_Rivals_Ignite_2026_Rules_Preseason_&_Stage1_2026.3.13_V1.0.pdf
- Ignite 2026 LAN events: https://liquipedia.net/marvelrivals/MR_Ignite/2026
