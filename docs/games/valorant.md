# VALORANT reference for Loadout

Checked 2026-10-14. Desk research only: nothing here has been tested on a real VALORANT
install. VALORANT runs only through the Riot Client, which needs a Riot account login.
There is no offline, guest or anonymous play.

## Where settings live

| Setting | Where | Notes |
|---|---|---|
| Sensitivity (hipfire, scoped), crosshair profiles, keybinds, HUD, minimap, audio, most gameplay options | Riot account, on Riot's player-preferences service | Local copy is only a cache (see below) |
| Local cache of the above | `%LOCALAPPDATA%\VALORANT\Saved\Config\<puuid>-<region>\Windows\RiotUserSettings.ini` plus `BackupKeybinds.json` in the same tree | INI keys like `EAresFloatSettingName::MouseSensitivity=0.400000` |
| Resolution, window mode, graphics quality, letterbox/stretch | `%LOCALAPPDATA%\VALORANT\Saved\Config\<puuid>-<region>\Windows\GameUserSettings.ini` | Unreal `GameUserSettings` format (`ResolutionSizeX`, `ResolutionSizeY`, `FullscreenMode`, ...); stays on the PC |
| Agents, skins, rank | Riot account, server side | n/a |

- The config folder name is the account's PUUID plus region (for example `...-ap`), so
  it only exists after that account has logged in on this Windows user once. Exact
  folder layout is from community tools and guides; verify on a 2026 build.
- Riot's own account said in 2021 that all settings go to the cloud except video
  settings. A community tool (miko, GitHub) documents the current behaviour: the server
  copy replaces the local files at login, so editing `RiotUserSettings.ini` while the game
  is closed has no effect, and making it read-only does not help.
- Some third-party blogs claim crosshair or video stays local. They conflict with each
  other; treat "gameplay settings are account-bound, video is local" as the working
  assumption and confirm it in a real test.

## Can a helper write files and have them stick?

- **Account-bound settings: no.** They are fetched from Riot at login and overwrite the
  cache. The only known workaround (miko) points the player-preferences host to
  `0.0.0.0` in the Windows hosts file so the game falls back to the local cache and
  cannot upload changes. That tampers with Riot traffic, needs admin, relies on
  undocumented behaviour, and would be unacceptable at a tournament. Do not use it.
- **Video settings: probably yes.** `GameUserSettings.ini` in the account's folder is
  local. The station can write resolution, fullscreen mode and letterbox keys before
  launch, the same way it edits `cs2_video.txt` today (unverified in practice).
- **Crosshair share codes: yes, as a manual step.** Since patch 4.05 (March 2022),
  Settings > Crosshair has import/export icons next to Crosshair Profile. A code is a
  semicolon-separated string of key/value pairs (illustrative: `0;P;c;5;h;0;0l;4;0o;2;0a;1;0f;0;1b;0`; check the exact grammar against real exports). The web app
  can generate one and the station can put it on the clipboard, as it does for CS2.
  Up to 15 crosshair profiles per account (third-party source).
- There is no general "settings code" or settings file import in the client (no source
  found for one as of 2026-10).

## Anti-cheat (Riot Vanguard)

- Vanguard is a kernel driver that loads at Windows boot; VALORANT will not start without
  it, and it needs a reboot after install.
- No Riot statement was found about editing config files. Writing
  `GameUserSettings.ini` before launch is the same as changing it in game, and community
  tools do it, but it is unverified as officially allowed.
- Avoid: hosts-file or firewall blocking of Riot services, injecting input, running
  anything while the game is open that touches its memory, and automating the Riot
  Client UI. Tournament rules also forbid unapproved software on admin PCs.

## Sensitivity math

- Yaw: 0.07 degrees per count at sensitivity 1 (KovaaK's lists 0.06996; converters use
  0.07). CS2 uses 0.022.
- CS2 to VALORANT: `val = cs2 * 0.022 / 0.07 = cs2 / 3.1818`. Example: CS2 2.0 at 800 DPI
  becomes 0.629.
- cm/360: `cm360 = 914.4 / (dpi * sens * 0.07)`.
- DPI change: `sens_station = sens_player * dpi_player / dpi_station`.
- VALORANT reads raw input; Windows pointer speed and Enhance Pointer Precision affect
  only the desktop, as with CS2. "Raw Input Buffer" is an in-game toggle (account-bound).
- Scoped sensitivity is a separate multiplier (default 1.0), copied as is.

## Tournaments and LANs today

- Riot events (VCT Challengers 2026 rulebook 9.4): players get Tournament Realm
  accounts from Riot or the operator, and it is "the Players' responsibility to configure
  their account to their preferences". If tournament realms are unavailable, players use
  their own Live account.
- Smaller LANs without tournament realms generally have players log into their own Riot
  accounts (inferred from the Live-account fallback above; EPIC.LAN's ruleset is listed
  in sources but its account wording was not checked). Settings follow the account, so a player's own setup appears automatically.
- Players bring mouse, keyboard, mousepad and IEMs; headsets come from the organiser.
- Riot's terms forbid sharing accounts. Event-owned station Riot accounts are a grey area
  outside official tournament realms (unverified; check with the organiser).

## Verdict: Account-only

Gameplay settings follow the Riot login and are overwritten from the server at login.
Players who log into their own account already have their setup. On a shared station
account the tool can only guide the player through setting values by hand. The station
can still do the local parts.

## Implementation sketch

Profile schema (`games.valorant`):

- `sensitivity` (computed from the shared cm/360 or entered directly),
  `scopedMultiplier`, `dpi`.
- `crosshairCode` (string, validated against the semicolon format), built by a
  VALORANT crosshair builder or pasted.
- `video`: `resX`, `resY`, `fullscreenMode`, `letterbox` (bool for stretched).
- `binds`: list of action/key pairs shown as a checklist only.

Station:

- Snapshot and write `GameUserSettings.ini` in every `<puuid>-<region>\Windows` folder
  in the baseline (resolution, fullscreen mode, letterbox). Restore on reset.
- Set Windows pointer speed and Enhance Pointer Precision, as for CS2.
- Copy the crosshair code to the clipboard and show a full-screen checklist: converted
  sensitivity (to 3 decimals), scoped multiplier, binds that differ from defaults, with
  "Settings > Crosshair > Import" instructions.
- Launch through the Riot Client (`RiotClientServices.exe --launch-product=valorant
  --launch-patchline=live`; unverified on 2026 build). The player or station logs in.

Cannot do: write sensitivity, crosshair, binds, HUD or audio so they stick; log in for the
player; undo changes the player made on a station account (they are saved to that Riot
account). Risks: station-account settings carry over between players unless an admin
resets them in game; GPU scaling still needed for stretched.

## Sources

- miko (cloud is source of truth, cache paths, hosts-file workaround): https://github.com/hoangvu12/miko
- Riot tweet quoted on settings cloud sync (2021): https://x.com/KillerMillerGG/status/1430933415361196034
- `RiotUserSettings.ini` key format: https://github.com/JoShMiQueL/VALORANT-CONFIG/blob/main/RiotUserSettings.ini and https://pastebin.com/Ckw13EUe
- Crosshair import/export (patch 4.05): https://www.sportskeeda.com/valorant/valorant-patch-4-05-official-notes-crosshair-profile-export-import-codes-brimstone-nerfs and https://dotesports.com/valorant/news/how-to-export-and-import-crosshair-settings-in-valorant
- Crosshair code format and profile limit: https://www.valorantcrosshairdb.com/blog/crosshair-codes-guide-2025/
- Yaw values: https://kovaaks.com/kovaaks/sens-converter and https://csdb.gg/sensitivity-converter/valorant-to-cs2/
- VCT Challengers NA 2026 ruleset (9.4 Player Accounts): https://liquipedia.net/commons/images/c/c3/VALORANT_Challengers_North_America_2026_Competition_Ruleset.pdf
- VCT Official Competition Ruleset (peripherals): https://liquipedia.net/commons/images/4/40/VCT_2024_EMEA_Official_Competiton_Rulebook.pdf
- EPIC.LAN VALORANT rules: https://tournaments.epiclan.co.uk/tournaments/epic41-valorant/rules
- Riot Vanguard overview: https://en.wikipedia.org/wiki/Riot_Vanguard
