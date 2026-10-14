// Import of pasted configs: autoexec lines, config dumps, CS2's own vcfg files
// ("key" "value" pairs, with key binds in a "bindings" section) and cs2_video.txt.
import { checkCfgLine, checkBindCommand, KEY_NAME, stripComment } from './rules.js';
import { NUMBERS, SHARE_CODE } from './schema.js';

export const getPath = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
export const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => (a[k] ??= {}), o)[last] = v; };

const IMPORT_MAP = {
  sensitivity: 'mouse.sensitivity', zoom_sensitivity_ratio: 'mouse.zoomSensitivity', zoom_sensitivity_ratio_mouse: 'mouse.zoomSensitivity', m_yaw: 'mouse.yaw',
  cl_crosshairstyle: 'crosshair.style', cl_crosshair_length: 'crosshair.length', cl_crosshair_thickness: 'crosshair.thickness',
  cl_crosshair_gap: 'crosshair.gap', cl_crosshair_drawoutline: 'crosshair.outline',
  cl_crosshaircolor_r: 'crosshair.r', cl_crosshaircolor_g: 'crosshair.g', cl_crosshaircolor_b: 'crosshair.b', cl_crosshaircolor_a: 'crosshair.a',
  cl_crosshairalpha: 'crosshair.a', cl_crosshairdot: 'crosshair.dot', cl_crosshair_t: 'crosshair.tStyle', cl_crosshair_recoil: 'crosshair.followRecoil',
  viewmodel_fov: 'viewmodel.fov', viewmodel_offset_x: 'viewmodel.offsetX', viewmodel_offset_y: 'viewmodel.offsetY', viewmodel_offset_z: 'viewmodel.offsetZ',
  hud_scaling: 'hud.scale', cl_hud_color: 'hud.color', cl_radar_scale: 'hud.radarScale', cl_hud_radar_scale: 'hud.radarHudScale',
  cl_radar_always_centered: 'hud.radarCentered', cl_radar_rotate: 'hud.radarRotate', volume: 'audio.volume', fps_max: 'misc.fpsMax', cl_showfps: 'misc.showFps',
  'setting.defaultres': 'video.width', 'setting.defaultresheight': 'video.height',
};
// Before the 2026 crosshair rework, sizes were in 1/480ths of screen height.
const LEGACY_SCALE = { cl_crosshairsize: 'crosshair.length', cl_crosshairthickness: 'crosshair.thickness' };
const LEGACY_COLORS = [[255, 50, 50], [50, 250, 50], [250, 250, 50], [50, 50, 250], [50, 250, 250]];
// Old commands that are harmless but no longer do anything in CS2.
const OBSOLETE = /^(rate|cl_cmdrate|cl_updaterate|cl_interp|cl_interp_ratio|m_rawinput|cl_crosshair_outlinethickness|cl_crosshairusealpha|cl_crosshairgap_useweaponvalue)$/;
const PIXEL_SIZES = ['crosshair.length', 'crosshair.thickness', 'crosshair.gap'];
const NUMBER = /^-?(\d+(\.\d*)?|\.\d+)$/;

// CS2's default keys. A saved keys file lists every key; only the ones that
// differ from these become binds, because the station starts from binddefaults.
// (A default missing here only adds a harmless duplicate bind.)
const DEFAULT_BINDS = {
  w: '+forward', s: '+back', a: '+moveleft', d: '+moveright', space: '+jump', ctrl: '+duck', shift: '+sprint',
  mouse1: '+attack', mouse2: '+attack2', r: '+reload', e: '+use', g: 'drop', q: 'lastinv', b: 'buymenu', m: 'teammenu',
  tab: '+showscores', f: '+lookatweapon', t: '+spray_menu', k: '+voicerecord', mouse3: 'player_ping',
  mwheelup: 'invprev', mwheeldown: 'invnext', '`': 'toggleconsole', y: 'messagemode', u: 'messagemode2',
  1: 'slot1', 2: 'slot2', 3: 'slot3', 4: 'slot4', 5: 'slot5', 6: 'slot6', 7: 'slot7', 8: 'slot8', 9: 'slot9', 0: 'slot10',
};
const UNBOUND = new Set(['', '<unbound>']);

// CS2 saves keys as USB HID scan codes ("scancode26" is W on a US layout).
// Two names for one physical key must count as the same key when an import
// replaces what a profile had.
const HID = { 40: 'enter', 41: 'escape', 42: 'backspace', 43: 'tab', 44: 'space', 45: '-', 46: '=', 47: '[', 48: ']',
  49: '\\', 51: ';', 52: "'", 53: '`', 54: ',', 55: '.', 56: '/', 57: 'capslock' };
for (let i = 0; i < 26; i++) HID[4 + i] = String.fromCharCode(97 + i);
for (let i = 1; i <= 9; i++) HID[29 + i] = String(i);
HID[39] = '0';
for (let i = 1; i <= 12; i++) HID[57 + i] = `f${i}`;
// Modifiers, navigation and keypad (USB HID usage table), with CS2's key names.
Object.assign(HID, { 71: 'scrolllock', 72: 'pause', 73: 'ins', 74: 'home', 75: 'pgup', 76: 'del', 77: 'end', 78: 'pgdn',
  79: 'rightarrow', 80: 'leftarrow', 81: 'downarrow', 82: 'uparrow', 83: 'numlock', 84: 'kp_slash', 85: 'kp_multiply',
  86: 'kp_minus', 87: 'kp_plus', 88: 'kp_enter', 89: 'kp_end', 90: 'kp_downarrow', 91: 'kp_pgdn', 92: 'kp_leftarrow',
  93: 'kp_5', 94: 'kp_rightarrow', 95: 'kp_home', 96: 'kp_uparrow', 97: 'kp_pgup', 98: 'kp_ins', 99: 'kp_del',
  224: 'ctrl', 225: 'shift', 226: 'alt', 228: 'rctrl', 229: 'rshift', 230: 'ralt' });
// Other spellings CS2 accepts for the same key.
const NAME_ALIASES = { semicolon: ';', lctrl: 'ctrl', lshift: 'shift', lalt: 'alt' };
export const keyId = (key) => {
  const k = String(key).toLowerCase().replace(/^"|"$/g, '');
  const m = k.match(/^scancode(\d+)$/);
  return (m && HID[m[1]]) || NAME_ALIASES[k] || k;
};
// Key named by a bind/unbind line, quoted or not.
const lineKey = (line) => {
  const t = [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]);
  return /^(bind|unbind)$/i.test(t[0] || '') && t[1] ? keyId(t[1]) : null;
};

export function importConfig(text, state) {
  let applied = 0, skipped = 0, adjusted = 0, ignoredVideo = 0;
  const extra = []; const notes = new Set(); const refused = [];
  const video = {};
  let screenHeight = null;
  const sizesSet = new Set();      // modern pixel sizes this import set (only these follow its reference height)
  // Final state of every key this import mentions: { command } | { unbind: true } | { default: true }.
  // The last mention wins, and the plan replaces whatever the profile had for that key.
  const keyPlan = new Map();
  const clamp = (path, v) => {
    const [lo, hi, , integer] = NUMBERS[path];
    const out = Math.min(hi, Math.max(lo, integer ? Math.round(v) : v));
    if (out !== v) adjusted++;
    return out;
  };
  const addBind = (rawKey, command) => {
    const key = rawKey.toLowerCase();
    if (!KEY_NAME.test(key)) { refused.push(`${rawKey} (not a key name)`); return; }
    const id = keyId(key);
    keyPlan.delete(id);            // re-insert so the last mention also comes last
    if (UNBOUND.has(command)) { keyPlan.set(id, { key, unbind: true }); return; }
    if (DEFAULT_BINDS[id] === command) { keyPlan.set(id, { key, default: true }); return; }
    const problem = checkBindCommand(command);
    if (problem) { refused.push(`${rawKey} → ${command} (${problem})`); return; }
    keyPlan.set(id, { key, command });
  };
  const tokens = (line) => [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]);
  const sections = []; let pending = null;

  for (let raw of String(text).split(/\r?\n/)) {
    raw = stripComment(raw);
    if (!raw) continue;
    // vcfg structure: a lone "name" line followed by { opens a section.
    if (raw === '{') { sections.push(pending); pending = null; continue; }
    if (raw === '}') { sections.pop(); continue; }
    const whole = tokens(raw);
    if (whole.length === 1 && /^"[^"]*"$/.test(raw)) { pending = whole[0].toLowerCase(); continue; }
    if (sections.at(-1) === 'bindings' && whole.length === 2) { addBind(whole[0], whole[1]); continue; }
    for (const part of raw.split(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/)) {
      const [cmd, a, b] = tokens(part.trim());
      if (!cmd) continue;
      const name = cmd.toLowerCase();
      const code = name === 'apply_crosshair_code' ? a : cmd;
      if (name === 'apply_crosshair_code' || /^CSGO-/i.test(cmd)) {
        if (code && SHARE_CODE.test(code)) { state.crosshair.shareCode = code; applied++; } else skipped++;
        continue;
      }
      if (name === 'bind' && a && b !== undefined) { addBind(a, b); continue; }
      if (name === 'unbind' && a && b === undefined) { addBind(a, ''); continue; }
      if (name === 'cl_crosshair_screen_height' && a && NUMBER.test(a) && +a >= 240) { screenHeight = +a; applied++; continue; }
      if (name === 'cl_crosshairgap' && a !== undefined) {
        notes.add(`Your old crosshair gap (${a}) has no exact equivalent in today's CS2; set Gap using the preview.`);
        continue;
      }
      if (name === 'setting.aspectratiomode' && a) { state.video.aspect = ['4:3', '16:9', '16:10'][+a] || state.video.aspect; applied++; continue; }
      if (['setting.fullscreen', 'setting.nowindowborder', 'setting.refreshrate_numerator', 'setting.refreshrate_denominator'].includes(name) && a && NUMBER.test(a)) {
        video[name] = +a; continue;
      }
      if (name === 'cl_crosshaircolor' && LEGACY_COLORS[+a]) {
        const [r, g, bl] = LEGACY_COLORS[+a]; Object.assign(state.crosshair, { r, g, b: bl }); applied++; continue;
      }
      if (LEGACY_SCALE[name] && a !== undefined && NUMBER.test(a)) {
        setPath(state, LEGACY_SCALE[name], clamp(LEGACY_SCALE[name], Math.max(name === 'cl_crosshairthickness' ? 1 : 0, Math.round(+a * 2.25))));
        notes.add('Old-style crosshair sizes were converted to pixels; check the preview.');
        applied++; continue;
      }
      const path = IMPORT_MAP[name];
      if (path && a !== undefined && a !== '') {
        const current = getPath(state, path);
        if (typeof current === 'boolean') setPath(state, path, a !== '0' && a !== 'false');
        else if (path === 'misc.showFps' && /^(true|false)$/.test(a)) setPath(state, path, a === 'true' ? 1 : 0);
        else if (NUMBER.test(a)) { setPath(state, path, clamp(path, +a)); if (PIXEL_SIZES.includes(path)) sizesSet.add(path); }
        else { skipped++; continue; }
        applied++; continue;
      }
      if (OBSOLETE.test(name)) continue;
      if (name.startsWith('setting.')) { ignoredVideo++; continue; }
      const line = a === undefined ? cmd : `${cmd} "${a}"`;
      if (b === undefined && !checkCfgLine(line)) extra.push(line);
      else skipped++;
    }
  }

  // Display mode and refresh rate from cs2_video.txt.
  if ('setting.fullscreen' in video || 'setting.nowindowborder' in video) {
    state.video.mode = video['setting.fullscreen'] ? 'fullscreen' : video['setting.nowindowborder'] ? 'borderless' : 'windowed';
    applied++;
  }
  if (video['setting.refreshrate_numerator']) {
    state.video.refreshRate = clamp('video.refreshRate', Math.round(video['setting.refreshrate_numerator'] / (video['setting.refreshrate_denominator'] || 1)));
    applied++;
  }
  // Crosshair sizes are stored for a 1080-pixel reference height.
  if (screenHeight && screenHeight !== 1080 && sizesSet.size) {
    for (const path of sizesSet) setPath(state, path, clamp(path, Math.round(getPath(state, path) * 1080 / screenHeight)));
    notes.add(`Crosshair sizes were made at ${screenHeight}p and converted to the 1080p scale used here.`);
  }
  // Keys: drop whatever the profile had for each imported key (custom binds and
  // bind/unbind extra lines), then apply the imported result.
  let existing = state.extraCfg ? state.extraCfg.split('\n') : [];
  if (keyPlan.size) {
    state.binds = state.binds.filter((b) => !keyPlan.has(keyId(b.key)));
    existing = existing.filter((l) => !keyPlan.has(lineKey(l)));
    for (const plan of keyPlan.values()) {
      if (plan.command) state.binds.push({ key: plan.key, command: plan.command });
      else if (plan.unbind) extra.push(`unbind "${plan.key}"`);
      applied++;
    }
  }
  if (extra.length || keyPlan.size) {
    const nameOf = (l) => lineKey(l) ? `key ${lineKey(l)}` : l.split(/\s+/)[0].replace(/"/g, '').toLowerCase();
    const names = new Set(extra.map(nameOf));
    state.extraCfg = existing.filter((l) => !names.has(nameOf(l))).concat(extra).slice(0, 200).join('\n');
  }
  if (adjusted) notes.add(`${adjusted} value${adjusted === 1 ? ' was' : 's were'} outside CS2's limits and adjusted.`);
  if (ignoredVideo) notes.add(`${ignoredVideo} graphics quality setting${ignoredVideo === 1 ? ' was' : 's were'} ignored: the station sets resolution and display mode only.`);
  if (refused.length) notes.add(`Binds not imported: ${refused.join('; ')}.`);
  return { applied: applied + extra.length, extra: extra.length, skipped: skipped + refused.length, notes: [...notes] };
}
