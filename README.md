# CS Setup

Build your Counter-Strike 2 setup on your phone, get a 6-digit code, type it
at any tournament PC, play. Made for LAN events and gaming conventions where
players sit down at shared machines.

- **Web app** (`web/`, mobile-first): sensitivity and DPI (live eDPI and
  cm/360), crosshair builder with preview plus an optional CS2 share code, viewmodel,
  binds, video (resolution, aspect ratio, stretched), HUD, radar, audio, extra
  console commands. Paste an existing autoexec or vcfg to import it. Saving
  gives a 6-digit code, a QR code linking to the profile, and a `.cfg`
  download. A private edit key stays on the device that created the profile.
- **Server** (`server/`, Node 22.13+, SQLite built in): profile API,
  validation, cfg generation, QR codes, and the station script with the
  server address filled in.
- **Station** (`station/CSSetup.ps1`, Windows PowerShell 5.1, no install):
  a full-screen window where the player types a code. It writes
  `game\csgo\cfg\cssetup.cfg`, adds `exec cssetup` to `autoexec.cfg`, sets
  resolution and aspect ratio in each account's `cs2_video.txt`, sets the
  Windows pointer speed and Enhance Pointer Precision, and launches CS2 with
  `+exec cssetup`. A crosshair share code goes to the clipboard for CS2's
  Import button (`apply_crosshair_code` is development-only in release CS2).
  Every load starts from the station's original state, and a failed load
  rolls back. **Done playing — reset this PC** restores the original files and
  mouse settings.

## Quick start

You need one machine on the event network to run the server, and the
tournament PCs (Windows 10/11) for the station.

**1. Start the server** (any machine with Docker):

```sh
docker run -d --name cssetup -p 8080:8080 -v cssetup:/data --restart unless-stopped ghcr.io/saphid/cs-customsetup
```

The image runs on x86-64 and ARM64 (including Raspberry Pi 4/5 with a 64-bit OS). Or without Docker (Node 22.13+): `git clone https://github.com/saphid/cs-customsetup && cd cs-customsetup && npx pnpm install && npx pnpm start`
(listens on port 8787).

**2. Players** open `http://<server>:8080` on their phone, build their setup and
save. They get a 6-digit code and a QR code. Put that address (or a QR code
for it) on a sign at the registration desk.

**3. Each tournament PC:** open `http://<server>:8080/#/station`, download
**CSSetup.cmd**, set the station mouse DPI once, and start it:

```bat
CSSetup.cmd -MouseDpi 800
```

Players type their code and press Launch CS2. **Done playing — reset this PC**
puts the PC back. Before the event, also turn Steam Cloud off for CS2 on the
station Steam accounts (see Design notes).

For an internet-facing server, put it behind HTTPS and set `PUBLIC_URL`
(see compose.yaml).

## Configuration

Environment: `PORT` (8787; 8080 in the Docker image), `HOST` (0.0.0.0),
`DB_FILE` (`data/profiles.db`; `/data/profiles.db` in Docker), `PUBLIC_URL`
(base URL in QR codes and the station script; defaults to the request's Host
header), `TRUST_PROXY=1` (take the client address from `X-Forwarded-For` behind
a reverse proxy), `CREATE_LIMIT` (new profiles per client per minute, default
60).

## Development

```sh
pnpm install
pnpm start                      # http://localhost:8787
CI=true pnpm test
```

Windows end-to-end test of the station (any Windows 10/11 PC with Node; no CS2
needed; CI runs it on every push):

```powershell
pnpm install
powershell -ExecutionPolicy Bypass -File tests\windows\ci-e2e.ps1
```

See `tests/windows/guest-e2e.ps1` for the two profiles it expects, and
`tests/windows/guest-real-cs2.ps1` for the check against the real game.

## Station

`CSSetup.cmd` (from `/station.cmd`) downloads the latest `CSSetup.ps1` on every start and passes
its arguments through. The script can also be used directly:

```powershell
powershell -ExecutionPolicy Bypass -Command "irm http://<server>/station.ps1 -OutFile CSSetup.ps1; .\CSSetup.ps1"
.\CSSetup.ps1 -MouseDpi 800        # once per PC: station mouse DPI (remembered)
.\CSSetup.ps1                      # full-screen window
.\CSSetup.ps1 -Code 123456 -Launch # load and start CS2
.\CSSetup.ps1 -Reset               # restore the station
.\CSSetup.ps1 -SaveBaseline        # admin: capture this PC (CS2 run once) before players
```

The first load (or `-SaveBaseline`) saves a baseline in
`%LOCALAPPDATA%\CSSetup\baseline`: the original `autoexec.cfg`, every file in
the Steam accounts' CS2 cfg folders, and the Windows mouse settings. Every
load starts from it; files and account folders that appear later belong to a
player and are removed. Prepare each PC by running CS2 once before the first
player, so its video file is part of the baseline.

## Other games

Research on bringing the same idea to other games is in [docs/games](docs/games/).

## Design notes

CS2 file locations, current convar ranges and prior art are in
[docs/cs2-reference.md](docs/cs2-reference.md).

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
- Codes are public read-only identifiers; anyone with a code can load or copy
  it, as with crosshair share codes. Editing needs the edit key.

## License

MIT
