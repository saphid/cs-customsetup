# Loadout

Build your game setup on your phone, get a 6-digit code, type it at any
tournament PC, play. Made for LAN events, gaming conventions and cafés where
players sit down at shared machines and don't want to log into their own
accounts or carry a USB stick.

**How it works**

1. **Phone:** the player builds their setup in the web app (or imports their
   existing config) and saves it. They get a 6-digit code and a QR code.
2. **Station:** on the tournament PC, a small Windows helper (no install) asks
   for the code. It saves the PC's original state, writes the player's game
   settings, sets the Windows mouse and display, converts sensitivity to the
   station mouse's DPI so aim feels the same, and launches the game.
3. **Reset:** when the player is done, one button puts the PC back exactly as it
   was.

## Supported games

| Game | Status |
|---|---|
| Counter-Strike 2 | **Supported**: sensitivity, crosshair, viewmodel, binds, video, HUD, radar, audio; verified in the real game ([details](docs/games/counter-strike-2.md)) |
| Apex Legends, Dota 2, Deadlock | Planned: local config files, same approach as CS2 |
| Rainbow Six Siege, League of Legends, Fortnite, Call of Duty, Rocket League, Marvel Rivals, Street Fighter 6, Tekken 8 | Researched: partial (video and some settings; the rest on a converted checklist) |
| Valorant, Overwatch 2 | Researched: settings follow the player's account; video and a checklist only |

Research for each game and the roadmap: [docs/games](docs/games/README.md) and
[issue #1](https://github.com/saphid/loadout/issues/1). Contributions for new
games are welcome.

## What's in the repo

- **Web app** (`web/`, mobile-first): builds the profile. For CS2: sensitivity
  and DPI (live eDPI and cm/360), crosshair builder with preview and optional
  share code, viewmodel, binds, video (resolution, aspect ratio, stretched),
  HUD, radar, audio, extra console commands, and import from an existing
  autoexec or vcfg. Saving gives a 6-digit code, a QR code and a config file
  download. A private edit key stays on the device that created the profile.
- **Server** (`server/`, Node 22.13+, SQLite built in): profile API,
  validation, config generation, QR codes, and the station script with the
  server address filled in.
- **Station** (`station/Loadout.ps1`, Windows PowerShell 5.1, no install): the
  full-screen window on each PC. Every load starts from the station's original
  state, and a failed load rolls back.

## Quick start

You need one machine on the event network to run the server, and the
tournament PCs (Windows 10/11) for the station.

**1. Start the server** (any machine with Docker):

```sh
docker run -d --name loadout -p 8080:8080 -v loadout:/data --restart unless-stopped ghcr.io/saphid/loadout
```

The image runs on x86-64 and ARM64 (including Raspberry Pi 4/5 with a 64-bit OS). Or without Docker (Node 22.13+): `git clone https://github.com/saphid/loadout && cd loadout && npx pnpm install && npx pnpm start`
(listens on port 8787).

**2. Players** open `http://<server>:8080` on their phone, build their setup and
save. They get a 6-digit code and a QR code. Put that address (or a QR code
for it) on a sign at the registration desk.

**3. Each tournament PC:** open `http://<server>:8080/#/station`, download
**Loadout.cmd**, set the station mouse DPI once, and start it:

```bat
Loadout.cmd -MouseDpi 800
```

Players type their code and press Launch CS2. **Done playing — reset this PC**
puts the PC back. Before the event, also turn Steam Cloud off for CS2 on the
station Steam accounts (see Counter-Strike 2 below).

For an internet-facing server, put it behind HTTPS and set `PUBLIC_URL`
(see compose.yaml).

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 8787 (8080 in Docker) | HTTP port |
| `HOST` | 0.0.0.0 | Listen address |
| `DB_FILE` | `data/profiles.db` (`/data/profiles.db` in Docker) | SQLite database |
| `SIGNING_KEY_FILE` | `signing-key.pem` next to the database | Private key that signs the station script and every setup; created on first start. Keep it with the database: a new key means every PC must download Loadout.cmd again. |
| `PUBLIC_URL` | the request's address | Base URL in QR codes and the station script. Pages opened as `localhost` hand out this machine's LAN address instead. |
| `TRUST_PROXY=1` | off | Behind a reverse proxy: take the client address from the last `X-Forwarded-For` entry (the one your proxy adds) |
| `CREATE_LIMIT` | 60 | New setups per client per minute |
| `READ_LIMIT` | 600 | Setup reads per client per minute (stations behind one NAT share this) |
| `MAX_PROFILES` | 100000 | Stop accepting new setups beyond this many |
| `PROFILE_TTL_DAYS` | off | Delete setups neither saved nor loaded for this many days |

### Security model

- Codes are public read-only identifiers: anyone with a code can view or copy
  that setup (players are told before they add their name). Editing and
  deleting need the private edit link, which stays on the player's device.
- Everything a station runs or applies is signed. The server creates an RSA key
  on first start, bakes the public key into `Loadout.cmd` and `Loadout.ps1`,
  and signs the station script and every setup bundle. A response altered on
  the way (for example plain HTTP on a venue network) fails verification and is
  not applied. Trust starts when an admin downloads `Loadout.cmd`, so do that
  from a trusted network or over HTTPS, and compare the key fingerprint on the
  admin page, in the server log and in the Loadout window.
- Settings are checked against an allowlist generated from CS2's convar list.
  Binds may hold one action and may not release actions, which blocks
  jumpthrow, snap-tap and null-bind scripts.

## Development

```sh
pnpm install
pnpm start                      # http://localhost:8787
CI=true pnpm test
```

Windows end-to-end test of the station (any Windows 10/11 PC with Node; no CS2
needed; it keeps its own state folder and puts the PC's mouse settings back;
CI runs it on every push):

```powershell
pnpm install
powershell -ExecutionPolicy Bypass -File tests\windows\ci-e2e.ps1
```

See `tests/windows/guest-e2e.ps1` for the two profiles it expects, and
`tests/windows/guest-real-cs2.ps1` for the check against the real game.

## Counter-Strike 2

What the station does for CS2: writes `game\csgo\cfg\cssetup.cfg` (starting
from CS2's default binds), adds `exec cssetup` to `autoexec.cfg`, sets
resolution and aspect ratio in each Steam account's `cs2_video.txt`, sets the
Windows pointer speed and Enhance Pointer Precision, and launches CS2 with
`+exec cssetup`. A crosshair share code goes to the clipboard for CS2's Import
button (`apply_crosshair_code` is development-only in release CS2). File
locations, convar ranges, prior art and the real-game verification are in
[docs/games/counter-strike-2.md](docs/games/counter-strike-2.md).

### Station commands

`Loadout.cmd` (from `/station.cmd`) downloads the latest signed `Loadout.ps1`
on every start, keeps the last verified copy if the server is unreachable, and
passes its arguments through:

```bat
Loadout.cmd                          :: full-screen window
Loadout.cmd -MouseDpi 800            :: once per PC: the station mouse's DPI (remembered)
Loadout.cmd -ConfirmCloudOff         :: record that Steam Cloud is off for CS2
Loadout.cmd -Check                   :: readiness report (exit code 2 when not ready)
Loadout.cmd -Code 123456 -Launch     :: load a setup and start CS2
Loadout.cmd -Reset                   :: restore the station
Loadout.cmd -SaveBaseline            :: capture this PC (CS2 run once) before players
Loadout.cmd -Prefetch codes.txt      :: cache setups so they load during a server outage
```

The first load (or `-SaveBaseline`) saves a baseline in
`%LOCALAPPDATA%\CSSetup\baseline`: the original `autoexec.cfg`, every file in
the Steam accounts' CS2 cfg folders, and the Windows mouse settings. Every
load starts from it; files and account folders that appear later belong to a
player and are removed. Only one Loadout window or command runs at a time on a
PC. Every setup a PC loads is cached there, signed, so it loads again while the
server is down.

### Notes

- The CS2 console cannot download anything; `exec` only reads local files.
  A local helper has to write the cfg.
- CS2 rewrites its `.vcfg` files on exit and Steam Cloud can restore old ones.
  The station therefore writes a separate `cssetup.cfg` and runs it after the
  game's own config with `+exec`, so the player's settings always win.
- CS2 always uses raw input. Windows pointer settings affect only the desktop,
  but players still expect them.
- Steam Cloud: CS2 uploads its settings to the signed-in account's Steam Cloud as soon as
  the cfg runs (verified in real CS2). Turn Steam Cloud off for CS2 on every station account
  (Steam > CS2 > Properties > General), or a reset PC gets the last player's settings back
  from the cloud.
- Event mice: set every station mouse to one DPI and pass `-MouseDpi` once.
  The server converts each player's sensitivity so their eDPI (and cm/360)
  stays identical; CS2's raw input makes this exact. Keyboards with Speed Tap
  / SOCD (ROG Falchion Ace HFX, ROG Strix Scope II) must have it off; the
  station cannot see keyboard settings.
- Not possible from the station: mouse DPI and polling rate (stored on the
  mouse) and GPU scaling for stretched 4:3 (NVIDIA or AMD control panel).
- Jumpthrow, snap-tap and null-bind scripts are blocked on official servers
  and at most tournaments, so the bind presets leave them out.

## License

MIT
