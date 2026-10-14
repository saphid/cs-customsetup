# Deadlock: feasibility for the station helper

Researched 2026-10-14. "Unverified" marks anything not confirmed by Valve or
by a test on a real station. Deadlock is still an invite-only Steam playtest
with no release date (Oct 2026). Files and convars change often between
patches, so re-check every item against the current build.

## Verdict: Full on station Steam accounts (Steam Cloud off), closest to CS2

Deadlock is Source 2 and stores settings the same way CS2 and Dota 2 do:
`.vcfg` and `.txt` files in the game folder plus a Steam Cloud folder under
`userdata\<id>\1422450`. A console cfg run with `-exec`/`+exec` works
(community configs use `-exec autoexec.cfg`). It is an FPS with raw-input
aim, so sensitivity conversion is exact, as in CS2. The same CS2 lesson
applies: turn Steam Cloud off for Deadlock on station accounts.

Extra precondition: every station Steam account must have Deadlock access
(an invite), because the game is not freely downloadable.

## Where settings live

`<DL>` = `<library>\steamapps\common\Deadlock\game\citadel`.
`<UD>` = `<Steam>\userdata\<steamid3>\1422450`.

| Setting | File | Notes |
|---|---|---|
| Ability, item and action hotkeys (the in-game Keybinds menu) | `<UD>\remote\cfg\citadelkeys_personal.lst` | Steam Cloud. KeyValues, same family as Dota's `dotakeys_personal.lst`. The defaults ship as `cfg\citadel_keys.lst` (`"CitadelKeys" { "Commands" { "Default" { "Ability1" { "Action" "+in_ability1" ... }`) |
| Raw binds and analog (mouse axis) bindings | `<DL>\cfg\user_keys_0_slot0.vcfg` plus `user_keys_0_slot0_lastclouded.vcfg` | `_lastclouded` is the Steam Cloud snapshot. Edit both, or turn Cloud off. Keep `analogbindings` `MOUSE_X yaw`, `MOUSE_Y pitch` or aim breaks; "Reset settings" in game does not fix it |
| Sensitivity, gameplay, HUD, audio convars | `<DL>\cfg\user_convars_0_slot0.vcfg` (by analogy with CS2 and Dota; unverified) | Override with a station cfg via `+exec` |
| Video (resolution, window mode, quality, upscaling) | `<DL>\cfg\video.txt` (`setting.defaultres`, `setting.r_citadel_*`) | Machine-level, not per account. A `-autoconfig` launch option resets it on every launch |
| Renderer choice | `<DL>\cfg\boot.vcfg` | Leave alone |
| Hero builds | `<UD>\remote\cfg\cached_hero_builds.kv3` | Account-bound and cloud-synced. Out of scope |
| Steam Cloud index | `<UD>\remotecache.vdf` | Steam's sync ledger |
| Search paths and mods | `<DL>\gameinfo.gi`, `<DL>\addons\` | **Never touch** (see anti-cheat) |

Deadlock keeps no settings on a Valve server beyond Steam Cloud
(unverified). Its in-game menus have no import/export or share codes.

## Can a helper write them before launch?

- **Yes, with Deadlock closed and Steam Cloud off for it** on the station
  account. Write `citadelkeys_personal.lst`, patch `video.txt` keys, and put
  sensitivity and other convars in a station-owned `cfg\cssetup_deadlock.cfg`
  that runs last via `+exec`.
- With Cloud on, the game or Steam compares files against `_lastclouded` and
  restores or uploads them. CS2 tools that write vcfg files with Cloud on
  update the `_lastclouded` sibling too, so the cloud check does not revert
  them. That is fragile, and it writes into the account's cloud. Prefer Cloud
  off.
- No read-only tricks are reported for Deadlock. Do not use any: Source 2
  rewrites vcfg files on exit and may misbehave if it cannot.

## Anti-cheat and policy

- Deadlock has server-side cheat detection (Sept 2024): a flagged cheater is
  banned or turned into a frog. Valve announced a more extensive v2. No kernel
  driver is known. VAC status is unverified.
- Editing cfg, vcfg, lst and txt files before launch is normal practice,
  like CS2 autoexecs, and there are no reports of bans for it.
- **Avoid `gameinfo.gi` and `addons`.** Performance configs that edit
  `gameinfo.gi` are popular, but Valve's string table includes "Unable to
  enter matchmaking while any party member has changes to ConVars in
  Gameinfo.gi or is running Tools-Mode" (not fully enforced yet, per the
  OptimizationLock README). The station must only `exec` normal convars.
- Avoid snap-tap or null-bind style binds, multi-action aliases, `-insecure`
  and `-allow_third_party_software`. They are blocked in CS2, and
  tournaments will treat them the same way.
- **Account sharing:** same Steam Subscriber Agreement limits as Dota 2 and
  CS2. On top of that, invite-only access makes a pool of station accounts
  harder to provision.

## Mouse sensitivity across DPIs

Aim uses raw mouse counts (Source 2 `analogbindings` MOUSE_X/MOUSE_Y to
yaw/pitch). Third-party converters treat Deadlock's yaw as 0.022 deg/count,
the same as CS2, so CS2 sensitivities carry over 1:1 (unverified against
Valve). The existing conversion applies:
`stationSens = playerSens x playerDPI / stationDPI`, with eDPI and cm/360
unchanged. Zoom or ADS ratio needs no change. Windows pointer settings only
affect the desktop and menus.

## How events handle it today

- The competitive scene is community-run: Deadlock Night Shift online cups,
  Death Slam LAN, and Guildlock Invitational 2026 (San Jose, 8–9 Aug 2026,
  billed as the first US Deadlock LAN). No public rulebook covers PC setup.
  Patches change often, so organizers lock a patch per event.
- Players log in with their own Steam accounts, which own the invite, so
  their keybinds come from Steam Cloud. Station-account events would need
  invited accounts.

## Implementation sketch

Reuse the CS2 code path almost directly. Profile schema
(`game: "deadlock"`):

- `mouse`: `dpi`, `sensitivity`, `zoomRatio` (convar name to verify with
  `find sens` in the console), `windowsSpeed`, `enhancePrecision`.
- `keys`: map of `citadel_keys.lst` command names (`Ability1..4`,
  `AbilityMelee`, `Item1..4`, ...) to Source key names. These compile to
  `citadelkeys_personal.lst`. Validate names against the current
  `citadel_keys.lst` (dumped from `pak01` by SteamDatabase
  GameTracking-Deadlock).
- `video`: `width`, `height`, `windowMode`, `fpsMax`, upscaler and quality.
  These are patched into `video.txt`.
- `hud` and `audio`: an allow-listed set of convars, and
  `extraConvars` (allow-list from a convar dump).

Station flow (station Steam account with Deadlock access, Cloud off):

1. Baseline: copy `<UD>\remote\cfg`, `<DL>\cfg\*.vcfg`, `video.txt`,
   `autoexec.cfg` and the Windows mouse settings.
2. Load (Deadlock closed): write `citadelkeys_personal.lst`, generated over
   the baseline copy so unknown blocks survive. Patch `video.txt`. Write
   `cfg\cssetup_deadlock.cfg` with sensitivity and convars. Set the Windows
   mouse settings.
3. Launch: `steam://rungameid/1422450` with `+exec cssetup_deadlock`, or
   `deadlock.exe` (`game\bin\win64\`) with that argument (verify that `+exec`
   is honored and runs after the saved config, as the CS2 real-game test
   did).
4. Reset: restore the baseline. Delete new files and per-account folders.

What the station cannot do:

- It cannot grant Deadlock access.
- It cannot write a player's own cloud keybinds without their login.
- It cannot apply mods or `gameinfo.gi` performance configs (deliberately).
- It cannot set mouse DPI.

Risks:

- Playtest churn: file names, convars and the keys list can change on any
  patch. Version-check `citadel_keys.lst` and fail closed.
- Analog bindings broken by a bad `user_keys` file disable aiming.
- Invite-only access and shared-account rules limit station accounts.

## Sources

- Release status (invite-only, no date, Oct 2026): https://insider-gaming.com/how-to-play-deadlock-on-steam-explained/ and https://www.dexerto.com/gaming/how-many-people-play-deadlock-player-count-2867201
- `citadelkeys_personal.lst` path (Deadlock forum, Sept 2024): https://forums.playdeadlock.com/threads/cant-move-as-mo-and-krill.29224
- `user_keys_0_slot0.vcfg`, `_lastclouded`, analog bindings (Steam thread, Sept 2024): https://steamcommunity.com/app/1422450/discussions/0/4758704348167575605
- Default `citadel_keys.lst` (extracted pak01): https://github.com/PieceofBanana/deadlock_vpk/blob/main/pak01/cfg/citadel_keys.lst
- SteamDatabase Deadlock tracker (cfg defaults, current build): https://github.com/SteamDatabase/GameTracking-Deadlock
- Community config with `-exec autoexec.cfg`, cfg path (updated 2026-10-07): https://codeberg.org/trapplus/deadlock-resources
- OptimizationLock (gameinfo.gi, video.txt, matchmaking-block string): https://github.com/Sqooky/OptimizationLock
- Hero builds path, remotecache.vdf: https://github.com/Gidntsquia/deadlock-optimal-build-finder
- `_lastclouded` behaviour in CS2 tools: https://github.com/brunobach/cs2-config-manager
- Frog anti-cheat (Sept 2024): https://esports.gg/news/deadlock/deadlock-anti-cheat-gives-players-the-choice-of-banning-cheaters-or-turning-them-into-a-frog
- Sensitivity converters (yaw 0.022, CS2 = Deadlock): https://www.mouse-sensitivity.com/n/cs2-to-deadlock and https://csdb.gg/sensitivity-converter/
- Events: https://liquipedia.net/deadlock/Guildlock_Invitational/2026, https://liquipedia.net/deadlock/Death_Slam_LAN, https://deadlockmod.com/news/community-league-pro-scene-roundup
- Steam account sharing / PC Café Program: https://store.steampowered.com/agreement and https://help.steampowered.com/en/faqs/view/71EA-CDCE-FB5C-82B3
