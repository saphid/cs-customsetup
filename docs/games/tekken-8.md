# Tekken 8 — station feasibility

Checked 2026-10-14. Steam app ID 1778820, Unreal Engine 5. "Unverified" means
one community source or an inference, not tested on a real install.

## Verdict: Partial

- **Can apply:** video settings in `GameUserSettings.ini` (plain-text UE
  INI), the cross-game layer, and snapshot/restore of the save folder for
  the station's Steam account.
- **Cannot apply reliably:** button mapping, the three controller presets,
  Special Style and the training/input-display options. They are in `.sav`
  files under a SteamID64 folder. The format is undocumented and no public
  editor was found.
- **Practical answer:** a button card plus a manual check, the same as SF6.
  Tekken has fewer buttons (1/2/3/4 plus combinations such as 1+2 and
  Heat/Rage Art shortcuts), so copying a layout by hand is quick.

## Where settings live

| Setting | Location | Format | Notes |
|---|---|---|---|
| Video: resolution, window mode, frame limit, quality | `%LOCALAPPDATA%\TEKKEN 8\Saved\Config\Windows\GameUserSettings.ini` | UE INI text | PCGamingWiki and Steam forum. Standard UE keys (`ResolutionSizeX/Y`, `FullscreenMode`, `FrameRateLimit`, `sg.*`) are expected; Tekken-specific keys unverified |
| Engine tweaks | `…\Config\Windows\Engine.ini` | UE INI | Community fixes (AI upscaling, smoothing). Not for tournament use |
| Progress, and very likely button mapping and options | `%LOCALAPPDATA%\TEKKEN 8\Saved\SaveGames\<SteamID64>\*.sav` | Binary `.sav` | Folder per SteamID64 (community guides). Steam Cloud enabled. That mapping is in the save is **unverified** |
| Online (rank, Tekken ID, player data) | Bandai Namco servers | — | Account-only |

Note: the save folder is in `%LOCALAPPDATA%`, which belongs to the Windows
user, not to Steam's `userdata`. On a shared station the Windows user stays
the same while the Steam account can change, so each Steam account has its
own subfolder. Steam Cloud still syncs it. Several players report Steam Cloud
restoring corrupted saves.

The game runs at 60 FPS; above that needs third-party TekkenOverlay, which is
not for tournaments. Keyboard: two rebindable presets. Controller: three
preset types plus a fully custom layout (PCGamingWiki).

## Can a helper write them?

- `GameUserSettings.ini`: yes. Back it up, set resolution, window mode and
  quality, and restore after. UE may rewrite the file on exit, so write it
  before launch and restore it only after the game has closed.
- `.sav` files: copy-only, as with SF6. Snapshot and restore the station
  account's SteamID64 folder. Writing a layout needs the save format, which
  is undocumented. UE saves are often GVAS-serialised, sometimes encrypted;
  not checked for Tekken 8.
- Steam Cloud: turn it off for Tekken 8 on station accounts, or the reset
  will be undone.

## How majors handle it

- **Evo (USA 2025, France 2026):** PlayStation 5, bring your own controller,
  "Tournament Mode Default Settings". Tekken World Tour rules take precedence.
- **TWT and TWT-rule events:** button checks happen before the match starts.
  Starting the match counts as accepting your mapping. Players are
  responsible for their own controller and assigned buttons; a mid-match
  problem means playing on or forfeiting the game. Rules on in-game macro
  mappings and Special Style differ between events (some allow them, some
  ban macros).
- **Takeaway:** same as SF6. Mapping is done by hand at the console every
  set. No major loads a per-player profile.

## Implementation sketch

1. **Profile (web):** device type, mapping for 1/2/3/4 and the combination
   slots, Special Style on or off, keyboard preset choice, and video
   preferences (resolution, display mode).
2. **Station:** baseline `GameUserSettings.ini` and
   `SaveGames\<SteamID64>\` for each station account. Apply the cross-game
   layer, write the INI values, launch `steam://rungameid/1778820`, and show
   the button card.
3. **Reset:** restore the INI and the save folder after the game exits.
4. **Experimental:** preset station saves (see SF6), unverified.

## Guilty Gear Strive and 2XKO (brief)

- **Guilty Gear Strive (UE4, Steam):** config
  `%LOCALAPPDATA%\GGST\Saved\Config\WindowsNoEditor\` (INI, writable). Saves,
  including button settings (likely, unverified), in
  `%LOCALAPPDATA%\GGST\Saved\SaveGames\<uid>\`. Steam Cloud enabled.
  Battle and menu buttons can both be remapped. Verdict **Partial**, same
  pattern as Tekken 8. Evo France 2026: PS5 BYOC, default settings.
- **2XKO (Riot, UE):** config `%LOCALAPPDATA%\Lion\Saved\Config`. Riot
  Vanguard anti-cheat, Riot account required. A station helper must not
  touch game files under kernel anti-cheat beyond what Riot allows.
  Verdict **Account-only**: the player logs in or sets things by hand.
  Whether settings sync server-side with the Riot account is unverified.
  Evo France 2026: PS5 BYOC, default settings.

## Open questions

- Which `.sav` holds key config. Is it encrypted. Does it load after a copy
  to another PC on the same Steam account.
- Exact Tekken-specific keys in `GameUserSettings.ini`.

## Sources

- PCGamingWiki, Tekken 8 (config/save paths, Steam Cloud, input, FPS): https://www.pcgamingwiki.com/wiki/Tekken_8
- Steam forum, config/save location: https://steamcommunity.com/app/1778820/discussions/0/4147320059827794538/
- Save location and Steam Cloud corruption reports: https://steamcommunity.com/app/1778820/discussions/0/4147320315760705114
- SteamID64 subfolder: https://www.minitool.com/news/tekken-8-save-file-location.html and https://www.easeus.com/computer-instruction/takken-8-save-file-location.html
- Remapping and Special Style: https://www.ggrecon.com/guides/tekken-8-special-style-how-to-turn-off/
- Evo France 2026 rules (T8, GGST, 2XKO): https://evo.gg/events/2026-france/
- Evo USA 2025: https://evo.gg/events/usa2025
- TWT-rule events (button check before match, player responsibility, macros): https://www.start.gg/tournament/cape-town-showdown-2025/event/tekken-8-double-elimination/overview/rules, https://www.start.gg/tournament/igm-winter-showdown-2025/event/tekken-8/overview/rules, https://www.start.gg/tournament/chains-of-fate-monthly-8-happy-new-year-2025/event/tekken-8-ps5-twt-2024-rules/overview/rules
- PCGamingWiki, Guilty Gear Strive: https://www.pcgamingwiki.com/wiki/Guilty_Gear_Strive
- PCGamingWiki, 2XKO: https://www.pcgamingwiki.com/wiki/2XKO
