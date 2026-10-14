# League of Legends: feasibility for the station helper

Researched 2026-10-14. "Unverified" marks anything not confirmed by Riot or by
a test on a real station. Verify on a Windows station before building.

## Verdict: Partial (account-bound, with a supported local route)

Riot stores LoL settings on the Riot account and writes them back into local
files. A helper cannot leave plain files on disk and expect them to survive,
the way CS2's `+exec` does. Two routes can still work on a **station-owned**
Riot account:

1. Write `PersistedSettings.json` (the server copy's local mirror) plus
   `game.cfg` / `input.ini` while the client is closed. Riot's own support
   article documents editing `PersistedSettings.json` by hand, then playing a
   custom game so the change is saved.
2. Better: once the station account is logged in, PATCH the League Client's
   local API (`/lol-game-settings/v1/game-settings` and `/input-settings`,
   then `POST /lol-game-settings/v1/save`). The client then uploads the
   settings itself, so nothing fights the change.

On a player's **own** account, the helper has no work to do: Riot already
restores their keybinds and settings when they log in.

## Where settings live

The install path defaults to `C:\Riot Games\League of Legends`. Riot support
names the config folder `...\League of Legends\Config`. A tool updated in
October 2026 (TFT-Hextech-Helper) uses `<install>\Game\Config`. Search both
paths (unverified which one current builds use).

| Setting | File and key |
|---|---|
| Hotkeys, quick cast, smart cast | `input.ini`, section `[GameEvents]`: `evtCastSpell1..4`, `evtSmartCastSpell1..4`, `evtSmartPlusSelfCastWithIndicatorSpell1..4`, `evtUseItem1..7`, `evtSysMenu`, ... Values are `[q]`, `[Shift][q]`, `[<Unbound>]`, or a comma-separated pair |
| Quick-cast-on-release | `game.cfg` `[HUD] SmartCastOnKeyRelease` |
| Mouse (cursor) speed | `game.cfg` `[General] GameMouseSpeed` (samples hold 10–11) and `SystemMouseSpeed`; `CursorScale` |
| Camera | `game.cfg` `[HUD] MapScrollSpeed`, `KeyboardScrollSpeed` (0–1 floats), `CameraLockMode`, `ScrollSmoothingEnabled`, `MiddleClickDragScrollEnabled`, `SnapCameraOnRespawn` |
| Attack-move, targeting | `game.cfg` `[General] EnableTargetedAttackMove`, `AutoAcquireTarget`, `PredictMovement` |
| Video | `game.cfg` `[General] Width`, `Height`, `WindowMode` (0 full, 1 windowed, 2 borderless, unverified), `WaitForVerticalSync`; `[Performance] ShadowQuality`, `CharacterQuality`, `FrameCapType`, ... |
| Interface | `game.cfg` `[HUD] GlobalScale`, `MinimapScale`, `ChatScale`, `FlipMiniMap`, `ShowAttackRadius`, `DrawHealthBars`, ... |
| Audio | `game.cfg` `[Volume] MasterVolume`, `SfxVolume`, `VoiceVolume`, `PingsVolume`, `*Mute` |
| Server copy | `PersistedSettings.json`: `{"files":[{"name":"Game.cfg","sections":[{"name":"HUD","settings":[{"name":...,"value":"..."}]}]}, {"name":"Input.ini",...}]}`. Its own header says: "The settings in this file are persisted server-side ... Editing it is not recommended. Modify SettingsToPersist.json to specify which settings are persisted." |

Format: `game.cfg` and `input.ini` are INI files. `PersistedSettings.json`
mirrors them with every value as a string.

**Account binding:** Riot says keybindings "are account-bound and saved on our
servers". In practice the server copy is written back over local edits (see
the next section). Video settings are probably in the persisted set too, but
`SettingsToPersist.json` decides which (unverified per key).

## Can a helper write them before launch?

- **Plain file edits are overwritten.** Community guides report that
  `PersistedSettings.json` "doesn't respect" edits to `input.ini`.
  TFT-Hextech-Helper swaps the entire Config folder and runs a file watcher,
  because the client writes the account's settings back after a game. Riot's
  reset guide deletes files that "reappear" after the client starts and after
  login.
- **Read-only trick:** Korean and older forum guides set
  `PersistedSettings.json` read-only so the game cannot revert settings.
  It is anecdotal and fragile, and a station would then never save the
  player's in-game changes. Do not rely on it.
- **Supported-looking route:** edit `PersistedSettings.json` while the client
  is closed, then start the client. Riot's FAQ says to edit it, "join a Custom
  Game and exit", and the changes "will be saved". This uploads the change to
  the station account, so the next player inherits it until Reset re-applies
  the baseline.
- **LCU API route (recommended):** the client exposes a local HTTPS API on a
  random port. The port and password are in `<install>\lockfile`. The API has
  `GET/PATCH /lol-game-settings/v1/game-settings` and `/input-settings`, plus
  `POST /lol-game-settings/v1/save`, `/reload-post-game` and `GET .../ready`
  (community swagger generated from client 16.19, Sept 2026). The bodies are
  JSON objects keyed by section, e.g. `{"General":{"GameMouseSpeed":10}}`. A
  2019 school "LoL Cup" tool already applied tournament settings this way. The
  LCU is unofficial, undocumented and can change without notice.
- **Import/export:** LoL has no settings import/export or share code. Riot
  lists "Restore Defaults" only.

## Anti-cheat (Vanguard) and policy

- Vanguard has been mandatory since May 2024. It is a kernel driver that runs
  from boot, so stations need it installed and must reboot after install.
- No Riot source says that editing Config files or calling the LCU is
  forbidden. Riot's own support pages tell players to edit
  `PersistedSettings.json`. Riot's third-party policy targets tools that give
  an advantage, automate play or expose hidden information. Settings changes
  do neither. The community LCU rules say: do not touch shop, chat or
  authentication, and do not automate ready check or champion select.
- Avoid: writing anything while the game process (`League of Legends.exe`)
  runs, injecting into or reading game memory, and skin or file mods.
- **Account sharing:** Riot's Terms (section 1.5) say you cannot share an
  account or let another person access it. A pool of organizer-owned station
  accounts, each used by many players, conflicts with that wording unless the
  event has Riot's permission. Treat this as an organizer decision, not
  something the tool solves.

## Mouse and camera speed across DPIs

LoL uses a desktop-style cursor. The cursor-speed-pin project reports that LoL
changes the Windows pointer speed while in game, so LoL appears to apply
`GameMouseSpeed` through the Windows setting (unverified). Cursor travel per
count is roughly `DPI x pointer multiplier`, so the station should scale the
player's cursor speed by `playerDPI / stationDPI`. Riot does not publish the
mapping from `GameMouseSpeed` (stored 0–20?, slider 0–100) to a multiplier.
Calibrate it on one station before shipping the conversion. Camera scroll
speed is in screen units, not mouse counts, so it needs no conversion.

## How events handle it today

- Pro leagues play on Riot's Tournament Realm, a private server with
  per-player tournament accounts. Players set their settings on those
  accounts, and Riot's account sync carries them between PCs. No public
  rulebook text was found on settings (unverified).
- Community events use Riot's Tournament API (tournament codes, optionally
  limited to listed PUUIDs). Players log into their **own** accounts, so
  their settings follow them.
- Conventions with shared station accounts have no settings tool today; at
  best players rebind keys by hand in the client.

## Implementation sketch

Profile schema (`game: "lol"`):

- `keys`: map of `evt*` event name to one or two key strings in
  `input.ini` syntax.
- `castMode`: per slot (Q/W/E/R/D/F/items) normal, quick or quick with
  indicator. These compile to `evtCastSpellN`, `evtSmartCastSpellN` or
  `evtSmartCastWithIndicatorSpellN` bindings, plus `SmartCastOnKeyRelease`.
- `mouse`: `dpi`, `gameMouseSpeed`, `cursorScale`. `camera`: `mapScroll`,
  `keyboardScroll`, `lockMode`, `smoothing`, `middleClickDrag`.
- `video`: `width`, `height`, `windowMode`, `frameCap`, quality levels.
- `hud`: `globalScale`, `minimapScale`, `chatScale`, `flipMinimap`,
  attack-range toggles. `audio`: the volume and mute values.
- Validate keys against an allow-list of event names and enums, as the CS2
  validator does.

Station flow, for a station-owned Riot account only:

1. Baseline: copy the whole Config folder (both candidate paths) and the
   Windows mouse settings. Record the station account's current settings with
   `GET` on both LCU endpoints.
2. Load: make sure the client is running and logged in to the station account
   (`GET /lol-game-settings/v1/ready`). PATCH `game-settings` and
   `input-settings` with the profile merged over the baseline, then
   `POST /save`. If the client is not running, fall back to writing
   `PersistedSettings.json`, `game.cfg` and `input.ini` together.
3. Launch: the player starts a game from the client. The station cannot
   start a LoL game directly, so there is no CS2-style `+exec`.
4. Reset: PATCH the baseline JSON back, `POST /save`, restore the Config
   folder, and restore the Windows pointer speed (LoL may have changed it).

What the station cannot do:

- It cannot apply settings to a player's own Riot account without their login
  (and it does not need to).
- It cannot stop the server copy winning if it writes files while the client
  runs.
- It cannot change anything once a game has started.

Risks:

- The LCU and Config paths are unofficial and can change on any patch.
- Shared accounts may breach Riot's Terms.
- Vanguard or the client update can block automation that touches the client
  (low risk for settings-only calls, but unverified).
- A failed Reset leaves one player's keys on the station account's cloud copy.

## Sources

- Riot, reset configuration files: https://support.riotgames.com/riot/performance/reset-configuration-files
- Riot, hotkeys FAQ ("account-bound and saved on our servers"; edit PersistedSettings.json, play a custom game): https://support.riotgames.com/en-us/league-of-legends/performance/hotkeys-keybindings-faq
- Riot, mouse and keyboard issues (input.ini, PersistedSettings.json structure): https://support.riotgames.com/en-us/league-of-legends/performance/mouse-and-keyboard-issues
- Sample PersistedSettings.json with the "persisted server-side" header: https://github.com/nearalias/configs/blob/master/league_of_legends/PersistedSettings.json
- Sample game.cfg (all sections): https://github.com/campiohe/league-base/blob/main/lol-cfg/game.cfg
- Sample input.ini: https://github.com/WJZ-P/TFT-Hextech-Helper/blob/main/public/GameConfig/TFTConfig/input.ini
- TFT-Hextech-Helper config swap and watcher (`Game\Config` path; it is a TFT bot, cited only for file behavior): https://github.com/WJZ-P/TFT-Hextech-Helper/blob/main/src-backend/utils/GameConfigHelper.ts
- Community LCU swagger (client 16.19), lol-game-settings endpoints and LCU usage rules: https://github.com/dysolix/hasagi-types
- LCU basics (lockfile, unofficial status): https://hextechdocs.dev/getting-started-with-the-lcu-api/
- ZSŁ LoL Cup tools (tournament settings through LCU, 2019): https://github.com/Remlas/lolcup-tools
- PersistedSettings overrides edits (GameSkinny): https://www.gameskinny.com/tips/how-to-disable-zooming-inout-in-league-of-legends/
- Read-only trick (Korean guide): https://specialmanual.com/%EB%A1%A4-%EC%84%A4%EC%A0%95-%EC%B4%88%EA%B8%B0%ED%99%94-%EB%B2%84%EA%B7%B8-%ED%95%B4%EA%B2%B0-%EB%B0%A9%EB%B2%95-%EA%B2%8C%EC%9E%84-%EC%84%A4%EC%A0%95%EA%B0%92-%EA%B3%A0%EC%A0%95/
- LoL changes the Windows cursor speed: https://github.com/MCOfficer/cursor-speed-pin
- Riot third-party application stance: https://support.riotgames.com/riot/events/third-party-applications
- Vanguard FAQ (LoL): https://support-leagueoflegends.riotgames.com/hc/articles/24169857932435
- Riot Terms of Service (section 1.5, account sharing): https://www.riotgames.com/en/terms-of-service
- Tournament Realm (background): https://www.invenglobal.com/articles/9467/lcs-pros-now-allowed-to-stream-tournament-realm-matches-thanks-to-the-players-association
- Riot Tournament-V5 / tournament codes: https://www.riotgames.com/en/DevRel/tournament-v5-is-coming
