# Rocket League reference for a Loadout-style station

Checked 2026-10-14. Rocket League ships on the Epic Games Store (Epic app name
`Sugar`). Players who owned the Steam version before the 2020 free-to-play
switch keep it, but it also needs a linked Epic account. Easy Anti-Cheat (EAC)
has been on PC since 2026-04-28. Anything marked "(unverified)" was not
confirmed against a live game.

## Where settings live (Windows)

`<Docs>` = `%USERPROFILE%\Documents\My Games\Rocket League\TAGame` (or a
redirected Documents folder).

| Setting | Location | Format |
|---|---|---|
| Resolution, fullscreen/borderless, vsync, quality toggles (`ResX`, `ResY`, `Fullscreen`, `Borderless`, `UseVsync`, `MotionBlur`, `Bloom`, ...) | `<Docs>\Config\TASystemSettings.ini`, `[SystemSettings]` | Plain INI, per PC |
| Copy of the video settings | `VideoSettingsSavePC_TA` object in the account save | Encrypted binary |
| Default and preset bindings | `<Docs>\Config\TAInput.ini` | Plain INI. The bindings the game actually uses are not here |
| Camera: FOV, distance, height, angle (pitch), stiffness, swivel speed, transition speed, camera shake, ball camera on by default | `ProfileCameraSave_TA` in the account save | Encrypted binary |
| Controller deadzone, dodge deadzone, steering and aerial sensitivity, controller bindings | `ProfileGamepadSave_TA` (plus `ProfileControlsSave_TA`) | Encrypted binary |
| Keyboard and mouse bindings | `ProfilePCSave_TA` | Encrypted binary |
| Audio volumes (master, gameplay, music, ambient, crowd), voice | `SoundSettingsSave_TA`, `MusicPlayerSave_TA`, `EOSVoiceSettingsSave_TA` | Encrypted binary |
| Gameplay, HUD/interface, quick chat | `GameplaySettingsSave_TA`, `ProfileGameplaySave_TA`, `ProfileQuickChatSave_TA` | Encrypted binary |
| Controller vibration, ball camera toggle/hold mode | Account save; exact object not found (unverified) | Encrypted binary |
| Replays, unsent training packs | `<Docs>\Demos`, `<Docs>\Training` (unverified) | Local only |

Account saves: Epic accounts use `<Docs>\SaveDataEpic\DBE_Production\<epic id>[_N].save`;
Steam accounts use `<Docs>\SaveData\DBE_Production\<steamid64>[_N].save`. Older guides
call them `.bin` files; current saves use `.save`.

Save format (from community codecs, not official): `u32 length | u32 CRC32 | AES-256-ECB
ciphertext`, using a fixed key that is public in community tools. Inside is an Unreal Engine 3
save (`0xF005BA11` magic) with typed objects. Community tools parse and rebuild all 38 saves on
a test PC byte-for-byte, and can edit camera, controller and audio values or copy whole
settings objects between accounts.

Camera and controller ranges:

| Setting | Range | Note |
|---|---|---|
| Camera FOV | 60 to 110 | |
| Camera distance | 100 to 400 | |
| Camera height | 40 to 200 | |
| Camera angle (pitch) | -15 to 0 | |
| Camera stiffness | 0 to 1 | |
| Swivel speed | 1 to 10 | |
| Transition speed | 1 to 2 | |
| Controller deadzone | 0 to 0.75 | Liquipedia; common default 0.20 (unverified) |
| Dodge deadzone | 0.10 to 1.00 | |
| Steering / aerial sensitivity | 1.00 to 10.00 | Liquipedia gives 1.00 as the minimum; the community codec allows 0.1 |

## Sync, accounts and whether pre-launch writes stick

- Since the Season 3 cross-progression update, settings, presets and stats live on the
  account and sync through the EOS cloud to all linked platforms. Only video settings,
  replays and unsent training packs are local. A local save edit competes with the cloud copy:
  community tools report that the game keeps the copy with the higher save tick, so whether
  an edited save survives launch is unverified. Their own README warns that cloud sync can
  replace local edits.
- Settings belong to an Epic account, not to the PC. Without the player's login there is no
  player save. The only route is to edit the station account's save before launch.
- Launching `RocketLeague.exe` without launcher arguments started with no Epic account
  (`Unknown|0|0` in `Launch.log`). Whether that offline session still loads a local save is
  unverified. Steam installs need a linked Epic account (stricter since v2.48, January 2025).
- `TASystemSettings.ini` is the documented local file. Epic support tells players to clear its
  Read-Only flag when settings fail to save, so the game rewrites it. Setting the flag after
  writing is a known workaround for keeping it fixed. Whether the game re-applies the save's
  `VideoSettingsSavePC_TA` over the INI is unverified.
- No in-game share code or import exists for camera or controller settings. Presets in the
  game are car loadouts. A community tool exports `.rlprofile.json` files of settings objects.

## Anti-cheat and rules

- EAC is required for online play on PC since 2026-04-28. The launcher offers EAC on (online)
  or off. With EAC off, mods such as BakkesMod are allowed for training, offline play, LAN
  matches and replays, but online queues are blocked. With EAC on, mods do not run.
  BakkesMod announced its end but continues with Psyonix support for non-EAC mode only.
- No source says that editing INI files or saves with the game closed triggers EAC. EAC
  watches the running process (unverified for save edits).
- RLCS 2026 rules forbid "modifying the intended behavior of the Rocket League game client,
  including but not limited to making changes to game files" and any modification not
  disclosed to and approved by the tournament admins. Changing settings values arguably is not
  a behavior change, but an organiser should approve save editing before using it in a
  sanctioned event.

## Controllers and mouse

- Most players use a controller. What carries over: in-game bindings, deadzones,
  sensitivities, camera and vibration, all in the account save. What does not: paddles or
  remaps in the controller's own firmware or software (they move with the controller), Steam
  Input per-game layouts (stored under Steam `userdata` for that Steam account, Steam
  version only), and DS4Windows or vendor software on the player's own PC.
- PlayStation and Xbox controllers are supported natively (unverified for DualSense edge
  features). A station should not run DS4Windows or Steam Input remaps by default, because they
  change what the game's bindings mean.
- RLCS 2026 rules: wired controllers only at in-person events, no macros or turbo, and admins
  approve every controller.
- Keyboard and mouse: Rocket League has no aim sensitivity like CS2's `sensitivity` and
  `m_yaw 0.022`. The mouse is a steering or camera axis, scaled by steering and aerial
  sensitivity (unverified for mouse). The CS2 DPI/eDPI/cm-per-360 conversion does not apply.
  At most the station can keep the player's mouse DPI and Windows pointer speed for menus.

## How events handle it today

- RLCS: each player competes on their own registered Epic account. Only one player may use an
  account, and playing on another person's account is a violation. Players bring their own
  wired controllers and set up their own settings by signing in. The rules require no
  particular station setup.
- Community LANs: players usually sign in to their own Epic account on the venue PC, or enter
  their camera numbers by hand in Settings. Typing the about 12 camera and controller numbers
  takes a minute or two (unverified; no published LAN guide found).

## Feasibility verdict: Partial

Video settings are local INI (like `cs2_video.txt`). Everything players care about (camera,
controller tuning, bindings, audio) is in an encrypted, cloud-synced, per-account save, and
there is no `+exec` equivalent that applies settings after the cloud copy. It works only by
editing the station account's save, which is unofficial, untested against cloud sync and
open to challenge under tournament rules. Alternatively, the player signs in to their own
account, and then nothing needs to be carried over.

## Implementation sketch

Profile schema (`game: "rocket-league"`):

- `camera`: `fov`, `distance`, `height`, `angle`, `stiffness`, `swivelSpeed`,
  `transitionSpeed`, `cameraShake`, `ballCamDefault`, `ballCamMode` (`toggle`/`hold`).
- `controller`: `deadzone`, `dodgeDeadzone`, `steeringSensitivity`, `aerialSensitivity`,
  `vibration`, `bindings` (action to button map, optional).
- `video`: `resX`, `resY`, `displayMode`, `vsync`, `fpsCap`; `audio`: volumes 0 to 1.
- `input`: `controllerType` (informational), `mouseDpi` (for menus only).

Station modes:

1. Guided (default, always safe): the station writes `TASystemSettings.ini` (video), sets
   Windows mouse settings and launches the game. It shows the camera and controller numbers
   on screen and the phone shows the same card, so the player types them into Settings.
   Reset restores the INI from the baseline, and the station account's settings go back to
   the baseline values the same way.
2. Save-apply (opt-in, organiser-approved, experimental): with the game and launcher closed,
   the station backs up the station account's `.save` files to the baseline. It decodes them,
   replaces values in `ProfileCameraSave_TA` and `ProfileGamepadSave_TA` in place, checks the
   CRC, writes the file and launches. After the main menu loads, it confirms that the values
   held (for example by asking the player). If they did not hold, it falls back to Guided.
   Reset writes back the baseline saves.

Cannot do: apply settings to a player's own account without their login; carry Steam Input or
controller-firmware remaps; guarantee that the EOS cloud does not restore the station account's
previous settings.

Risks and mitigations:

- Cloud sync overwrites edits. Use one dedicated station Epic account per PC, never a
  player's. Let the game sync once at the baseline, and test whether a raised save tick
  survives before relying on Save-apply. The equivalent of disabling Steam Cloud is not
  available: settings sync through the account itself (unverified whether an EOS cloud
  toggle exists).
- Rule exposure: get written approval from the tournament admins, and keep Save-apply off
  for RLCS-sanctioned play.
- Format churn: a game update can change save object layouts. Refuse to write when an object
  is missing or its size changes, as the community tools do.
- EAC: write only while the game and EAC are not running. Launch with EAC on for online
  play.

## Sources

- https://www.epicgames.com/help/rocket-league-c-202300000001622/technical-support-c-202300000001679/what-do-i-do-if-rocket-league-doesn-t-save-my-settings-a202300000082700
- https://rocketleaguehelp.epicgames.com/help/en-US/c-Category_RocketLeague/c-RocketLeague_TechnicalSupport/what-rocket-league-information-is-stored-locally-and-what-is-on-the-server-a000084283
- https://rocketleaguehelp.epicgames.com/help/en-US/c-Category_RocketLeague/c-RocketLeague_TechnicalSupport/why-are-my-settings-and-stats-missing-in-rocket-league-a000084366
- https://www.epicgames.com/help/en-US/rocket-league-c5719357623323/basics-c7261959845275/what-are-camera-settings-in-rocket-league-a5720054403995
- https://www.epicgames.com/help/en-US/rocket-league-c5719357623323/basics-c7261959845275/a5720106165787
- https://steamcommunity.com/app/252950/discussions/0/358416640391116410
- https://steamcommunity.com/app/252950/discussions/0/4086396791253170637
- https://www.rocketleague.com/news/easy-anti-cheat-comes-to-rocket-league-on-pc-today
- https://www.gamingonlinux.com/2026/04/rocket-league-adds-easy-anti-cheat-with-steam-deck-linux-still-supported/
- https://www.trophi.ai/post/rocket-league-updates-after-eac-bakkesmod-ballchasing-and-whats-actually-different-now
- https://github.com/DaricHughesJ/rl-account-manager (docs/INTEGRATIONS.md, src/rlam/save_codec.py, save_settings.py, video_settings.py)
- https://github.com/DaricHughesJ/rocket-league-keybind-manager
- https://github.com/KroSheChKa/RLQC (preflight.py)
- https://liquipedia.net/rocketleague/Settings
- https://us-west-2-epicgames.graphassets.com/cm84mjx3f0a0j08n79wol8l1l/cmh9d0nrw07at07obchd59ls4 (RLCS 2026 Official Rules, sections 3.7, 4.1.2, 7)
- https://wiki.rossmanngroup.com/wiki/Epic_Games_forced_third_party_account_creation_in_Rocket_League
