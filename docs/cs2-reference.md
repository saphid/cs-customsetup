# CS2 reference used by CS Setup

Checked 2026-10-09. Convar facts come from the SteamDatabase CS2 dump at
commit `41efe395` (2026-10-05): `DumpSource2/convars.txt` and `commands.txt`.
Re-check them after a major CS2 update.

## Files on a Windows PC

| Setting | File |
|---|---|
| Sensitivity, crosshair, viewmodel, HUD, audio | `Steam\userdata\<steamid3>\730\local\cfg\cs2_user_convars_0_slot0.vcfg` |
| Key binds | `…\cs2_user_keys_0_slot0.vcfg` |
| Machine settings (video quality) | `…\cs2_machine_convars.vcfg` |
| Resolution, aspect ratio, display mode | `…\cs2_video.txt` (`setting.defaultres`, `setting.defaultresheight`, `setting.aspectratiomode` 0 = 4:3, 1 = 16:9, 2 = 16:10, `setting.fullscreen`, `setting.nowindowborder`) |
| Player cfg files | `steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg\*.cfg` |

Some guides place the per-account files under `730\remote\cfg`; the station
checks both. CS2 rewrites the `.vcfg` files on exit, and Steam Cloud can bring
back older copies, so the station runs its own `cssetup.cfg` after the game's
config with `+exec cssetup`. The console cannot download anything: `exec` only
reads local files.

## Outside the game

- CS2 always uses raw input (`m_rawinput` was removed). Windows pointer speed
  (`MouseSensitivity` 1–20, default 10) and Enhance Pointer Precision
  (`MouseSpeed`/`MouseThreshold1`/`MouseThreshold2` = 1/6/10 on, 0/0/0 off,
  under `HKCU\Control Panel\Mouse`) affect only the desktop. The station applies
  them with `SystemParametersInfo` so they take effect at once.
- Mouse DPI and polling rate live on the mouse.
- Stretched 4:3 needs GPU scaling set to full-screen (NVIDIA Control Panel or
  AMD Software); without it the picture has black bars.

## Convars as of 2026-10-05

| Convar | Range | Default | Note |
|---|---|---|---|
| `sensitivity` | 0.0001–8 | 1.25 | |
| `zoom_sensitivity_ratio` | 0.01–3 | 1 | |
| `m_yaw` | | 0.022 | |
| `cl_crosshairstyle` | 0–9 | 7 | 0 dynamic cross, 1 dynamic circle, 2 dynamic cross (legacy), 3 static circle, 4 static cross, 5 static cross (shot feedback), 6 dot only, 7 dynamic quad, 8 static square, 9 static quad |
| `cl_crosshair_length` | 0–255 | 8 | pixels, scaled with resolution |
| `cl_crosshair_thickness` | 0–32 | 2 | pixels |
| `cl_crosshair_gap` | −3840–3840 | 4 | pixels added to the gap |
| `cl_crosshair_drawoutline` | 0–2 | 1 | none, full, half |
| `cl_crosshaircolor_r/g/b/a` | 0–255 | 0/255/0/255 | |
| `cl_crosshairoutline_r/g/b/a` | 0–255 | 0/0/0/255 | |
| `cl_crosshair_screen_height` | ≥240 | 1080 | hidden; resolution the sizes were authored at |
| `cl_crosshairdot`, `cl_crosshair_t`, `cl_crosshair_recoil` | bool | false, false, true | |
| `viewmodel_fov` | 60–68 | 60 | |
| `viewmodel_offset_x/y/z` | −2–2.5 / −2–2 / −2–2 | 1 / 1 / −1 | |
| `hud_scaling` | 0.9–1.1 | 1 | |
| `cl_hud_color` | 0–12 | 0 | |
| `cl_radar_scale` | 0.25–1 | 0.7 | |
| `cl_hud_radar_scale` | 0.8–1.3 | 1 | |
| `cl_radar_always_centered`, `cl_radar_rotate` | bool | true, true | |
| `volume` | 0–1 | 1 | |
| `fps_max` | | 120 | 0 = no limit |

Gone or hidden since the 2026 crosshair rework: `cl_crosshairgap`,
`cl_crosshaircolor` (preset index), `cl_crosshairusealpha`,
`cl_crosshair_outlinethickness`, `cl_crosshairgap_useweaponvalue`; `cl_crosshairsize`,
`cl_crosshairthickness` and `cl_crosshairalpha` remain only as hidden convars. The
importer converts old sizes at 2.25 pixels per unit (old units were 1/480 of the
screen height, so 1080 / 480).

Commands: `apply_crosshair_code` is flagged `developmentonly`, so a cfg cannot
apply a share code in the release game; players use Settings > Game >
Crosshair > Import. `binddefaults`, `unbindall`, `writekeybindings` and
`host_writeconfig` are release commands. Jumpthrow, snap-tap and null-bind
scripts are blocked on official servers since August 2024.

## Prior art (October 2026)

No existing tool loads a full CS2 setup onto a PC from a short code or QR
code. Closest: CS2 crosshair share codes (crosshair only), CYBERSHOKE Configs
(upload, download by link), config generators (jkit, csdb, totalcsgo,
jumpthrow.gg) that produce a file, and Razer Synapse cloud sync (Razer mouse
settings only). At LAN events players usually bring a USB stick and log into
Steam; in July 2026 a pro reported losing his Steam account after logging
into infected practice PCs at XSE Pro League (Dexerto).

## Verified in real CS2 (2026-10-09, build 25815307, Windows 11 VM)

Profile 679285 loaded by the station (`-MouseDpi 800`), CS2 launched with `+exec cssetup`
after a run that saved sensitivity 3 and viewmodel_fov 61. CS2's own saved config
(`userdata\<id>\730\local\cfg\cs2_user_convars_0_slot0.vcfg`) then held sensitivity 0.45
(0.9 at 400 DPI converted for 800), cl_crosshair_length 5, cl_crosshair_gap -1,
cl_crosshairstyle 4, cl_crosshair_screen_height 1080 and viewmodel 60/1/1/-1, and
`cs2_user_keys_0_slot0.vcfg` held only `f = slot7` and `MWHEELDOWN = +jump` after
`binddefaults`. So `+exec` runs after the saved config and wins, and both `autoexec.cfg` and
`+exec` execute (`execing cssetup` appears twice). CS2 converts binds to scan codes
(`bind scancode9 "slot7" // US English key name "f"`). `echo` and convar printouts do not
reach `console.log` with `-condebug`, so the test reads the saved vcfg instead.

**Steam Cloud:** CS2 saves `cs2_user_convars.vcfg` and `cs2_user_keys.vcfg` to the signed-in
account's Steam Cloud as soon as a cfg changes settings, and Steam uploads them. On a station
account this brings the last player's settings back after Reset, and on a player's own account
it replaces their cloud settings. Turn Steam Cloud off for CS2 on station accounts
(Steam > CS2 > Properties > General).

Test-rig notes (not product requirements): the VM has no GPU. Windows' WARP crashes in
`d3d10warp.dll`; `-vulkan` finds no adapter. DXVK 3.1.1 (`d3d11.dll`, `dxgi.dll` in
`game\bin\win64`) over Mesa lavapipe works with 14 GB RAM, launched with `-insecure`
(VAC off) and `-allow_third_party_software`. A SteamCMD install also needs the Visual C++
2015-2022 x64 runtime, which Steam normally installs on first launch.
