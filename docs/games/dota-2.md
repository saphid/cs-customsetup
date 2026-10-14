# Dota 2: feasibility for the station helper

Researched 2026-10-14. "Unverified" marks anything not confirmed by Valve or
by a test on a real station. Verify file names on a current Windows install
before building.

## Verdict: Full on station Steam accounts (Steam Cloud off), Partial otherwise

Dota 2 is Source 2, like CS2. Its settings are local files: some in the game
folder, some in the per-account `userdata\<id>\570` folder that Steam Cloud
syncs. With Steam Cloud off for Dota 2 on the station account, a helper can
write them and they stick. This is the same lesson as CS2. An `autoexec.cfg`
(or `+exec`) can also run convars after the saved config.

Caveat: Dota hotkeys live in `dotakeys_personal.lst`, a KeyValues file
written by the game, not in a cfg the console can `exec`. The station has to
write that file directly. That makes it file-level, like CS2's
`cs2_video.txt`.

## Where settings live

`<Dota>` = `<library>\steamapps\common\dota 2 beta\game\dota`.
`<UD>` = `<Steam>\userdata\<steamid3>\570`.

| Setting | File | Notes |
|---|---|---|
| Hotkeys (abilities, items, unit/camera commands), quick cast / self cast per slot | `<UD>\remote\cfg\dotakeys_personal.lst` | Steam Cloud. KeyValues. AveYo's reset script preserves it, and his quick-cast toggler edits it. BindCourier (2026) copies it between accounts |
| Raw console binds | `<Dota>\cfg\user_keys_0_slot0.vcfg` (`slot1..3`), `user_keys_default.vcfg` | Game folder. A Steam thread found stale `user_keys` files overriding autoexec |
| Gameplay convars (`dota_camera_speed`, `dota_ability_quick_cast`, `dota_screen_shake`, ...) | `<Dota>\cfg\user_convars_0_slot0.vcfg`, `machine_convars.vcfg`; older guides name `<UD>\remote\cfg\config.cfg` | Exact current file unverified |
| Video (resolution, window mode, quality) | `video.txt` with `setting.defaultres`, `setting.defaultresheight`, ... Reported both in `<UD>\remote\cfg\` and `<UD>\local\cfg\` | Location unverified. It contains the GPU VendorID/DeviceID, so edit keys in place and never copy the file between PCs |
| Control groups, hero builds, hero grids | `<UD>\remote\cfg\control_groups.txt`, `herobuilds.cfg`, `hero_grid_config.json` | Steam Cloud. Optional |
| Player autoexec | `<Dota>\cfg\autoexec.cfg` | Runs at start. Not cloud-synced |
| Steam Cloud index | `<UD>\remotecache.vdf` | Steam's sync ledger; AveYo deletes it on reset |

**Account binding:** a 2019 Steam thread reports that copying `config.cfg`
to another account did not carry hotkeys, because "hotkeys and game settings
are stored on the Steam Cloud". With Cloud on, Steam restores the account's
cloud copy over local edits. BindCourier (Sept 2026) copies the whole `570`
folder between accounts on one PC and works with Dota closed. Nothing
indicates server-side storage beyond Steam Cloud (unverified).

## Can a helper write them before launch?

- **Yes, with Dota closed and Steam Cloud off for Dota 2 on the station
  account** (Steam > Dota 2 > Properties > General). Write
  `dotakeys_personal.lst` and the convar or `video.txt` keys. Put gameplay
  convars in a station-owned `cssetup_dota.cfg` and run it with `+exec`, as
  CS2 does, so it wins over the saved config.
- With Cloud on, Steam either restores the old cloud copy or shows the
  "Cloud Sync Conflict" dialog. AveYo's reset script tells users to pick
  "Local Save". A station cannot rely on someone answering that dialog.
- **Read-only trick:** a Steam thread reports that read-only files in
  `dota\cfg` make the game misbehave. AveYo's script clears read-only
  attributes (`attrib -r`). Do not use it.
- **Import/export:** Dota has no settings share code. Hero builds and guides
  come through the Workshop. The rest is handled by community tools
  (BindCourier, autoexec generators).

## Anti-cheat (VAC) and policy

- VAC is not kernel-level. Editing cfg, vcfg, lst and txt files while the
  game is closed is normal practice (AveYo, autoexec generators, Valve's own
  guidance to use autoexec).
- Valve's 2023 statement (40,000 bans): "if you are running any application
  that reads data from the Dota client as you're playing games, your account
  can be permanently banned". The station must not read or touch the running
  process. Its file writes happen before launch and after exit only.
- Avoid: multi-action alias or macro binds ("console/autoexec to create
  macro is not" OK, per an old official-forum quote). Avoid convars outside
  the in-game range (camera distance hacks are a known ban reason,
  unverified), `-insecure`, and mods or VPK overrides. Event rulebooks (Red
  Bull Login 2025) ban any Dota-related tool other than Steam and Dota during
  a match.
- **Account sharing:** the Steam Subscriber Agreement forbids letting others
  use an account unless Valve authorizes it. Shared station accounts are
  clearly allowed only through the Steam PC Café Program.

## Mouse and camera speed across DPIs

Dota uses a desktop cursor. Community reports say Dota simply skins the
Windows pointer and has no in-game mouse-sensitivity setting (unverified for
current builds). Cursor travel per count is `DPI x Windows pointer
multiplier`. Commonly cited multipliers with Enhance Pointer Precision off:
6/11 (10) = 1.0, 8 = 0.75, 12 = 1.5, 14 = 2.0. To keep the player's feel,
pick the station pointer speed whose multiplier is closest to
`playerMult x playerDPI / stationDPI`. The steps are discrete, so the match
is approximate; report the error to the player.

Camera edge-pan and keyboard speed (`dota_camera_speed`, default 3000 per
community cfgs) are in world units per second, not mouse counts, so they need
no conversion.

## How events handle it today

- Most rulebooks (e.g. IESF 2023) require players to use their **own** main
  Steam account. Players log in and the Steam Cloud brings their hotkeys.
- League or lobby settings (tournament tickets, lobby passwords, cheats off)
  live in the lobby, not on the PC.
- Conventions and casual LANs with station accounts: players rebind by hand,
  or the venue uses a cloned profile.

## Implementation sketch

Profile schema (`game: "dota2"`):

- `hotkeys`: ability slots 1–6, item slots 1–6 plus neutral item, courier,
  select hero, camera grid, shop, scoreboard. Keys are stored as Source key
  names and compiled to `dotakeys_personal.lst`.
- `castMode`: per ability and item slot, normal, quick or quick-on-release,
  plus `dota_ability_quick_cast` (double-tap self cast).
- `camera`: `speed`, `edgePan`, `legacyKeys`. `mouse`: `dpi`, `windowsSpeed`,
  `enhancePrecision`.
- `video`: `width`, `height`, `windowMode`, `fpsMax`, quality preset.
- `interface`: minimap side, health-bar options, auto-attack mode. `audio`:
  the volume convars.
- `extraConvars`: validated against an allow-list built from a convar dump
  (SteamDatabase tracks Dota 2 as it does CS2).

Station flow (station Steam account, Steam Cloud off for Dota 2):

1. Baseline: copy `<UD>\remote\cfg`, `<UD>\local\cfg`, `<Dota>\cfg\*.vcfg`,
   `autoexec.cfg` and the Windows mouse settings, as the CS2 baseline does.
2. Load (Dota closed): write `dotakeys_personal.lst` (generated from a
   template captured from the baseline, so unknown keys survive). Patch
   `video.txt` keys in place. Write `cfg\cssetup_dota.cfg` with gameplay and
   audio convars. Set the Windows pointer speed from the DPI conversion.
3. Launch: `steam://rungameid/570//+exec cssetup_dota` (verify the argument
   passing), or `dota2.exe +exec cssetup_dota`.
4. Reset: restore the baseline files and mouse settings. Delete files that
   appeared later.

What the station cannot do:

- It cannot write to a player's own account's cloud without their login. If
  the player logs in, their cloud hotkeys win, which is fine.
- It cannot dismiss Steam's cloud-conflict dialog.
- It cannot change the mouse's DPI.

Risks:

- `dotakeys_personal.lst` is undocumented and can change on a patch. Keep a
  version check and fall back to `+exec` binds.
- `video.txt` location is unverified.
- Shared Steam accounts may breach the Subscriber Agreement outside the PC
  Café Program.

## Sources

- Steam thread, autoexec vs `user_keys_0_slot0`, Cloud Sync workaround (2019, 2023): https://steamcommunity.com/app/570/discussions/0/1651043320645602262
- Steam thread, hotkeys "stored on the Steam Cloud", config.cfg path (2019): https://steamcommunity.com/app/570/discussions/0/1779388024852917094/
- AveYo resetDota2.bat (2024 v5; files kept, remotecache, conflict prompt): https://github.com/AveYo/Gaming/blob/main/Dota2/resetDota2.bat
- AveYo D-OPTIMIZER (reset_Dota2.bat, quick-cast toggler editing dotakeys_personal.lst): https://github.com/AveYo/D-OPTIMIZER
- BindCourier, copies `userdata\<id>\570` between accounts (Sept 2026): https://github.com/jamesishandsome/BindCourier
- Dota keybind reader (user_keys.vcfg, dotakeys_personal.lst, slot vcfgs): https://github.com/jayavibhavnk/keybinds
- Sample Source 2 Dota cfg folder (user_convars_0_slot0.vcfg, user_keys slots): https://github.com/muk-as/DOTA2_CLIENT
- dota_camera_speed sample autoexec: https://github.com/nudebandage/d2settings
- Liquipedia console / autoexec location: https://liquipedia.net/dota2/Console
- video.txt example and location claims: https://steamcommunity.com/app/570/discussions/0/412446292760675443 and https://vpedota2.com/how-to-save-and-back-up-a-dota-2-configuration
- Valve honeypot ban wave statement (Feb 2023): https://www.nme.com/news/dota-2-bans-40000-cheaters-by-using-their-own-hacks-against-them-3402776
- Old official stance on autoexec macros (quoted): https://steamcommunity.com/app/570/discussions/0/1743346190269163289
- IESF WEC 2023 Dota 2 rulebook (own main Steam account): https://liquipedia.net/commons/images/8/8b/IESF_WEC_2023_Dota2_Rulebook.pdf
- Red Bull Login rulebook (no tools besides Steam and Dota): https://www.redbull.com/mea-en/events/red-bull-login-jordan/rule-book-dota2
- Steam PC Café Program / shared accounts: https://help.steampowered.com/en/faqs/view/71EA-CDCE-FB5C-82B3 and https://store.steampowered.com/agreement
- Dota cursor follows Windows pointer, no in-game mouse speed (community, 2015 and 2020–2023): https://steamcommunity.com/app/570/discussions/0/618463738394674038 and https://steamcommunity.com/app/570/discussions/0/2245552086109105233
