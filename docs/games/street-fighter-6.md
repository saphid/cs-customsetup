# Street Fighter 6 — station feasibility

Checked 2026-10-14. Steam app ID 1364780. "Unverified" means the fact came
from one community source, or was inferred and not tested on a real install.

## Verdict: Partial

- **Can apply:** Windows mouse/display/audio (cross-game layer), the
  `config.ini` graphics values, and a per-station snapshot/restore of the save
  folder, so every player starts from the station's clean state.
- **Cannot apply reliably:** button mapping, control type (Classic/Modern),
  input display and training options. These live in the binary save data,
  which is bound to the Steam account. No public SF6 save format or editor
  was found.
- **Practical answer:** show the player's layout as a "button card" on the
  phone and the station screen, then have the player set it in the in-game
  Controls menu. This is what majors do today.

## Where settings live

| Setting | Location | Format | Notes |
|---|---|---|---|
| Graphics (render scale etc.) | `<game>\config.ini` (install folder) | INI text | PCGamingWiki. Community guides edit `[RenderConfig] ImageQualityRate` (0.5–2). Other keys unverified; may change with patches |
| Save data: progress plus, very likely, controls and options | `Steam\userdata\<steamid3>\1364780\remote\win64_save\` | Binary (RE Engine) | PCGamingWiki. Steam Cloud enabled. That controls are stored here is **unverified** but likely: there is no other local settings file |
| Online data (rank, avatar, currency, unlocks) | Capcom ID / Buckler (server) | — | Tied to the Capcom ID linked to the Steam account. Per platform, no cross-platform transfer |
| Display mode / resolution | In-game Graphics menu (no true exclusive fullscreen per esports.gg; borderless recommended) | — | Unverified whether the value sits in `config.ini` or in the save |

Controls are kept per control type (Classic, Modern, Dynamic). Keyboard
bindings are edited from the Controls screen with `R` (PCGamingWiki). The
Controls menu can be opened for each player side and from character select,
so a player can fix their buttons without leaving the match flow.

## Can a helper write them?

- `config.ini`: yes. It is plain text in the install folder, not in Steam
  Cloud. Use the same baseline/restore pattern as the CS2 station.
- Save folder: copy-only. The helper can snapshot and restore the whole
  `win64_save` folder for the **station's** Steam account. It cannot write a
  player's layout into it, because the format is undocumented. RE Engine
  saves for other Capcom titles are known to be encrypted per Steam account
  (not verified for SF6).
- Moving a player's own save from their account to a station account is
  expected to fail, or to break the player's account. Do not attempt it.
- Steam Cloud: the save is cloud-synced, so the CS2 lesson applies directly.
  Turn Steam Cloud off for SF6 on every station account. Otherwise the last
  player's layout comes back from the cloud after a reset.

## How majors handle button configs today

- **Evo (USA 2025, France 2026, Japan):** PlayStation 5, bring your own
  controller. Default settings except "Pause menu on long hold: ON" and
  "Input delay reduction: ON". Dynamic control type banned. The winner keeps
  their character and control type; the loser may change both.
- **Capcom Pro Tour / local CPT-rule events:** custom mappings in the game's
  control settings are allowed. A "button check" happens in the Controls
  sub-menu before the match (usually one per match). Starting the game counts
  as accepting your mapping. Macros and turbo are banned. At most 10 attack
  buttons may be mapped, and one physical button may not be bound to several
  inputs except through the game's own menu.
- **SOCD:** CPT and Evo Japan require that Up+Down is either both held or both
  rejected. Many rulesets also require Left+Right = Neutral for all-button
  controllers. Last-input-priority modes (ROG "Speed Tap", snap-tap) are
  **not** neutral and may be illegal on keyboards at Capcom-rule events.
  Check each event's rules.
- **Takeaway:** at fighting-game majors, players set buttons by hand on a
  console every match, from memory, in under a minute. Nobody loads them from
  a profile. The value a helper adds is the cross-game layer plus a clear
  button card and a guaranteed clean reset, not a file write.

## Implementation sketch

1. **Profile fields (web):** control type (Classic/Modern), per-button
   layout for pad, stick/leverless or keyboard (Light/Medium/Heavy
   Punch/Kick, Drive Parry, Drive Impact, Throw, Assist for Modern), the
   player's own input-display and training preferences (informational), and
   SOCD expectation for keyboards.
2. **Station, before launch:** baseline `config.ini` and
   `userdata\<id>\1364780\remote\win64_save\` for each station account. Apply
   the cross-game layer (mouse, display, audio, peripherals), write allowed
   `config.ini` values, and launch with `steam://rungameid/1364780`.
3. **Button card:** full-screen station page and phone view, drawn like the
   in-game Controls grid for the chosen control type and device. The player
   copies it in the Controls menu. Optional: an AutoHotkey-style macro that
   navigates the menu was considered and rejected. It is fragile, and it is
   input automation, which can conflict with tournament rules.
4. **Reset:** restore `config.ini` and the save folder from the baseline
   (Steam not running, Steam Cloud off), restore the cross-game layer.
5. **Experimental (unverified):** event staff record a few preset saves on
   each **station** account (for example "Classic default" and "Modern
   default"). The helper swaps in the closest preset before launch. This only
   works if saves are bound to the account and not to the machine. Test first.

## Open questions to test on a real install

- Which file in `win64_save` holds controls. Is it encrypted. Does a copy
  between two PCs on the same Steam account load.
- Whether resolution and display mode are in `config.ini`.
- Whether SF6 can start offline (no Capcom ID link) for local Versus at a LAN
  without internet.

## Sources

- PCGamingWiki, Street Fighter 6 (config/save paths, Steam Cloud, remap notes): https://www.pcgamingwiki.com/wiki/Street_Fighter_6
- Render scale in `config.ini`: https://gamepretty.com/street-fighter-6-how-to-boost-your-resolution-scale-to-200/
- Display mode note: https://esports.gg/news/street-fighter-6/how-to-change-the-resolution-to-full-screen-in-street-fighter-6-on-pc
- Capcom ID-linked progress (forum): https://steamcommunity.com/app/1364780/discussions/0/3940146862837156259
- Cross-progression: https://www.wepc.com/gaming/street-fighter-6-cross-progression/
- Evo France 2026 rules: https://evo.gg/events/2026-france/
- Evo USA 2025: https://evo.gg/events/usa2025
- Evo Japan SF6 rules (SOCD, control type): https://evojapan.gg/en/rules/sf6
- CEO SF6 rules (winner keeps control type): https://ceogaming.org/tournament/sf6/
- CPT-derived ruleset (button check, 10 attack buttons, SOCD): https://www.start.gg/tournament/first-attack-2025/event/street-fighter-6/overview/rules
- Button check in the Controls sub-menu: https://www.start.gg/tournament/norwich-knockout-4-oll-26/event/street-fighter-6/overview/rules
- Capcom SOCD rule: https://eventhubs.com/news/2023/mar/30/capcom-prohibit-leverless-controllers-rule
- Local Tournament Mode Settings (Mai update): https://automaton-media.com/en/news/street-fighter-6s-mai-update-improves-match-replays-adds-match-restore-feature-to-custom-room-and-new-local-tournament-mode-settings/
