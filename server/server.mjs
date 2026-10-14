// HTTP server: profile API, generated cfg, QR codes, static web app, station script.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
import QRCode from 'qrcode';
import { Store } from './store.mjs';
import { normalizeProfile, ValidationError } from './profile.mjs';
import { buildCfg, stationBundle } from './cfg.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const webDir = join(root, 'web');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

export function createApp({ store, publicUrl, trustProxy = false, createLimit = 60 } = {}) {
  const creations = new Map(); // client -> timestamps, a light brake on scripted spam

  const baseUrl = (req) => (publicUrl || `http://${req.headers.host}`).replace(/\/+$/, '');

  const send = (res, status, body, type = 'application/json; charset=utf-8', extra = {}) => {
    const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', ...extra });
    res.end(data);
  };

  const readJson = async (req) => {
    let size = 0; const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 64 * 1024) throw new ValidationError('Profile is too large');
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
    catch { throw new ValidationError('Body is not valid JSON'); }
  };

  // Behind a reverse proxy every player shares the proxy's address, so the
  // client address comes from X-Forwarded-For only when the operator says so.
  const clientOf = (req) => (trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim())
    || req.socket.remoteAddress;

  const allowCreate = (client) => {
    const now = Date.now();
    const recent = (creations.get(client) || []).filter((t) => now - t < 60_000);
    if (recent.length >= createLimit) return false;
    recent.push(now); creations.set(client, recent);
    if (creations.size > 10_000) creations.clear();
    return true;
  };

  async function api(req, res, path, query) {
    if (path === '/api/health') return send(res, 200, { ok: true });

    if (path === '/api/profiles' && req.method === 'POST') {
      if (!allowCreate(clientOf(req))) return send(res, 429, { error: 'Too many new profiles; wait a minute' });
      const profile = normalizeProfile(await readJson(req));
      const { code, editKey } = store.create(profile);
      return send(res, 201, { code, editKey, profile });
    }

    const match = path.match(/^\/api\/profiles\/(\d{6})(?:\/(cfg|qr\.svg|station))?$/);
    if (!match) return send(res, 404, { error: 'Not found' });
    const [, code, view] = match;

    if (!view && req.method === 'PUT') {
      if (!store.get(code)) return send(res, 404, { error: 'No profile with that code' });
      if (!store.canEdit(code, req.headers['x-edit-key'])) return send(res, 403, { error: 'Edit key does not match' });
      const profile = normalizeProfile(await readJson(req));
      store.update(code, profile);
      return send(res, 200, { code, profile });
    }
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

    const found = store.get(code);
    if (!found) return send(res, 404, { error: 'No profile with that code' });
    if (!view) return send(res, 200, { code, ...found });
    // The QR code only links to the profile page, so it never needs revalidation.
    if (view === 'qr.svg') {
      const svg = await QRCode.toString(`${baseUrl(req)}/#/p/${code}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
      return send(res, 200, svg, 'image/svg+xml');
    }
    // Stored profiles are checked again against today's rules before anything
    // executable is generated, so a rule tightened later also covers old saves.
    let profile;
    try { profile = normalizeProfile(found.profile); }
    catch { return send(res, 409, { error: 'This setup was saved by an older version. Open it on your phone and save it again.' }); }
    // ?dpi= is the station mouse's DPI; the sensitivity is converted to match.
    const dpi = /^\d{2,5}$/.test(query.get('dpi') || '') ? Number(query.get('dpi')) : 0;
    const stationDpi = dpi >= 50 && dpi <= 32000 ? dpi : undefined;
    if (view === 'cfg') {
      return send(res, 200, buildCfg(profile, code, { stationDpi }), 'text/plain; charset=utf-8',
        { 'Content-Disposition': `attachment; filename="cssetup_${code}.cfg"` });
    }
    store.countLoad(code);
    return send(res, 200, stationBundle(profile, code, { stationDpi }));
  }

  async function station(req, res) {
    // The station script ships with this server's address baked in.
    const template = await readFile(join(root, 'station', 'Loadout.ps1'), 'utf8');
    const script = template.replace('__SERVER_URL__', baseUrl(req).replace(/'/g, ''));
    send(res, 200, script, 'text/plain; charset=utf-8', { 'Content-Disposition': 'attachment; filename="Loadout.ps1"' });
  }

  // Double-click launcher: fetches the latest station script on every start
  // (keeps the last copy when the server is unreachable) and runs it.
  function stationCmd(req, res) {
    const url = baseUrl(req).replace(/[^\w.:/\-\[\]]/g, '');
    const lines = [
      '@echo off',
      `rem Loadout station for ${url}`,
      'set "LOADOUT_DIR=%~dp0"',
      // Download to a temporary file and keep it only if it is a complete station script.
      'powershell -NoProfile -ExecutionPolicy Bypass -Command "$f = Join-Path $env:LOADOUT_DIR \'Loadout.ps1\'; $t = $f + \'.download\'; '
        + `try { Invoke-WebRequest '${url}/station.ps1' -OutFile $t -UseBasicParsing; `
        + "if (-not (Select-String -Path $t -Pattern '^# LOADOUT-END' -Quiet)) { throw 'incomplete' }; Move-Item $t $f -Force } "
        + `catch { Remove-Item $t -ErrorAction SilentlyContinue; if (-not (Test-Path $f)) { Write-Host 'Cannot reach ${url}'; exit 1 } }"`,
      'if errorlevel 1 (pause & exit /b 1)',
      'powershell -NoProfile -ExecutionPolicy Bypass -File "%LOADOUT_DIR%Loadout.ps1" %*',
      '',
    ];
    send(res, 200, lines.join('\r\n'), 'application/octet-stream', { 'Content-Disposition': 'attachment; filename="Loadout.cmd"' });
  }

  async function staticFile(res, path) {
    let rel;
    try { rel = normalize(decodeURIComponent(path === '/' ? '/index.html' : path)).replace(/^([/\\])+/, ''); }
    catch { return send(res, 400, 'Bad request', 'text/plain'); }
    if (rel.startsWith('..')) return send(res, 404, 'Not found', 'text/plain');
    try {
      const body = await readFile(join(webDir, rel));
      send(res, 200, body, types[extname(rel)] || 'application/octet-stream');
    } catch {
      send(res, 404, 'Not found', 'text/plain');
    }
  }

  return createServer(async (req, res) => {
    try {
      let path, query;
      try { ({ pathname: path, searchParams: query } = new URL(req.url, 'http://x')); } catch { return send(res, 400, { error: 'Bad request' }); }
      if (path.startsWith('/api/')) return await api(req, res, path, query);
      if (path === '/station.ps1') return await station(req, res);
      if (path === '/station.cmd') return stationCmd(req, res);
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
      return await staticFile(res, path);
    } catch (error) {
      if (error instanceof ValidationError) return send(res, 400, { error: error.message, field: error.field });
      console.error(error);
      return send(res, 500, { error: 'Server error' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '0.0.0.0';
  const store = new Store(process.env.DB_FILE || join(root, 'data', 'profiles.db'));
  createApp({
    store,
    publicUrl: process.env.PUBLIC_URL,
    trustProxy: process.env.TRUST_PROXY === '1',
    createLimit: Number(process.env.CREATE_LIMIT || 60),
  }).listen(port, host, () => {
    console.log(`Loadout listening on http://${host}:${port}`);
  });
}
