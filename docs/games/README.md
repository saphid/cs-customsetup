# Other games

Research (October 2026) on loading a player's setup by code on other games. Each
file covers where the settings live, whether the station can write them, anti-cheat,
sensitivity math, how events handle setups today, and an implementation sketch.
Nothing here has been tested on a real install yet; unverified points are marked in
each file.

## Verdicts

| Game | Verdict | What the station can set | What stays manual or account-bound |
|---|---|---|---|
| [Counter-Strike 2](../cs2-reference.md) | **Done** | Everything (cfg + `+exec`), video, Windows mouse | Crosshair share code import (one click) |
| [Apex Legends](apex-legends.md) | **Full** | Local Source-style cfg files, `autoexec` + `+exec`; sensitivity 1:1 with CS2 | Check that EA app / Steam Cloud don't sync the files |
| [Dota 2](dota-2.md) | **Full** (Steam Cloud off) | Hotkeys `.lst`, convar/key vcfg, `+exec` cfg, video | Cursor speed is Windows pointer speed (approximate DPI match) |
| [Deadlock](deadlock.md) | **Full** (Steam Cloud off) | Same Valve layout as CS2; same sensitivity scale | Invite-only playtest; patches change the hotkey format often |
| [Rainbow Six Siege](rainbow-six-siege.md) | **Partial** | `GameSettings.ini`: sensitivity incl. per-scope ADS, FOV, video, audio | Key binds (location unknown); Ubisoft login required |
| [League of Legends](league-of-legends.md) | **Partial** | On station accounts: hotkeys and settings via the client's local settings API | Account-bound; Tournament Realm players carry their own |
| [Marvel Rivals](marvel-rivals.md) | **Partial** | Video; binds file only after a real test | Sensitivity/binds may sync to NetEase; editing warned against |
| [Fortnite](fortnite.md) | **Partial** | Resolution incl. stretched (`GameUserSettings.ini`) | Sensitivity, binds, HUD in Epic's cloud (`ClientSettings.Sav`) |
| [Call of Duty](call-of-duty.md) | **Partial** | Video, audio, raw input in the local `players` text file | Sensitivity, binds, FOV synced to the Activision account |
| [Rocket League](rocket-league.md) | **Partial** | Video (`TASystemSettings.ini`) | Camera/controller in an encrypted per-account save |
| [Street Fighter 6](street-fighter-6.md) | **Partial** | `config.ini` graphics; snapshot/restore of the save | Button layout in a binary save; players remap at the station |
| [Tekken 8](tekken-8.md) (+ Strive, 2XKO) | **Partial** | `GameUserSettings.ini` video; snapshot/restore | Button layout in binary saves; 2XKO is account-only |
| [Overwatch 2](overwatch-2.md) | **Account-only** | Video, FOV, audio (`Settings_v0.ini`) | Sensitivity, reticle, binds follow the Battle.net login |
| [Valorant](valorant.md) | **Account-only** | Video/stretched; crosshair code to clipboard | Everything else is on the Riot account (Vanguard) |

Cross-game pieces (display, audio, Steam Input, ASUS ROG peripherals, café-software
prior art): [cross-game-layer.md](cross-game-layer.md).

## What this means for the product

1. **One profile, many games.** The player's core stays the same across games: mouse
   DPI and cm/360, Windows pointer settings, resolution and aspect ratio, crosshair
   colour. Each game adds its own section. The server converts sensitivity per game
   from one cm/360 using each game's yaw (CS2/Apex/Deadlock 0.022, Valorant 0.07,
   Overwatch/CoD 0.0066, R6 derived in its file).
2. **Three tiers of support** on the station, chosen per game:
   - *Write*: the game reads local files the station can write (CS2, Apex, Dota 2,
     Deadlock, R6 video/sensitivity). Same baseline/restore lifecycle as CS2.
   - *Write video + checklist*: the station sets video and Windows settings and shows a
     card of converted in-game values to type in (Fortnite, CoD, Rocket League,
     Overwatch, Valorant, Marvel Rivals, fighting-game button layouts).
   - *Account API*: only where the publisher offers a local client API on station
     accounts (League of Legends), behind an organiser opt-in.
3. **Launcher cloud sync is the common enemy.** Steam Cloud, Epic, Ubisoft Connect and
   Activision all bring settings back. Station accounts must have cloud sync off where
   the launcher allows it, and Reset must say what it cannot undo.
4. **Never touch the running game or anti-cheat-protected traffic.** No hosts-file
   blocking (Valorant), no `gameinfo.gi`/addons (Deadlock), no save-file editing
   without organiser approval (Rocket League), no macro/snap-tap binds.
5. **Nearest gap in prior art:** café software (iCafeCloud Game Save, Gizmo Personal
   User Files, ggLeap scripts) copies whole config folders per member login. Nobody
   builds a setup on a phone, loads it by short code, or converts DPI.

## Suggested order

1. Generalise the profile (shared core + per-game sections) and the station (a game
   module per title with find/baseline/write/launch).
2. Apex Legends, then Dota 2 and Deadlock (same tier as CS2, mostly reusable code).
3. Rainbow Six Siege sensitivity + video.
4. The checklist tier for Valorant, Fortnite, Overwatch 2, CoD, Rocket League, and
   button cards for SF6 and Tekken 8.
5. League of Legends client API (opt-in).
Each game needs one verification run on a real install before it ships, as CS2 had.
