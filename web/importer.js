// Import of pasted configs: autoexec lines, config dumps, vcfg "key" "value" pairs.
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
const OBSOLETE = /^(rate|cl_cmdrate|cl_updaterate|cl_interp|cl_interp_ratio|m_rawinput|cl_crosshairgap|cl_crosshair_outlinethickness|cl_crosshairusealpha|cl_crosshairgap_useweaponvalue|cl_crosshaircolor)$/;
// Values are brought into the ranges the server accepts, so an import always saves.
let adjusted = 0;
const clamp = (path, v) => {
  const [lo, hi, , integer] = NUMBERS[path];
  const out = Math.min(hi, Math.max(lo, integer ? Math.round(v) : v));
  if (out !== v) adjusted++;
  return out;
};

export function importConfig(text, state) {
  let applied = 0, skipped = 0; const extra = []; const notes = new Set();
  adjusted = 0;
  const tokens = (line) => [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]);
  for (let raw of String(text).split(/\r?\n/)) {
    raw = stripComment(raw);
    if (!raw || raw === '{' || raw === '}') continue;
    for (const part of raw.split(/;(?=(?:[^"]*"[^"]*")*[^"]*$)/)) {
      const [cmd, a, b] = tokens(part.trim());
      if (!cmd) continue;
      const name = cmd.toLowerCase();
      const code = name === 'apply_crosshair_code' ? a : cmd;
      if (name === 'apply_crosshair_code' || /^CSGO-/i.test(cmd)) {
        if (code && SHARE_CODE.test(code)) { state.crosshair.shareCode = code; applied++; } else skipped++;
        continue;
      }
      if (name === 'bind' && a && b !== undefined) {
        const key = a.toLowerCase();
        if (!KEY_NAME.test(key) || checkBindCommand(b)) { skipped++; continue; }
        state.binds = state.binds.filter((x) => x.key !== key).concat({ key, command: b });
        applied++; continue;
      }
      if (name === 'setting.aspectratiomode' && a) { state.video.aspect = ['4:3', '16:9', '16:10'][+a] || state.video.aspect; applied++; continue; }
      if (name === 'cl_crosshaircolor' && LEGACY_COLORS[+a]) {
        const [r, g, bl] = LEGACY_COLORS[+a]; Object.assign(state.crosshair, { r, g, b: bl }); applied++; continue;
      }
      if (LEGACY_SCALE[name] && a !== undefined && /^-?(\d+(\.\d*)?|\.\d+)$/.test(a)) {
        setPath(state, LEGACY_SCALE[name], clamp(LEGACY_SCALE[name], Math.max(name === 'cl_crosshairthickness' ? 1 : 0, Math.round(+a * 2.25))));
        notes.add('Old-style crosshair sizes were converted to pixels; check the preview.');
        applied++; continue;
      }
      const path = IMPORT_MAP[name];
      if (path && a !== undefined && a !== '') {
        const current = getPath(state, path);
        if (typeof current === 'boolean') setPath(state, path, a !== '0' && a !== 'false');
        else if (/^-?(\d+(\.\d*)?|\.\d+)$/.test(a)) setPath(state, path, clamp(path, +a));
        else { skipped++; continue; }
        applied++; continue;
      }
      if (OBSOLETE.test(name) || name.startsWith('setting.')) continue;
      const line = a === undefined ? cmd : `${cmd} "${a}"`;
      if (b === undefined && !checkCfgLine(line)) extra.push(line);
      else skipped++;
    }
  }
  if (extra.length) {
    const existing = state.extraCfg ? state.extraCfg.split('\n') : [];
    const names = new Set(extra.map((l) => l.split(' ')[0]));
    state.extraCfg = existing.filter((l) => !names.has(l.split(/\s+/)[0])).concat(extra).slice(0, 200).join('\n');
  }
  if (adjusted) notes.add(`${adjusted} value${adjusted === 1 ? ' was' : 's were'} outside CS2's limits and adjusted.`);
  return { applied: applied + extra.length, extra: extra.length, skipped, notes: [...notes] };
}
