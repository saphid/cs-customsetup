// Loadout web app: build a profile, save it, get a 6-digit code.
import { importConfig, getPath, setPath } from './importer.js';
import { NUMBERS } from './schema.js';
const view = document.getElementById('view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtCode = (c) => `${c.slice(0, 3)}<span>${c.slice(3)}</span>`;

const DEFAULTS = {
  name: '', team: '',
  mouse: { dpi: 800, sensitivity: 1.25, zoomSensitivity: 1, yaw: 0.022, windowsPointerSpeed: 10, enhancePointerPrecision: false },
  crosshair: { shareCode: '', style: 4, length: 8, thickness: 2, gap: 4, outline: 1,
    r: 0, g: 255, b: 0, a: 255, dot: false, tStyle: false, followRecoil: true },
  viewmodel: { fov: 60, offsetX: 1, offsetY: 1, offsetZ: -1 },
  video: { apply: true, width: 1920, height: 1080, refreshRate: 0, aspect: '16:9', mode: 'fullscreen', scaling: 'native' },
  audio: { volume: 1 },
  hud: { scale: 1, color: 0, radarScale: 0.7, radarHudScale: 1, radarCentered: true, radarRotate: true },
  misc: { fpsMax: 0, showFps: 0 },
  windows: { applyMouse: true },
  binds: [],
  extraCfg: '',
};
const clone = (o) => JSON.parse(JSON.stringify(o));
const merge = (base, extra) => {
  const out = clone(base);
  for (const [k, v] of Object.entries(extra || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' ? merge(out[k], v) : v;
  }
  return out;
};

// localStorage can be full, disabled or private; nothing here may depend on it working.
const storage = {
  get(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } },
  put(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
  del(key) { try { localStorage.removeItem(key); } catch { /* nothing to remove */ } },
};
// Edit keys by code. Kept in memory too, so a key the browser refused to store
// still works for this visit and can be shown to the player.
const memoryKeys = {};
const keys = {
  stored() { return storage.get('cssetup.keys') || {}; },
  all() { return { ...this.stored(), ...memoryKeys }; },
  get(code) { return this.all()[code]; },
  set(code, key) { memoryKeys[code] = key; return storage.put('cssetup.keys', { ...this.stored(), [code]: key }); },
  isStored(code) { return !!this.stored()[code]; },
  remove(code) { delete memoryKeys[code]; const a = this.stored(); delete a[code]; storage.put('cssetup.keys', a); },
};
// Unsaved work: one draft for a new setup, one per setup being edited.
const draftKey = (code) => (code ? `loadout.draft.${code}` : 'cssetup.draft.v2');

let info = { url: location.origin, fingerprint: '', reachable: true };
const infoReady = fetch('/api/info').then((r) => r.json()).then((d) => { info = d; }).catch(() => {});

function toast(message) {
  const el = Object.assign(document.createElement('div'), { className: 'toast', textContent: message });
  el.setAttribute('role', 'status');
  document.body.append(el); setTimeout(() => el.remove(), 2600);
}

async function api(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `Request failed (${res.status})`), { field: body.field, status: res.status });
  return body;
}

// ------------------------------------------------------------------ routes

let pageListeners = new AbortController();
let routeGen = 0;            // a response for an older route must not draw over a newer one
let flash = '';              // one-off message for the next page

function route() {
  pageListeners.abort();     // drop the previous page's handlers and requests
  view.inert = false;        // a save in progress on the previous page froze it
  pageListeners = new AbortController();
  routeGen++;
  const hash = location.hash.slice(1) || '/';
  const [path, query] = hash.split('?');
  const params = new URLSearchParams(query || '');
  document.querySelector('.savebar')?.remove();
  window.scrollTo(0, 0);
  let m;
  if (path === '/') return home();
  if (path === '/new') return editor(null, null);
  if (path === '/load') return loadView();
  if (path === '/station') return stationDoc();
  if ((m = path.match(/^\/p\/(\d{6})$/))) return params.get('k') ? claimKey(m[1], params.get('k')) : profileView(m[1]);
  if ((m = path.match(/^\/edit\/(\d{6})$/))) return editExisting(m[1]);
  if ((m = path.match(/^\/done\/(\d{6})$/))) return doneView(m[1]);
  home();
}
window.addEventListener('hashchange', route);

// Runs an async page load; returns null when the player navigated away meanwhile.
async function current(promise) {
  const gen = routeGen;
  try { const value = await promise; return gen === routeGen ? { value } : null; }
  catch (error) { if (gen !== routeGen || error.name === 'AbortError') return null; throw error; }
}
const signal = () => pageListeners.signal;

// An edit link (#/p/<code>?k=<key>) is checked before it is stored, so a
// wrong link can never replace a working key on this device.
async function claimKey(code, key) {
  view.innerHTML = '<p class="hint">Checking your edit link…</p>';
  try {
    const ok = await current(api(`/api/profiles/${code}/verify`, { method: 'POST', headers: { 'X-Edit-Key': key }, signal: signal() }));
    if (!ok) return;
    flash = keys.set(code, key) ? 'Edit link saved on this device. You can edit this setup now.'
      : 'Edit link accepted for this visit, but this browser could not save it. Keep the link.';
  } catch (e) {
    flash = e.status === 403 ? 'That edit link does not match this setup, so nothing was changed.' : e.message;
  }
  location.replace(`#/p/${code}`);
}

function home() {
  const mine = Object.keys(keys.all());
  view.innerHTML = `
    <section class="hero">
      <h1>Your CS2 setup.<br><em>Any PC.</em> Six digits.</h1>
      <p>Build your sensitivity, crosshair, binds, viewmodel and video settings on your phone. At the tournament PC, type your code and play. No USB stick, no Steam login on a shared machine.</p>
      <div class="actions">
        <a class="btn primary" href="#/new">Build my setup</a>
        <a class="btn" href="#/load">I have a code</a>
      </div>
    </section>
    ${mine.length ? `<div class="section"><h2>Your setups</h2><p class="hint">Saved on this device. You can edit these.</p>
      <div class="actions">${mine.map((c) => `<a class="btn small" href="#/p/${c}">${c}</a>`).join('')}</div></div>` : ''}
    <div class="steps3">
      <div class="step"><b>1 · BUILD</b><p>Set your sensitivity and crosshair, or paste your autoexec or crosshair code. Takes two minutes.</p></div>
      <div class="step"><b>2 · SAVE</b><p>You get a 6-digit code and a QR code. Screenshot it.</p></div>
      <div class="step"><b>3 · SIT DOWN</b><p>Type the code into the Loadout window on the PC. It writes your config, sets the Windows mouse, and launches CS2.</p></div>
    </div>`;
}

// ------------------------------------------------------------------ editor

const COLORS = [[[0, 255, 0], 'Green'], [[255, 255, 0], 'Yellow'], [[0, 255, 255], 'Cyan'], [[255, 0, 255], 'Magenta'], [[255, 255, 255], 'White'], [[255, 50, 50], 'Red']];
const STYLES = [[4, 'Static cross'], [0, 'Dynamic cross'], [5, 'Static cross, shot feedback'], [7, 'Dynamic quad'], [9, 'Static quad'],
  [8, 'Static square'], [3, 'Static circle'], [1, 'Dynamic circle'], [6, 'Dot only'], [2, 'Dynamic cross (legacy)']];
const BIND_PRESETS = [
  ['Jump on scroll down', 'mwheeldown', '+jump'],
  ['Jump on scroll up', 'mwheelup', '+jump'],
  ['Voice on mouse 4', 'mouse4', '+voicerecord'],
  ['Flash on F', 'f', 'slot7'],
  ['Smoke on 4', '4', 'slot8'],
  ['HE on C', 'c', 'slot6'],
  ['Molotov on Z', 'z', 'slot10'],
  ['Inspect on V', 'v', '+lookatweapon'],
];
const RESOLUTIONS = [
  ['1920×1080 · 16:9', 1920, 1080, '16:9', 'native'],
  ['1280×960 · 4:3 stretched', 1280, 960, '4:3', 'stretched'],
  ['1440×1080 · 4:3 stretched', 1440, 1080, '4:3', 'stretched'],
  ['1024×768 · 4:3 stretched', 1024, 768, '4:3', 'stretched'],
  ['1280×1024 · 5:4 bars', 1280, 1024, '4:3', 'black-bars'],
  ['2560×1440 · 16:9', 2560, 1440, '16:9', 'native'],
];

// Controls never offer a value the server would reject.
const limits = (path, min, max) => (NUMBERS[path] ? [Math.max(min, NUMBERS[path][0]), Math.min(max, NUMBERS[path][1])] : [min, max]);
const fid = (path) => `f-${path.replace(/\W/g, '-')}`;

function rangeField(path, label, min, max, step, hint = '') {
  [min, max] = limits(path, min, max);
  const id = fid(path);
  return `<div class="field" data-field="${path}" data-label="${esc(label)}"><span id="${id}-l">${label}</span>
    <div class="range"><input type="range" min="${min}" max="${max}" step="${step}" data-bind="${path}" data-num aria-labelledby="${id}-l"${hint ? ` aria-describedby="${id}-h"` : ''}>
    <input type="number" id="${id}" min="${min}" max="${max}" step="${step}" data-bind="${path}" data-num aria-labelledby="${id}-l"></div>${hint ? `<small id="${id}-h">${hint}</small>` : ''}</div>`;
}
const numField = (path, label, min, max, step, hint = '') => ([min, max] = limits(path, min, max), `<label class="field" data-field="${path}" data-label="${esc(label)}"><span>${label}</span>
  <input type="number" id="${fid(path)}" inputmode="decimal" min="${min}" max="${max}" step="${step}" data-bind="${path}" data-num>${hint ? `<small>${hint}</small>` : ''}</label>`);
const toggle = (path, label) => `<label class="toggle" data-field="${path}" data-label="${esc(label)}">${label}<input type="checkbox" role="switch" data-bind="${path}"></label>`;
const seg = (path, label, options) => `<div class="field" data-field="${path}" data-label="${esc(label)}"><span id="${fid(path)}-l">${label}</span>
  <div class="seg" role="group" aria-labelledby="${fid(path)}-l" data-seg="${path}">${options.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="false">${l}</button>`).join('')}</div></div>`;

async function editExisting(code) {
  view.innerHTML = '<p class="hint">Loading…</p>';
  try {
    const got = await current(api(`/api/profiles/${code}`, { signal: signal() }));
    if (got) editor(code, got.value.profile);
  } catch (e) { view.innerHTML = `<div class="loadbox"><h1>Can't open ${code}</h1><p class="error">${esc(e.message)}</p><a class="btn" href="#/load">Try another code</a></div>`; }
}

function editor(code, saved) {
  const draft = storage.get(draftKey(code));
  let state = merge(DEFAULTS, draft || saved || {});
  // A copy of someone's setup arrives as a draft marked with its source code.
  const copiedFrom = !code && draft?.copiedFrom;
  delete state.copiedFrom;
  if (typeof state.misc.showFps === 'boolean') state.misc.showFps = +state.misc.showFps;   // drafts from before FPS modes
  const mine = !code || !!keys.get(code);
  view.innerHTML = `
    <h1 style="margin:8px 0 6px">${code ? `Edit setup ${code}` : 'Build your setup'}</h1>
    <p class="hint lead">${code ? 'Change anything, then press Save changes. Your code stays the same.'
      : copiedFrom ? `Copied from setup ${esc(copiedFrom)}. Change what you like and save to get your own code.`
      : "Everything starts at CS2's defaults. Change what matters to you and press Save."}</p>
    ${draft && !copiedFrom ? `<div class="callout warn draft" role="status"><b>${code ? 'Unsaved changes restored.' : 'Continuing your unsaved setup.'}</b>
      <button class="btn small" type="button" id="discardDraft">${code ? 'Discard changes' : 'Start fresh'}</button></div>` : ''}
    ${code && !mine ? `<div class="callout warn" role="status"><b>This device can't save changes to ${code}.</b><p class="hint" style="margin:6px 0 0">Open your edit link on this device first, or use this setup as a starting point for a new code.</p></div>` : ''}
    <nav class="jump" aria-label="Sections">${[['mouse', 'Mouse'], ['crosshair', 'Crosshair'], ['video', 'Video'], ['binds', 'Binds'], ['more', 'More']]
      .map(([id, l]) => `<button type="button" class="chip" data-jump="${id}">${l}</button>`).join('')}</nav>

    <details class="section import">
      <summary><h2>Already have a config? Import it</h2></summary>
      <p class="hint">Paste your autoexec, CS2's saved config or key files, a pro's config, or lines like <code>sensitivity 1.2</code>. We read sensitivity, crosshair, viewmodel, binds, video and more; other allowed settings go into Extra commands.</p>
      <label class="field"><span>Your config</span><textarea id="importText" placeholder='sensitivity "1.1"&#10;cl_crosshair_length "4"&#10;bind "mwheeldown" "+jump"'></textarea></label>
      <div class="actions" style="margin-top:12px"><button class="btn small" type="button" id="importBtn">Import</button></div>
      <div id="importResult" class="hint" role="status" style="margin:10px 0 0"></div>
    </details>

    <section class="section" id="sec-mouse">
      <h2>Mouse</h2>
      <p class="hint">Your mouse DPI and in-game sensitivity. If the event PC's mouse runs at a different DPI, the station converts your sensitivity so your aim feels exactly the same.</p>
      <div class="grid">
        ${numField('mouse.dpi', 'Mouse DPI', 50, 32000, 50)}
        ${numField('mouse.sensitivity', 'Sensitivity', 0.0001, 8, 0.01)}
        <div class="stat" aria-live="polite"><b id="edpi">—</b><span>eDPI (DPI × sens) · cm/360: <span id="cm360">—</span></span></div>
        ${numField('mouse.zoomSensitivity', 'Zoom sensitivity', 0.01, 3, 0.01, 'zoom_sensitivity_ratio, default 1')}
      </div>
      <h3 class="sub">Windows mouse (desktop only)</h3>
      <div class="grid">
        ${rangeField('mouse.windowsPointerSpeed', 'Windows pointer speed', 1, 20, 1, '10 is the default (6/11)')}
        <div class="field" style="justify-content:flex-end;gap:8px">
          ${toggle('mouse.enhancePointerPrecision', 'Enhance pointer precision')}
          ${toggle('windows.applyMouse', 'Apply these on the PC')}
        </div>
      </div>
    </section>

    <section class="section" id="sec-crosshair">
      <h2>Crosshair</h2>
      <div class="xhair" id="xhairBuilder">
        <div class="preview-wrap"><div class="preview" id="preview"><canvas id="xc" width="220" height="220" role="img" aria-label="Crosshair preview"></canvas>
          <div class="bgs"><button type="button" data-bg="dust" style="--c:#b08a63" aria-label="Sand background"></button><button type="button" data-bg="dark" style="--c:#2c3440" aria-label="Dark background"></button><button type="button" data-bg="sky" style="--c:#9ec3e6" aria-label="Sky background"></button></div></div></div>
        <div>
          <label class="field"><span>Style</span><select data-bind="crosshair.style" data-num>${STYLES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
          <div class="grid" style="margin-top:14px">
            ${rangeField('crosshair.length', 'Length (px at 1080p)', 0, 40, 1)}
            ${rangeField('crosshair.thickness', 'Thickness (px)', 0, 12, 1)}
            ${rangeField('crosshair.gap', 'Gap (px)', -10, 20, 1)}
            ${rangeField('crosshair.a', 'Opacity', 0, 255, 1)}
          </div>
          <div class="field" style="margin-top:14px"><span id="colors-l">Colour</span>
            <div class="colors" id="colors" role="group" aria-labelledby="colors-l">${COLORS.map(([rgb, n]) => `<button type="button" aria-label="${n}" aria-pressed="false" data-rgb="${rgb.join(',')}" style="--c:rgb(${rgb.join(',')})"></button>`).join('')}
              <input type="color" id="customColor" aria-label="Custom colour"></div></div>
          <div style="margin-top:14px">${seg('crosshair.outline', 'Outline', [['0', 'None'], ['1', 'Full'], ['2', 'Half']])}</div>
          <div class="grid" style="margin-top:14px">
            ${toggle('crosshair.dot', 'Centre dot')}
            ${toggle('crosshair.tStyle', 'T style')}
            ${toggle('crosshair.followRecoil', 'Follow recoil')}
          </div>
        </div>
      </div>
      <label class="field" data-field="crosshair.shareCode" data-label="Crosshair share code" style="margin-top:16px"><span>Crosshair share code (optional)</span>
        <input type="text" id="${fid('crosshair.shareCode')}" data-bind="crosshair.shareCode" placeholder="CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx" autocapitalize="off" spellcheck="false">
        <small>From CS2: Settings → Game → Crosshair → Share. The station copies it so you can paste it into CS2's Import button.</small></label>
    </section>

    <section class="section" id="sec-video">
      <h2>Video ${toggle('video.apply', 'Apply on PC')}</h2>
      <p class="hint">Set before CS2 starts. Stretched 4:3 also needs GPU scaling set up on the PC; the station reminds the admin.</p>
      <div class="chips" style="margin:0 0 16px">${RESOLUTIONS.map(([l], i) => `<button class="chip" type="button" data-res="${i}">${l}</button>`).join('')}</div>
      <div class="grid">
        ${numField('video.width', 'Width', 640, 7680, 1)}
        ${numField('video.height', 'Height', 480, 4320, 1)}
        ${numField('video.refreshRate', 'Refresh rate (Hz)', 0, 600, 1, '0 = let the PC choose')}
        ${seg('video.aspect', 'Aspect ratio', [['16:9', '16:9'], ['4:3', '4:3'], ['16:10', '16:10']])}
        ${seg('video.scaling', 'Picture', [['native', 'Native'], ['stretched', 'Stretched'], ['black-bars', 'Bars']])}
        ${seg('video.mode', 'Display mode', [['fullscreen', 'Fullscreen'], ['borderless', 'Borderless'], ['windowed', 'Window']])}
      </div>
    </section>

    <section class="section" id="sec-binds">
      <h2>Binds</h2>
      <p class="hint">Only changes from CS2's defaults. One key holds one action: jumpthrow, snap-tap and null-bind scripts are blocked in CS2 and at tournaments.</p>
      <div class="binds" id="binds"></div>
      <div class="chips">${BIND_PRESETS.map(([l], i) => `<button class="chip" type="button" data-bp="${i}">+ ${l}</button>`).join('')}<button class="chip" type="button" id="addBind">+ Custom bind</button></div>
    </section>

    <section class="section" id="sec-more">
      <h2>Viewmodel</h2>
      <div class="grid">
        ${rangeField('viewmodel.fov', 'Viewmodel FOV', 60, 68, 1)}
        ${rangeField('viewmodel.offsetX', 'Offset X', -2.5, 2.5, 0.5)}
        ${rangeField('viewmodel.offsetY', 'Offset Y', -2, 2, 0.5)}
        ${rangeField('viewmodel.offsetZ', 'Offset Z', -2, 2, 0.5)}
      </div>
      <div class="chips"><button class="chip" type="button" data-vm="60,1,1,-1">CS2 default</button><button class="chip" type="button" data-vm="68,2.5,0,-1.5">Classic right</button><button class="chip" type="button" data-vm="68,2.5,2,-2">Wide (pro)</button><button class="chip" type="button" data-vm="68,1,-1,-2">Low and close</button></div>
    </section>

    <section class="section">
      <h2>HUD, audio, performance</h2>
      <div class="grid">
        ${rangeField('hud.scale', 'HUD scale', 0.9, 1.1, 0.05)}
        ${rangeField('hud.radarScale', 'Radar map zoom', 0.25, 1, 0.05)}
        ${rangeField('hud.radarHudScale', 'Radar size', 0.8, 1.3, 0.05)}
        ${rangeField('audio.volume', 'Master volume', 0, 1, 0.05)}
        ${numField('misc.fpsMax', 'FPS limit', 0, 1000, 1, '0 = unlimited')}
        ${seg('misc.showFps', 'FPS counter (cl_showfps)', [['0', 'Off'], ['1', '1'], ['2', '2'], ['3', '3']])}
        <div class="field" style="justify-content:flex-end;gap:8px">${toggle('hud.radarCentered', 'Radar always centred')}${toggle('hud.radarRotate', 'Radar rotates')}</div>
      </div>
    </section>

    <section class="section">
      <h2>You</h2>
      <div class="grid">
        <label class="field" data-field="name" data-label="Name"><span>Name or nickname</span><input type="text" id="${fid('name')}" maxlength="40" data-bind="name" placeholder="shown on the PC when it loads"></label>
        <label class="field" data-field="team" data-label="Team"><span>Team (optional)</span><input type="text" id="${fid('team')}" maxlength="40" data-bind="team"></label>
      </div>
      <p class="hint" style="margin:12px 0 0">Anyone with your 6-digit code can see this setup, including your name and team.</p>
    </section>

    <section class="section">
      <h2>Extra commands</h2>
      <p class="hint">One per line, run after everything above: player settings (<code>cl_…</code>, <code>snd_…</code>, <code>viewmodel_…</code>, <code>hud_…</code> and similar), <code>bind</code> or <code>unbind</code>. Server, map, exec and alias commands are not allowed.</p>
      <label class="field" data-field="extraCfg" data-label="Extra commands"><span>Commands</span><textarea id="${fid('extraCfg')}" data-bind="extraCfg" placeholder="cl_draw_only_deathnotices 0"></textarea></label>
    </section>
    ${code && mine ? `<div class="danger"><button class="btn link" type="button" id="deleteSetup">Delete setup ${code}</button></div>` : ''}`;

  const bar = document.createElement('div');
  bar.className = 'savebar';
  bar.innerHTML = `<div class="inner"><div class="who" id="who"></div><div class="actions" style="align-items:center">
    <span class="error" id="saveError" role="alert"></span><button class="btn primary" id="save"${mine ? '' : ' disabled'}>${code ? 'Save changes' : 'Save & get my code'}</button></div></div>`;
  document.body.append(bar);

  const $ = (s) => view.querySelector(s);
  const persistDraft = () => { storage.put(draftKey(code), state); };

  // Derived numbers only make sense for values the server would accept.
  const valid = (path) => {
    const v = getPath(state, path), [lo, hi] = NUMBERS[path];
    return typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
  };

  function sync() {
    for (const el of view.querySelectorAll('[data-bind]')) {
      const v = getPath(state, el.dataset.bind);
      if (el.type === 'checkbox') el.checked = !!v;
      else if (document.activeElement !== el) el.value = v ?? '';
    }
    for (const s of view.querySelectorAll('[data-seg]')) {
      const v = getPath(state, s.dataset.seg);
      s.querySelectorAll('button').forEach((b) => { const on = b.dataset.v === String(v); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    }
    const c = state.crosshair;
    view.querySelectorAll('[data-rgb]').forEach((b) => { const on = b.dataset.rgb === [c.r, c.g, c.b].join(','); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    if (document.activeElement !== $('#customColor')) $('#customColor').value = '#' + [c.r, c.g, c.b].map((n) => Math.max(0, Math.min(255, Number(n) || 0)).toString(16).padStart(2, '0')).join('');
    const ok = valid('mouse.dpi') && valid('mouse.sensitivity');
    const edpi = ok ? Math.round(state.mouse.dpi * state.mouse.sensitivity) : 0;
    $('#edpi').textContent = edpi || '—';
    // CS2 turns 0.022° per count: cm/360 = 360 / (0.022 × sens × DPI) × 2.54
    $('#cm360').textContent = edpi ? (360 / (state.mouse.yaw * state.mouse.dpi * state.mouse.sensitivity) * 2.54).toFixed(1) : '—';
    bar.querySelector('#who').textContent = `${state.name || 'Unnamed player'}${edpi ? ` · ${edpi} eDPI` : ''}`;
    renderBinds();
    drawCrosshair($('#xc'), state.crosshair);
  }

  function renderBinds() {
    const box = $('#binds');
    if (box.contains(document.activeElement)) return;
    box.innerHTML = state.binds.length ? state.binds.map((b, i) => `<div class="bind">
      <input type="text" placeholder="key" value="${esc(b.key)}" data-bk="${i}" data-field="binds.${i}.key" data-label="Bind ${i + 1} key" aria-label="Bind ${i + 1}: key" autocapitalize="off" spellcheck="false">
      <input type="text" placeholder="command" value="${esc(b.command)}" data-bc="${i}" data-field="binds.${i}.command" data-label="Bind ${i + 1} command" aria-label="Bind ${i + 1}: command" autocapitalize="off" spellcheck="false">
      <button type="button" data-del="${i}" aria-label="Remove bind ${i + 1}">✕</button></div>`).join('')
      : '<p class="hint" style="margin:0">No custom binds. CS2 defaults will be used.</p>';
  }

  function clearErrors() {
    view.querySelectorAll('.invalid').forEach((f) => f.classList.remove('invalid'));
    view.querySelectorAll('.field-error').forEach((e) => e.remove());
    view.querySelectorAll('[aria-invalid]').forEach((e) => { e.removeAttribute('aria-invalid'); e.removeAttribute('aria-errormessage'); });
    bar.querySelector('#saveError').textContent = '';
  }

  // Marks a field, explains the problem next to it in plain words, and moves focus there.
  function showError(path, message) {
    const holder = path && view.querySelector(`[data-field="${CSS.escape(path)}"]`);
    const label = holder?.dataset.label;
    const text = label ? message.replace(path, label) : message;
    bar.querySelector('#saveError').textContent = holder ? 'Fix the highlighted setting.' : text;
    if (!holder) return;
    const input = holder.matches('input, textarea, select') ? holder : holder.querySelector('input:not([type=range]), textarea, select');
    holder.classList.add('invalid');
    const note = Object.assign(document.createElement('small'), { className: 'field-error', id: `err-${fid(path)}`, textContent: text });
    if (holder.matches('input')) (holder.closest('.bind') || holder).after(note); else holder.append(note);
    if (input) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-errormessage', note.id); }
    holder.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input?.focus({ preventScroll: true });
  }

  // Same limits as the server, checked first so problems show at once.
  function firstProblem() {
    for (const [path, [lo, hi]] of Object.entries(NUMBERS)) {
      const v = getPath(state, path);
      if (v === '' || v === undefined) continue;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) return [path, `${path} must be between ${lo} and ${hi}`];
    }
    return null;
  }

  view.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.bind) {
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if ('num' in el.dataset) v = el.value === '' ? '' : Number(el.value);
      setPath(state, el.dataset.bind, v);
    } else if (el.dataset.bk) state.binds[el.dataset.bk].key = el.value;
    else if (el.dataset.bc) state.binds[el.dataset.bc].command = el.value;
    else if (el.id === 'customColor') {
      const n = parseInt(el.value.slice(1), 16);
      Object.assign(state.crosshair, { r: n >> 16, g: (n >> 8) & 255, b: n & 255 });
    } else return;
    if (el.closest('.invalid')) clearErrors();
    persistDraft(); sync();
  }, { signal: signal() });
  view.addEventListener('change', (e) => { if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT') { persistDraft(); sync(); } }, { signal: signal() });
  view.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.closest('[data-seg]')) { const path = t.closest('[data-seg]').dataset.seg; setPath(state, path, typeof getPath(DEFAULTS, path) === 'number' ? Number(t.dataset.v) : t.dataset.v); }
    else if (t.dataset.rgb) { const [r, g, b] = t.dataset.rgb.split(',').map(Number); Object.assign(state.crosshair, { r, g, b }); }
    else if (t.dataset.bg) { $('#preview').dataset.bg = t.dataset.bg; }
    else if (t.dataset.jump) { $(`#sec-${t.dataset.jump}`).scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    else if (t.dataset.vm) { const [fov, x, y, z] = t.dataset.vm.split(',').map(Number); state.viewmodel = { fov, offsetX: x, offsetY: y, offsetZ: z }; }
    else if (t.dataset.res) { const [, w, h, a, s] = RESOLUTIONS[t.dataset.res]; Object.assign(state.video, { width: w, height: h, aspect: a, scaling: s }); }
    else if (t.dataset.bp) { const [, key, command] = BIND_PRESETS[t.dataset.bp]; state.binds = state.binds.filter((b) => b.key !== key).concat({ key, command }); }
    else if (t.id === 'addBind') { state.binds.push({ key: '', command: '' }); renderBinds(); persistDraft(); view.querySelector(`[data-bk="${state.binds.length - 1}"]`)?.focus(); return; }
    else if (t.dataset.del) state.binds.splice(+t.dataset.del, 1);
    else if (t.id === 'discardDraft') { storage.del(draftKey(code)); route(); return; }
    else if (t.id === 'deleteSetup') { deleteSetup(code); return; }
    else if (t.id === 'importBtn') {
      const { applied, extra, skipped, notes } = importConfig($('#importText').value, state);
      $('#importResult').textContent = (applied ? `Imported ${applied} setting${applied === 1 ? '' : 's'}${extra ? `, ${extra} into Extra commands` : ''}.` : 'Nothing recognised. Paste lines like: sensitivity "1.2"')
        + (skipped ? ` Skipped ${skipped} line${skipped === 1 ? '' : 's'} that can't run at a station.` : '') + (notes.length ? ` ${notes.join(' ')}` : '');
      if (applied) $('#importText').value = '';
    } else return;
    persistDraft(); sync();
  }, { signal: signal() });
  view.addEventListener('focusout', (e) => { if (e.target.dataset.bk || e.target.dataset.bc) setTimeout(renderBinds); }, { signal: signal() });

  bar.querySelector('#save').addEventListener('click', async () => {
    const btn = bar.querySelector('#save');
    clearErrors();
    const problem = firstProblem();
    if (problem) { showError(...problem); return; }
    // The form is frozen while saving, so what was sent is exactly what the draft holds.
    const gen = routeGen;
    btn.disabled = true; view.inert = true; btn.textContent = 'Saving…';
    const payload = clone(state);
    payload.binds = payload.binds.filter((b) => b.key.trim() || b.command.trim());
    try {
      let saved = code;
      if (code) {
        await api(`/api/profiles/${code}`, { method: 'PUT', body: JSON.stringify(payload), headers: { 'X-Edit-Key': keys.get(code) || '' } });
      } else {
        const res = await api('/api/profiles', { method: 'POST', body: JSON.stringify(payload) });
        keys.set(res.code, res.editKey);            // kept in memory even if storage fails; the next page says so
        saved = res.code;
      }
      storage.del(draftKey(code));
      // Only move on if the player is still on this page.
      if (gen === routeGen) location.hash = `#/done/${saved}`;
      else toast(code ? `Setup ${code} saved` : `Saved: your code is ${saved}`);
    } catch (e) {
      if (gen !== routeGen) { toast(`Not saved: ${e.message}`); return; }
      if (e.field) showError(e.field, e.message);
      else bar.querySelector('#saveError').textContent = e.message;
    } finally {
      view.inert = false; btn.disabled = false; btn.textContent = code ? 'Save changes' : 'Save & get my code';
    }
  }, { signal: signal() });

  sync();
}

async function deleteSetup(code) {
  if (!confirm(`Delete setup ${code}? Stations will no longer find it. This can't be undone.`)) return;
  try {
    await api(`/api/profiles/${code}`, { method: 'DELETE', headers: { 'X-Edit-Key': keys.get(code) || '' } });
    keys.remove(code); storage.del(draftKey(code));
    toast(`Setup ${code} deleted`);
    location.hash = '#/';
  } catch (e) { toast(e.message); }
}

// Approximate CS2 crosshair: settings are pixels at 1080p, magnified 3x.
function drawCrosshair(canvas, c) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, mid = W / 2, k = 3;
  ctx.clearRect(0, 0, W, W);
  const bg = canvas.parentElement.dataset.bg;
  ctx.fillStyle = bg === 'dark' ? '#2c3440' : bg === 'sky' ? '#9ec3e6' : 'transparent';
  ctx.fillRect(0, 0, W, W);
  const n = (v) => Number(v) || 0;
  const color = `rgba(${n(c.r)},${n(c.g)},${n(c.b)},${n(c.a) / 255})`, black = `rgba(0,0,0,${n(c.a) / 255})`;
  const t = Math.max(1, n(c.thickness)) * k, len = n(c.length) * k, gap = n(c.gap) * k, o = c.outline ? k : 0;
  const t0 = Math.round(mid - t / 2);
  const bars = [];
  if (c.style === 1 || c.style === 3) {          // circles
    const r = Math.max(gap, 0) + len / 2;
    const passes = o ? [[t + 2 * o, black], [t, color]] : [[t, color]];   // outline pass only when enabled
    for (const [w, stroke] of passes) { ctx.strokeStyle = stroke; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(mid, mid, r, 0, Math.PI * 2); ctx.stroke(); }
  } else if (c.style === 8) {                    // square
    const h = Math.max(gap, 0) + len;
    bars.push([mid - h, mid - h, 2 * h, t], [mid - h, mid + h - t, 2 * h, t], [mid - h, mid - h, t, 2 * h], [mid + h - t, mid - h, t, 2 * h]);
  } else if (c.style !== 6) {                    // crosses and quads
    bars.push([t0, mid + gap, t, len], [mid - gap - len, t0, len, t], [mid + gap, t0, len, t]);
    if (!c.tStyle) bars.push([t0, mid - gap - len, t, len]);   // T style hides the top bar
  }
  if (c.dot || c.style === 6) bars.push([t0, t0, t, t]);
  const shown = bars.filter(([, , w, h]) => w > 0 && h > 0);
  if (o) { ctx.fillStyle = black; for (const [x, y, w, h] of shown) ctx.fillRect(x - o, y - o, w + 2 * o, h + 2 * o); }
  ctx.fillStyle = color;
  for (const [x, y, w, h] of shown) ctx.fillRect(x, y, w, h);
}

// ------------------------------------------------------------------ result, load, view

// A link the player can copy by hand when the clipboard is unavailable (plain HTTP).
const copyBox = (id, value) => `<input class="copybox" id="${id}" type="text" readonly value="${esc(value)}" aria-label="Edit link">`;

async function doneView(code) {
  if (!(await current(infoReady))) return;
  const key = keys.get(code);
  const editLink = `${info.url}/#/p/${code}?k=${key}`;
  const unsaved = key && !keys.isStored(code);
  view.innerHTML = `<div class="result">
    <div class="label">Your setup code</div>
    <div class="code" aria-label="Code ${code.split('').join(' ')}">${fmtCode(code)}</div>
    <p class="hint">Screenshot this. Type it on any PC running Loadout.</p>
    ${info.reachable ? '' : '<div class="callout warn" role="alert"><b>This server is only reachable from this computer.</b><p class="hint" style="margin:6px 0 0">The QR code will not open on a phone. Ask the admin for the event address.</p></div>'}
    <figure class="qr"><img src="/api/profiles/${code}/qr.svg" alt="QR code that opens setup ${code}"><figcaption>Scan to open this setup on another phone</figcaption></figure>
    <div class="actions">
      <a class="btn" href="#/edit/${code}">Edit</a>
      <a class="btn" href="/api/profiles/${code}/cfg">Download .cfg</a>
    </div>
    ${key ? `<div class="callout ${unsaved ? 'warn' : ''}"><b>${unsaved ? "This browser couldn't save your edit link." : 'Your private edit link'}</b>
      <p class="hint" style="margin:6px 0 10px">${unsaved ? 'Copy it now: without it you cannot change this setup later.' : 'It lets anyone change this setup, so keep it to yourself. It is already saved on this device; copy it to edit from another phone.'}</p>
      <div class="actions"><button class="btn small" id="copyEdit">Copy edit link</button></div><div id="copyFallback"></div></div>` : ''}
    <div class="callout"><b>At the tournament PC</b><ol>
      <li>Open <b>Loadout</b> on the PC (the admin will have it on screen).</li>
      <li>Type <b>${code}</b> and press Load.</li>
      <li>Press <b>Launch CS2</b>. Already in game? Type <code>exec cssetup</code> in the console.</li>
      <li>When you're done, press <b>reset this PC</b> for the next player.</li></ol></div>
  </div>`;
  view.querySelector('#copyEdit')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(editLink); toast('Edit link copied'); }
    catch {
      const box = view.querySelector('#copyFallback');
      const how = matchMedia('(pointer: coarse)').matches ? 'press and hold it, then Copy' : 'press Ctrl+C (⌘C on a Mac)';
      box.innerHTML = `<p class="hint" style="margin:10px 0 6px">The link is selected below: ${how}.</p>${copyBox('editLinkBox', editLink)}`;
      box.querySelector('input').select();
    }
  }, { signal: signal() });
}

function loadView() {
  view.innerHTML = `<div class="loadbox">
    <h1>Enter a code</h1><p class="hint">See a setup, edit yours, or copy a friend's as a starting point.</p>
    <label for="code" class="sr-only">6-digit setup code</label>
    <input id="code" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="000000" aria-describedby="err">
    <p class="error" id="err" role="alert"></p>
    <button class="btn primary" id="go" style="width:100%">Open</button></div>`;
  const input = view.querySelector('#code');
  const go = () => { const c = input.value.replace(/\D/g, ''); if (c.length === 6) location.hash = `#/p/${c}`; else view.querySelector('#err').textContent = 'Codes are 6 digits.'; };
  input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); view.querySelector('#err').textContent = ''; });
  input.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  view.querySelector('#go').addEventListener('click', go);
  input.focus();
}

async function profileView(code) {
  const message = flash; flash = '';
  view.innerHTML = '<p class="hint">Loading…</p>';
  let data, cfg;
  try {
    const got = await current(Promise.all([api(`/api/profiles/${code}`, { signal: signal() }), fetch(`/api/profiles/${code}/cfg`, { signal: signal() })
      .then(async (r) => (r.ok ? r.text() : { error: (await r.json().catch(() => ({}))).error || `Config unavailable (${r.status})` }))]));
    if (!got) return;
    [data, cfg] = got.value;
  } catch (e) { view.innerHTML = `<div class="loadbox"><h1>Not found</h1><p class="error">${esc(e.message)}</p><a class="btn" href="#/load">Try another code</a></div>`; return; }
  const p = data.profile, mine = !!keys.get(code);
  const stat = (v, l) => `<div class="stat"><b>${esc(v)}</b><span>${l}</span></div>`;
  const vm = p.viewmodel;
  view.innerHTML = `
    ${message ? `<div class="callout ${/not|could/.test(message) ? 'warn' : ''}" role="status" style="margin:0 0 18px;max-width:none">${esc(message)}</div>` : ''}
    <div class="label" style="color:var(--muted);letter-spacing:.14em;font-size:13px">SETUP ${code}</div>
    <h1 style="margin:6px 0 4px">${esc(p.name)}</h1><p class="hint" style="margin:0">${esc(p.team || '')}</p>
    <div class="profile">
      <div class="preview small"><canvas id="xc" width="220" height="220" role="img" aria-label="Crosshair preview"></canvas></div>
      <div class="summary">
        ${stat(Math.round(p.mouse.dpi * p.mouse.sensitivity), `eDPI · ${p.mouse.dpi} DPI × ${p.mouse.sensitivity}`)}
        ${stat(`${p.video.width}×${p.video.height}`, `${esc(p.video.aspect)} ${esc(p.video.scaling)}${p.video.apply ? '' : ' (not applied)'}`)}
        ${stat(`FOV ${vm.fov}`, `viewmodel offsets ${vm.offsetX} / ${vm.offsetY} / ${vm.offsetZ}`)}
        ${stat(p.binds.length, p.binds.length === 1 ? 'custom bind' : 'custom binds')}
      </div>
    </div>
    ${p.binds.length ? `<ul class="bindlist">${p.binds.map((b) => `<li><kbd>${esc(b.key)}</kbd> ${esc(b.command)}</li>`).join('')}</ul>` : ''}
    <div class="actions" style="margin:18px 0">
      ${mine ? `<a class="btn primary" href="#/edit/${code}">Edit</a><a class="btn" href="#/done/${code}">Show code & QR</a>` : '<button class="btn primary" id="copy">Use as my starting point</button>'}
      <a class="btn" href="/api/profiles/${code}/cfg">Download .cfg</a>
    </div>
    ${typeof cfg === 'string' ? `<details class="rawcfg"><summary>Show the config file</summary><pre class="cfg">${esc(cfg)}</pre></details>` : `<div class="callout warn"><b>Needs saving again</b><p class="hint" style="margin:6px 0 0">${esc(cfg.error)}${mine ? ' Press Edit, fix anything marked, and save.' : ''}</p></div>`}`;
  drawCrosshair(view.querySelector('#xc'), p.crosshair);
  view.querySelector('#copy')?.addEventListener('click', () => {
    const copy = clone(p); copy.name = ''; copy.team = ''; copy.copiedFrom = code;
    storage.put(draftKey(null), copy);
    location.hash = '#/new';
  }, { signal: signal() });
}

async function stationDoc() {
  if (!(await current(infoReady))) return;
  const url = info.url;
  view.innerHTML = `<div class="doc">
    <h1>Set up the tournament PCs</h1>
    <p>Each PC runs the Loadout window. Players type their code; it writes their CS2 config, sets their resolution and Windows mouse, and starts CS2. Reset puts the PC back as it was.</p>
    ${info.reachable ? '' : '<div class="callout warn" role="alert"><b>This server is only reachable from this computer.</b> Start it with <code>PUBLIC_URL</code> set to an address the PCs and phones can reach.</div>'}

    <h2>Before the event, on each PC</h2>
    <ol class="checklist">
      <li>Sign in to the PC's Steam account and <b>turn Steam Cloud off for CS2</b> (Steam → CS2 → Properties → General). Otherwise CS2 uploads each player's settings and a reset PC gets them back.</li>
      <li>Start CS2 once and quit, so its settings files exist.</li>
      <li>Set every station mouse to the same DPI and polling rate (for example 800 DPI). For stretched 4:3, set GPU scaling to full-screen in the NVIDIA or AMD control panel. Turn Speed Tap / SOCD off on the keyboards.</li>
      <li><a class="btn primary small" href="/station.cmd">Download Loadout.cmd</a> and put it on the desktop. Then open a command prompt there and run:
        <pre class="cfg">Loadout.cmd -MouseDpi 800 -ConfirmCloudOff
Loadout.cmd -Check</pre>
        <code>-Check</code> lists anything still missing (exit code 2 when the PC is not ready). If Windows shows “Windows protected your PC”, choose More info → Run anyway.</li>
      <li>Test it: double-click Loadout.cmd, load a test code, press Launch CS2, check the settings, quit CS2, then press <b>Done playing — reset this PC</b>.</li>
    </ol>
    <p class="hint">Loadout.cmd points at <code>${esc(url)}</code> and only accepts station updates and setups signed by this server's key <b>${esc(info.fingerprint)}</b>; the Loadout window shows the same key. Download it from a trusted network, or serve Loadout over HTTPS.</p>

    <h2>During the event</h2>
    <ul>
      <li>Leave the Loadout window open. Players type their code, press Load setup, then Launch CS2.</li>
      <li>After each match, the player (or staff) presses <b>Done playing — reset this PC</b>.</li>
      <li>If the server goes down, setups a PC has loaded before still load from its signed cache. To cache registered players' setups in advance: <code>Loadout.cmd -Prefetch 123456,234567</code> (or a text file of codes).</li>
    </ul>

    <details class="tech"><summary><h2>What the station changes</h2></summary>
    <ul>
      <li><code>game\\csgo\\cfg\\cssetup.cfg</code>: the player's settings, starting from CS2's default binds. <code>autoexec.cfg</code> gets one <code>exec cssetup</code> line, and Launch CS2 also passes <code>+exec cssetup</code>.</li>
      <li>A crosshair share code goes to the clipboard: CS2 only accepts codes through Settings → Game → Crosshair → Import.</li>
      <li><code>cs2_video.txt</code> under each Steam account's <code>userdata\\…\\730</code>: resolution, aspect ratio, display mode, refresh rate.</li>
      <li>Windows pointer speed and Enhance Pointer Precision (applies immediately).</li>
    </ul>
    <p>The first load saves the original files and mouse settings in <code>%LOCALAPPDATA%\\CSSetup\\baseline</code>. Every load starts from that baseline, so nothing from the previous player carries over, and a failed load puts it back.</p>
    <p>Not possible from the station: mouse DPI and polling rate, keyboard actuation and Rapid Trigger (stored on the devices; on ASUS ROG gear use Armoury Crate or the device's own controls), and GPU scaling.</p>
    <pre class="cfg">Loadout.cmd -MouseDpi 800          # once per PC: the station mouse's DPI
Loadout.cmd -Check                 # is this PC ready?
Loadout.cmd -Code 123456 -Launch   # load a setup and start CS2
Loadout.cmd -Reset                 # restore the station
Loadout.cmd -SaveBaseline          # capture this PC now (after preparing it)
Loadout.cmd -Prefetch codes.txt    # cache setups for outages</pre>
    </details>
  </div>`;
}

route();
