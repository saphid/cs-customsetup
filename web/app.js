// CS Setup web app: build a profile, save it, get a 6-digit code.
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
  misc: { fpsMax: 0, showFps: false },
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

const keys = {
  all() { try { return JSON.parse(localStorage.getItem('cssetup.keys') || '{}'); } catch { return {}; } },
  get(code) { return this.all()[code]; },
  set(code, key) { const a = this.all(); a[code] = key; localStorage.setItem('cssetup.keys', JSON.stringify(a)); },
};
const draftKey = 'cssetup.draft.v2'; // v1 drafts used the pre-2026 crosshair fields

function toast(message) {
  const el = Object.assign(document.createElement('div'), { className: 'toast', textContent: message });
  document.body.append(el); setTimeout(() => el.remove(), 2200);
}

async function api(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `Request failed (${res.status})`), { field: body.field, status: res.status });
  return body;
}

// ------------------------------------------------------------------ routes

let pageListeners = new AbortController();

function route() {
  pageListeners.abort();             // drop the previous page's handlers
  pageListeners = new AbortController();
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
  if ((m = path.match(/^\/p\/(\d{6})$/))) {
    if (params.get('k')) { keys.set(m[1], params.get('k')); location.replace(`#/p/${m[1]}`); return; }
    return profileView(m[1]);
  }
  if ((m = path.match(/^\/edit\/(\d{6})$/))) return editExisting(m[1]);
  if ((m = path.match(/^\/done\/(\d{6})$/))) return doneView(m[1]);
  home();
}
window.addEventListener('hashchange', route);

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
      <div class="step"><b>1 · BUILD</b><p>Fill in your settings, or paste your autoexec or crosshair code. Takes two minutes.</p></div>
      <div class="step"><b>2 · SAVE</b><p>You get a 6-digit code and a QR code. Screenshot it.</p></div>
      <div class="step"><b>3 · SIT DOWN</b><p>Type the code into the CS Setup window on the PC. It writes your config, sets the Windows mouse, and launches CS2.</p></div>
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
  ['Drop bomb on N', 'n', 'drop'],
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

function rangeField(path, label, min, max, step, hint = '') {
  [min, max] = limits(path, min, max);
  return `<label class="field" data-field="${path}"><span>${label}</span>
    <div class="range"><input type="range" min="${min}" max="${max}" step="${step}" data-bind="${path}" data-num>
    <input type="number" min="${min}" max="${max}" step="${step}" data-bind="${path}" data-num></div>${hint ? `<small>${hint}</small>` : ''}</label>`;
}
const numField = (path, label, min, max, step, hint = '') => ([min, max] = limits(path, min, max), `<label class="field" data-field="${path}"><span>${label}</span>
  <input type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" data-bind="${path}" data-num>${hint ? `<small>${hint}</small>` : ''}</label>`);
const toggle = (path, label) => `<label class="toggle" data-field="${path}">${label}<input type="checkbox" data-bind="${path}"></label>`;
const seg = (path, options) => `<div class="seg" data-seg="${path}">${options.map(([v, l]) => `<button type="button" data-v="${v}">${l}</button>`).join('')}</div>`;

async function editExisting(code) {
  view.innerHTML = '<p class="hint">Loading…</p>';
  try { const data = await api(`/api/profiles/${code}`); editor(code, data.profile); }
  catch (e) { view.innerHTML = `<p class="error">${esc(e.message)}</p>`; }
}

function editor(code, profile) {
  let state = merge(DEFAULTS, profile || (code ? {} : JSON.parse(localStorage.getItem(draftKey) || 'null')) || {});
  view.innerHTML = `
    <h1 style="margin:8px 0 6px">${code ? `Edit setup ${code}` : 'Build your setup'}</h1>
    <p class="hint" style="color:var(--muted);margin:0 0 22px">Defaults are CS2's own. Change what matters to you; everything else stays stock.</p>

    <div class="section">
      <h2>Bring your existing config <button class="btn small" type="button" id="importBtn">Import</button></h2>
      <p class="hint">Paste your autoexec, a pro's config, or lines like <code>sensitivity 1.2</code>. We read sensitivity, crosshair, viewmodel, binds and more. Anything else goes into Extra commands.</p>
      <textarea id="importText" placeholder='sensitivity "1.1"&#10;cl_crosshairsize "1.5"&#10;bind "mwheeldown" "+jump"'></textarea>
      <div id="importResult" class="hint" style="margin:10px 0 0"></div>
    </div>

    <div class="section">
      <h2>Player</h2>
      <div class="grid">
        <label class="field" data-field="name"><span>Name or nickname</span><input type="text" maxlength="40" data-bind="name" placeholder="shown on the PC when it loads"></label>
        <label class="field" data-field="team"><span>Team (optional)</span><input type="text" maxlength="40" data-bind="team"></label>
      </div>
    </div>

    <div class="section">
      <h2>Mouse</h2>
      <p class="hint">Enter the DPI and sensitivity you play with. CS2 reads the mouse directly, so your aim depends only on DPI × sensitivity (eDPI). If the event PC's mouse runs at a different DPI, the station converts your sensitivity so your eDPI stays exactly the same.</p>
      <div class="grid">
        ${numField('mouse.dpi', 'Mouse DPI', 50, 32000, 50)}
        ${numField('mouse.sensitivity', 'Sensitivity', 0.01, 8, 0.01)}
        <div class="stat"><b id="edpi">—</b><span>eDPI (DPI × sens) · cm/360: <span id="cm360">—</span></span></div>
        ${numField('mouse.zoomSensitivity', 'Zoom sensitivity', 0.01, 3, 0.01, 'zoom_sensitivity_ratio, default 1')}
      </div>
      <h3 style="font-size:15px;margin:22px 0 10px">Windows mouse (desktop only)</h3>
      <div class="grid">
        ${rangeField('mouse.windowsPointerSpeed', 'Windows pointer speed', 1, 20, 1, '10 is the default (6/11)')}
        <div class="field" style="justify-content:flex-end;gap:8px">
          ${toggle('mouse.enhancePointerPrecision', 'Enhance pointer precision')}
          ${toggle('windows.applyMouse', 'Apply these on the PC')}
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Crosshair</h2>
      <p class="hint">Build it here, and/or paste a share code from CS2 (Settings → Game → Crosshair → Share). CS2 only accepts share codes through its Import button, so the station copies your code to the clipboard for you to paste.</p>
      <div class="xhair" id="xhairBuilder">
        <div class="preview" id="preview"><canvas id="xc" width="220" height="220"></canvas>
          <div class="bgs"><button type="button" data-bg="dust" style="background:#b08a63" aria-label="Sand background"></button><button type="button" data-bg="dark" style="background:#2c3440" aria-label="Dark background"></button><button type="button" data-bg="sky" style="background:#9ec3e6" aria-label="Sky background"></button></div></div>
        <div>
          <label class="field"><span>Style</span><select data-bind="crosshair.style" data-num>${STYLES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
          <div class="grid" style="margin-top:14px">
            ${rangeField('crosshair.length', 'Length (px at 1080p)', 0, 40, 1)}
            ${rangeField('crosshair.thickness', 'Thickness (px)', 0, 12, 1)}
            ${rangeField('crosshair.gap', 'Gap (px)', -10, 20, 1)}
            ${rangeField('crosshair.a', 'Opacity', 0, 255, 1)}
          </div>
          <div class="field" style="margin-top:14px"><span>Colour</span>
            <div class="colors" id="colors">${COLORS.map(([rgb, n]) => `<button type="button" title="${n}" aria-label="${n}" data-rgb="${rgb.join(',')}" style="background:rgb(${rgb.join(',')})"></button>`).join('')}
              <input type="color" id="customColor" aria-label="Custom colour" style="width:44px;height:34px;padding:2px;border-radius:9px;border:1px solid var(--line);background:var(--bg)"></div></div>
          <div class="field" style="margin-top:14px"><span>Outline</span>${seg('crosshair.outline', [['0', 'None'], ['1', 'Full'], ['2', 'Half']])}</div>
          <div class="grid" style="margin-top:14px">
            ${toggle('crosshair.dot', 'Centre dot')}
            ${toggle('crosshair.tStyle', 'T style')}
            ${toggle('crosshair.followRecoil', 'Follow recoil')}
          </div>
        </div>
      </div>
      <label class="field" data-field="crosshair.shareCode" style="margin-top:16px"><span>Crosshair share code (optional)</span>
        <input type="text" data-bind="crosshair.shareCode" placeholder="CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx" autocapitalize="off" spellcheck="false"></label>
    </div>

    <div class="section">
      <h2>Viewmodel</h2>
      <div class="grid">
        ${rangeField('viewmodel.fov', 'FOV', 60, 68, 1)}
        ${rangeField('viewmodel.offsetX', 'Offset X', -2.5, 2.5, 0.5)}
        ${rangeField('viewmodel.offsetY', 'Offset Y', -2, 2, 0.5)}
        ${rangeField('viewmodel.offsetZ', 'Offset Z', -2, 2, 0.5)}
      </div>
      <div class="chips"><button class="chip" type="button" data-vm="60,1,1,-1">CS2 default</button><button class="chip" type="button" data-vm="68,2.5,0,-1.5">Classic right</button><button class="chip" type="button" data-vm="68,2.5,2,-2">Wide (pro)</button><button class="chip" type="button" data-vm="68,1,-1,-2">Low and close</button></div>
    </div>

    <div class="section">
      <h2>Video ${toggle('video.apply', 'Apply on PC')}</h2>
      <p class="hint">Written into CS2's video file before launch. Stretched 4:3 also needs GPU scaling set to full-screen on the PC; the station will remind the admin.</p>
      <div class="chips" style="margin:0 0 16px">${RESOLUTIONS.map(([l, w, h, a, s], i) => `<button class="chip" type="button" data-res="${i}">${l}</button>`).join('')}</div>
      <div class="grid">
        ${numField('video.width', 'Width', 640, 7680, 1)}
        ${numField('video.height', 'Height', 480, 4320, 1)}
        ${numField('video.refreshRate', 'Refresh rate (Hz)', 0, 600, 1, '0 = let the PC choose')}
        <div class="field"><span>Aspect ratio</span>${seg('video.aspect', [['16:9', '16:9'], ['4:3', '4:3'], ['16:10', '16:10']])}</div>
        <div class="field"><span>Picture</span>${seg('video.scaling', [['native', 'Native'], ['stretched', 'Stretched'], ['black-bars', 'Bars']])}</div>
        <div class="field"><span>Display mode</span>${seg('video.mode', [['fullscreen', 'Fullscreen'], ['borderless', 'Borderless'], ['windowed', 'Window']])}</div>
      </div>
    </div>

    <div class="section">
      <h2>Binds</h2>
      <p class="hint">Only changes from CS2's defaults. Jumpthrow, snap-tap and null-bind scripts are blocked on official servers and most tournaments, so they're not offered.</p>
      <div class="binds" id="binds"></div>
      <div class="chips">${BIND_PRESETS.map(([l], i) => `<button class="chip" type="button" data-bp="${i}">+ ${l}</button>`).join('')}<button class="chip" type="button" id="addBind">+ Custom bind</button></div>
    </div>

    <div class="section">
      <h2>HUD, audio, performance</h2>
      <div class="grid">
        ${rangeField('hud.scale', 'HUD scale', 0.9, 1.1, 0.05)}
        ${rangeField('hud.radarScale', 'Radar map zoom', 0.25, 1, 0.05)}
        ${rangeField('hud.radarHudScale', 'Radar size', 0.8, 1.3, 0.05)}
        ${rangeField('audio.volume', 'Master volume', 0, 1, 0.05)}
        ${numField('misc.fpsMax', 'FPS limit', 0, 1000, 1, '0 = unlimited')}
        <div class="field" style="justify-content:flex-end;gap:8px">${toggle('hud.radarCentered', 'Radar always centred')}${toggle('hud.radarRotate', 'Radar rotates')}${toggle('misc.showFps', 'Show FPS')}</div>
      </div>
    </div>

    <div class="section">
      <h2>Extra commands</h2>
      <p class="hint">One per line, run after everything above: player settings (<code>cl_…</code>, <code>snd_…</code>, <code>viewmodel_…</code>, <code>hud_…</code> and similar), <code>bind</code> or <code>unbind</code>. Server, map, exec and alias commands are not allowed.</p>
      <label class="field" data-field="extraCfg"><textarea data-bind="extraCfg" placeholder="cl_draw_only_deathnotices 0"></textarea></label>
    </div>`;

  const bar = document.createElement('div');
  bar.className = 'savebar';
  bar.innerHTML = `<div class="inner"><div class="who" id="who"></div><div class="actions" style="align-items:center">
    <span class="error" id="saveError"></span><button class="btn primary" id="save">${code ? 'Save changes' : 'Save & get my code'}</button></div></div>`;
  document.body.append(bar);

  const $ = (s) => view.querySelector(s);
  const persistDraft = () => { if (!code) localStorage.setItem(draftKey, JSON.stringify(state)); };

  function sync() {
    for (const el of view.querySelectorAll('[data-bind]')) {
      const v = getPath(state, el.dataset.bind);
      if (el.type === 'checkbox') el.checked = !!v;
      else if (document.activeElement !== el) el.value = v ?? '';
    }
    for (const s of view.querySelectorAll('[data-seg]')) {
      const v = getPath(state, s.dataset.seg);
      s.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === String(v)));
    }
    const c = state.crosshair;
    view.querySelectorAll('[data-rgb]').forEach((b) => b.classList.toggle('on', b.dataset.rgb === [c.r, c.g, c.b].join(',')));
    $('#customColor').value = '#' + [c.r, c.g, c.b].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    const edpi = Math.round(state.mouse.dpi * state.mouse.sensitivity);
    $('#edpi').textContent = edpi || '—';
    // CS2 turns 0.022° per count: cm/360 = 360 / (0.022 × sens × DPI) × 2.54
    $('#cm360').textContent = edpi ? (360 / (state.mouse.yaw * edpi) * 2.54).toFixed(1) : '—';
    bar.querySelector('#who').textContent = `${state.name || 'Unnamed player'} · ${edpi} eDPI`;
    renderBinds();
    drawCrosshair($('#xc'), state.crosshair);
  }

  function renderBinds() {
    const box = $('#binds');
    if (box.contains(document.activeElement)) return;
    box.innerHTML = state.binds.length ? state.binds.map((b, i) => `<div class="bind">
      <input type="text" placeholder="key" value="${esc(b.key)}" data-bk="${i}" autocapitalize="off" spellcheck="false">
      <input type="text" placeholder="command" value="${esc(b.command)}" data-bc="${i}" autocapitalize="off" spellcheck="false">
      <button type="button" data-del="${i}" aria-label="Remove bind">✕</button></div>`).join('')
      : '<p class="hint" style="margin:0">No custom binds. CS2 defaults will be used.</p>';
  }

  view.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.bind) {
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if ('num' in el.dataset) v = el.value === '' ? '' : Number(el.value);
      setPath(state, el.dataset.bind, v);
      el.closest('.field')?.classList.remove('invalid');
    } else if (el.dataset.bk) state.binds[el.dataset.bk].key = el.value;
    else if (el.dataset.bc) state.binds[el.dataset.bc].command = el.value;
    else if (el.id === 'customColor') {
      const n = parseInt(el.value.slice(1), 16);
      Object.assign(state.crosshair, { r: n >> 16, g: (n >> 8) & 255, b: n & 255 });
    } else return;
    persistDraft(); sync();
  }, { signal: pageListeners.signal });
  view.addEventListener('change', (e) => { if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT') { persistDraft(); sync(); } }, { signal: pageListeners.signal });
  view.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.closest('[data-seg]')) { const path = t.closest('[data-seg]').dataset.seg; setPath(state, path, typeof getPath(DEFAULTS, path) === 'number' ? Number(t.dataset.v) : t.dataset.v); }
    else if (t.dataset.rgb) { const [r, g, b] = t.dataset.rgb.split(',').map(Number); Object.assign(state.crosshair, { r, g, b }); }
    else if (t.dataset.bg) $('#preview').dataset.bg = t.dataset.bg;
    else if (t.dataset.vm) { const [fov, x, y, z] = t.dataset.vm.split(',').map(Number); state.viewmodel = { fov, offsetX: x, offsetY: y, offsetZ: z }; }
    else if (t.dataset.res) { const [, w, h, a, s] = RESOLUTIONS[t.dataset.res]; Object.assign(state.video, { width: w, height: h, aspect: a, scaling: s }); }
    else if (t.dataset.bp) { const [, key, command] = BIND_PRESETS[t.dataset.bp]; state.binds = state.binds.filter((b) => b.key !== key).concat({ key, command }); }
    else if (t.id === 'addBind') { state.binds.push({ key: '', command: '' }); renderBinds(); persistDraft(); view.querySelector(`[data-bk="${state.binds.length - 1}"]`)?.focus(); return; }
    else if (t.dataset.del) state.binds.splice(+t.dataset.del, 1);
    else if (t.id === 'importBtn') {
      const { applied, extra, skipped, notes } = importConfig($('#importText').value, state);
      $('#importResult').textContent = (applied ? `Imported ${applied} setting${applied === 1 ? '' : 's'}${extra ? `, ${extra} into Extra commands` : ''}.` : 'Nothing recognised. Paste lines like: sensitivity "1.2"')
        + (skipped ? ` Skipped ${skipped} line${skipped === 1 ? '' : 's'} that can't run at a station.` : '') + (notes.length ? ` ${notes.join(' ')}` : '');
      if (applied) $('#importText').value = '';
    } else return;
    persistDraft(); sync();
  }, { signal: pageListeners.signal });
  view.addEventListener('focusout', (e) => { if (e.target.dataset.bk || e.target.dataset.bc) setTimeout(renderBinds); }, { signal: pageListeners.signal });

  bar.querySelector('#save').addEventListener('click', async () => {
    const btn = bar.querySelector('#save'), err = bar.querySelector('#saveError');
    err.textContent = ''; btn.disabled = true;
    view.querySelectorAll('.invalid').forEach((f) => f.classList.remove('invalid'));
    const payload = clone(state);
    payload.binds = payload.binds.filter((b) => b.key.trim() || b.command.trim());
    try {
      if (code) {
        await api(`/api/profiles/${code}`, { method: 'PUT', body: JSON.stringify(payload), headers: { 'X-Edit-Key': keys.get(code) || '' } });
        location.hash = `#/done/${code}`;
      } else {
        const res = await api('/api/profiles', { method: 'POST', body: JSON.stringify(payload) });
        keys.set(res.code, res.editKey);
        localStorage.removeItem(draftKey);
        location.hash = `#/done/${res.code}`;
      }
    } catch (e) {
      err.textContent = e.message;
      const field = e.field && view.querySelector(`[data-field="${e.field}"]`);
      if (field) { field.classList.add('invalid'); field.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    } finally { btn.disabled = false; }
  });

  sync();
}

// Approximate CS2 crosshair: settings are pixels at 1080p, magnified 3x.
function drawCrosshair(canvas, c) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, mid = W / 2, k = 3;
  ctx.clearRect(0, 0, W, W);
  const bg = canvas.parentElement.dataset.bg;
  ctx.fillStyle = bg === 'dark' ? '#2c3440' : bg === 'sky' ? '#9ec3e6' : 'transparent';
  ctx.fillRect(0, 0, W, W);
  const color = `rgba(${c.r},${c.g},${c.b},${c.a / 255})`, black = `rgba(0,0,0,${c.a / 255})`;
  const t = Math.max(1, c.thickness) * k, len = c.length * k, gap = c.gap * k, o = c.outline ? k : 0;
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

async function doneView(code) {
  const key = keys.get(code);
  const editLink = `${location.origin}/#/p/${code}?k=${key}`;
  view.innerHTML = `<div class="result">
    <div class="label">Your setup code</div>
    <div class="code">${fmtCode(code)}</div>
    <p style="color:var(--muted)">Screenshot this. Type it on any PC running CS Setup.</p>
    <div class="qr"><img src="/api/profiles/${code}/qr.svg" alt="QR code linking to setup ${code}"></div>
    <div class="actions">
      <a class="btn" href="#/edit/${code}">Edit</a>
      <a class="btn" href="/api/profiles/${code}/cfg">Download .cfg</a>
      ${key ? '<button class="btn" id="copyEdit">Copy edit link</button>' : ''}
    </div>
    <div class="callout"><b>At the tournament PC</b><ol>
      <li>Open <b>CS Setup</b> on the PC (the admin will have it on screen).</li>
      <li>Type <b>${code}</b> and press Load.</li>
      <li>Press <b>Launch CS2</b>. Already in game? Type <code>exec cssetup</code> in the console.</li>
      <li>When you're done, press <b>reset this PC</b> for the next player.</li></ol></div>
    ${key ? `<div class="callout warn"><b>Keep your edit link private.</b><p class="hint" style="margin:6px 0 0">Anyone with the 6-digit code can load your settings. Only the edit link (saved on this device) can change them.</p></div>` : ''}
  </div>`;
  view.querySelector('#copyEdit')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(editLink); toast('Edit link copied'); } catch { prompt('Copy this edit link', editLink); }
  });
}

function loadView() {
  view.innerHTML = `<div class="loadbox">
    <h1>Enter a code</h1><p class="hint" style="color:var(--muted)">See a setup, edit yours, or copy a friend's as a starting point.</p>
    <input id="code" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="000000">
    <p class="error" id="err"></p>
    <button class="btn primary" id="go" style="width:100%">Open</button></div>`;
  const input = view.querySelector('#code');
  const go = () => { const c = input.value.replace(/\D/g, ''); if (c.length === 6) location.hash = `#/p/${c}`; else view.querySelector('#err').textContent = 'Codes are 6 digits.'; };
  input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); if (input.value.length === 6) go(); });
  input.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  view.querySelector('#go').addEventListener('click', go);
  input.focus();
}

async function profileView(code) {
  view.innerHTML = '<p class="hint">Loading…</p>';
  let data, cfg;
  try {
    [data, cfg] = await Promise.all([api(`/api/profiles/${code}`), fetch(`/api/profiles/${code}/cfg`)
      .then(async (r) => (r.ok ? r.text() : { error: (await r.json().catch(() => ({}))).error || `Config unavailable (${r.status})` }))]);
  }
  catch (e) { view.innerHTML = `<div class="loadbox"><h1>Not found</h1><p class="error">${esc(e.message)}</p><a class="btn" href="#/load">Try another code</a></div>`; return; }
  const p = data.profile, mine = !!keys.get(code);
  const stat = (v, l) => `<div class="stat"><b>${esc(v)}</b><span>${l}</span></div>`;
  view.innerHTML = `
    <div class="label" style="color:var(--muted);letter-spacing:.14em;font-size:13px">SETUP ${code}</div>
    <h1 style="margin:6px 0 4px">${esc(p.name)}</h1><p class="hint" style="color:var(--muted);margin:0">${esc(p.team || '')}</p>
    <div class="summary">
      ${stat(Math.round(p.mouse.dpi * p.mouse.sensitivity), `eDPI · ${p.mouse.dpi} DPI × ${p.mouse.sensitivity}`)}
      ${stat(`${p.video.width}×${p.video.height}`, `${p.video.aspect} ${p.video.scaling}`)}
      ${stat(p.viewmodel.fov, `viewmodel ${p.viewmodel.offsetX} / ${p.viewmodel.offsetY} / ${p.viewmodel.offsetZ}`)}
      ${stat(p.binds.length, 'custom binds')}
    </div>
    <div class="actions" style="margin-bottom:18px">
      ${mine ? `<a class="btn primary" href="#/edit/${code}">Edit</a><a class="btn" href="#/done/${code}">Show code & QR</a>` : '<button class="btn primary" id="copy">Use as my starting point</button>'}
      <a class="btn" href="/api/profiles/${code}/cfg">Download .cfg</a>
    </div>
    ${typeof cfg === 'string' ? `<pre class="cfg">${esc(cfg)}</pre>` : `<div class="callout warn"><b>Needs saving again</b><p class="hint" style="margin:6px 0 0">${esc(cfg.error)}${mine ? ' Press Edit, fix anything marked, and save.' : ''}</p></div>`}`;
  view.querySelector('#copy')?.addEventListener('click', () => {
    const copy = clone(p); copy.name = ''; copy.team = '';
    localStorage.setItem(draftKey, JSON.stringify(copy));
    location.hash = '#/new';
  });
}

function stationDoc() {
  const origin = location.origin;
  view.innerHTML = `<div class="doc">
    <h1>Set up a station</h1>
    <p>Each tournament PC runs one PowerShell window. Players type their code; it writes their cfg, sets their resolution and Windows mouse, and starts CS2. Reset puts the PC back exactly as it was.</p>
    <h2>1. Get the station app</h2>
    <p><a class="btn primary" href="/station.cmd">Download CSSetup.cmd</a></p>
    <p>Put it anywhere on the PC (the desktop is fine) and double-click it. It already points at this server (<code>${esc(origin)}</code>) and fetches the latest station app each time it starts. If Windows shows “Windows protected your PC”, choose More info → Run anyway. Or start it from a command prompt:</p>
    <pre class="cfg">powershell -ExecutionPolicy Bypass -Command "irm ${esc(origin)}/station.ps1 -OutFile CSSetup.ps1; .\\CSSetup.ps1"</pre>
    <h2>2. What it changes</h2>
    <ul>
      <li><code>game\\csgo\\cfg\\cssetup.cfg</code>: the player's settings, starting from CS2's default binds. <code>autoexec.cfg</code> gets one <code>exec cssetup</code> line, and Launch CS2 also passes <code>+exec cssetup</code>.</li>
      <li>A crosshair share code goes to the clipboard: CS2 only accepts codes through Settings → Game → Crosshair → Import.</li>
      <li><code>cs2_video.txt</code> under each Steam account's <code>userdata\\…\\730</code>: resolution, aspect ratio, display mode.</li>
      <li>Windows pointer speed and Enhance Pointer Precision (applies immediately).</li>
    </ul>
    <p>The first load saves the original files and mouse settings in <code>%LOCALAPPDATA%\\CSSetup\\baseline</code>. Every load starts from that baseline, so nothing from the previous player carries over, and a failed load puts it back. <b>Done playing — reset this PC</b> restores it and removes files CS2 created since.</p>
    <h2>3. Event mice and keyboards</h2>
    <ul>
      <li>Set every station mouse to one DPI (for example 800) and start the station with <code>-MouseDpi 800</code> once; it remembers it. Each player's sensitivity is converted so their eDPI is unchanged. On ASUS ROG mice such as the Harpe Ace Mini, set the DPI in Armoury Crate or with the DPI button (stages 400/800/1600/3200 by default), and set the same polling rate on every station.</li>
      <li>Keyboards with Speed Tap / SOCD (ASUS ROG Falchion Ace HFX, ROG Strix Scope II; Fn + Tab toggles it on the Strix Scope II) must have it off: Valve blocks it on official servers and most tournaments ban it. Check it before each match; the station can't see keyboard settings.</li>
      <li>Actuation point and Rapid Trigger on magnetic-switch keyboards (Falchion Ace HFX) are stored on the keyboard; set them on its touch panel or in Armoury Crate if your rules allow them.</li>
    </ul>
    <h2>4. Things the station can't do</h2>
    <ul>
      <li>Stretched 4:3 needs GPU scaling set to full-screen in the NVIDIA or AMD control panel. Set that once per PC.</li>
      <li><b>Turn Steam Cloud off for CS2 on each station account</b> (Steam → CS2 → Properties → General). CS2 uploads settings to the account's cloud as soon as a cfg runs, so with cloud on, a reset PC gets the last player's settings back. A loaded player's settings always win either way, because <code>+exec cssetup</code> runs after the saved config (verified in CS2).</li>
    </ul>
    <h2>Command line</h2>
    <pre class="cfg">.\\CSSetup.ps1 -MouseDpi 800          # once per PC: the station mouse's DPI
.\\CSSetup.ps1 -Code 123456 -Launch   # load and start CS2
.\\CSSetup.ps1 -Reset                 # restore the station</pre>
  </div>`;
}

route();
