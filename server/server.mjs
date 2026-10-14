// HTTP server: profile API, generated cfg, QR codes, static web app, station script.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize, dirname } from 'node:path';
import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';
import { Store, StoreFullError } from './store.mjs';
import { Signer } from './signing.mjs';
import { normalizeProfile, ValidationError } from './profile.mjs';
import { buildCfg, stationBundle } from './cfg.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const webDir = join(root, 'web');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

const LOOPBACK = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?$/i;

// The first private IPv4 address of this machine, for links opened on other
// devices. Inside a container that address is the container's own, which
// phones cannot reach, so the image sets LOADOUT_IN_CONTAINER and needs PUBLIC_URL.
function lanAddress() {
  if (process.env.LOADOUT_IN_CONTAINER) return null;
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) return a.address;
  }
  return null;
}

// Per-client request budget over a sliding minute.
function limiter(limit) {
  const seen = new Map();
  return (client) => {
    const now = Date.now();
    const recent = (seen.get(client) || []).filter((t) => now - t < 60_000);
    if (recent.length >= limit) return false;
    recent.push(now); seen.set(client, recent);
    if (seen.size > 10_000) seen.clear();
    return true;
  };
}

export function createApp({ store, publicUrl, trustProxy = false, createLimit = 60, readLimit = 600,
  signer = new Signer(), lanHost = lanAddress } = {}) {
  const allowCreate = limiter(createLimit);
  const allowRead = limiter(readLimit);
  const qrCache = new Map();

  // Links for other devices (QR codes, the station script). A page opened as
  // localhost would hand out links to the phone or PC itself, so loopback
  // hosts are swapped for this machine's LAN address.
  const baseUrl = (req) => {
    if (publicUrl) return publicUrl.replace(/\/+$/, '');
    const host = String(req.headers.host || '');
    const lan = LOOPBACK.test(host) && lanHost();
    return `http://${lan ? lan + (host.match(/:\d+$/)?.[0] || '') : host}`;
  };

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
  // The last entry is the one the proxy added; earlier ones come from the client.
  const clientOf = (req) => (trustProxy && String(req.headers['x-forwarded-for'] || '').split(',').pop().trim())
    || req.socket.remoteAddress;

  // Signed responses: the station verifies X-Loadout-Signature with the key baked into it.
  const sendSigned = (res, body, type) => {
    const bytes = Buffer.from(body, 'utf8');
    send(res, 200, bytes, type, { 'X-Loadout-Signature': signer.sign(bytes) });
  };

  async function api(req, res, path, query) {
    if (path === '/api/health') return send(res, 200, { ok: true });
    // What the web app shows admins: the address other devices should use and the signing key fingerprint.
    if (path === '/api/info') {
      const url = baseUrl(req);
      return send(res, 200, { url, fingerprint: signer.fingerprint, reachable: !LOOPBACK.test(new URL(url).host) });
    }

    if (path === '/api/profiles' && req.method === 'POST') {
      if (!allowCreate(clientOf(req))) return send(res, 429, { error: 'Too many new setups from this device. Wait a minute and try again.' });
      const profile = normalizeProfile(await readJson(req));
      try {
        const { code, editKey } = store.create(profile);
        return send(res, 201, { code, editKey, profile });
      } catch (error) {
        if (error instanceof StoreFullError) return send(res, 503, { error: 'This server is full. Ask the event admin.' });
        throw error;
      }
    }

    const match = path.match(/^\/api\/profiles\/(\d{6})(?:\/(cfg|qr\.svg|station|verify))?$/);
    if (!match) return send(res, 404, { error: 'Not found' });
    const [, code, view] = match;
    if (!allowRead(clientOf(req))) return send(res, 429, { error: 'Too many requests. Wait a minute and try again.' });

    const found = store.get(code);
    if (!found) return send(res, 404, { error: 'No setup with that code' });
    const owner = () => store.canEdit(code, req.headers['x-edit-key']);

    if (!view && req.method === 'PUT') {
      if (!owner()) return send(res, 403, { error: 'This device does not have the edit link for this setup' });
      const profile = normalizeProfile(await readJson(req));
      store.update(code, profile);
      return send(res, 200, { code, profile });
    }
    if (!view && req.method === 'DELETE') {
      if (!owner()) return send(res, 403, { error: 'This device does not have the edit link for this setup' });
      store.delete(code);
      return send(res, 204, '');
    }
    // Checks an edit key before the web app stores it, so a wrong link never replaces a working one.
    if (view === 'verify' && req.method === 'POST') {
      return owner() ? send(res, 200, { ok: true }) : send(res, 403, { error: 'That edit link does not match this setup' });
    }
    if (req.method !== 'GET' || view === 'verify') return send(res, 405, { error: 'Method not allowed' });

    if (!view) return send(res, 200, { code, ...found });
    // The QR code only links to the profile page, so it never needs revalidation.
    if (view === 'qr.svg') {
      const target = `${baseUrl(req)}/#/p/${code}`;
      let svg = qrCache.get(target);
      if (!svg) {
        svg = await QRCode.toString(target, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
        if (qrCache.size > 2000) qrCache.clear();
        qrCache.set(target, svg);
      }
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
    // What the station asked for is part of the signed body, so a signed
    // response for another code, another DPI or an earlier request is refused.
    const nonce = /^[0-9a-f]{16,64}$/.test(query.get('nonce') || '') ? query.get('nonce') : '';
    const bundle = { ...stationBundle(profile, code, { stationDpi }), stationDpi: stationDpi || 0, nonce, issuedAt: new Date().toISOString() };
    return sendSigned(res, JSON.stringify(bundle), 'application/json; charset=utf-8');
  }

  // Server address for scripts: only URL characters, so it cannot break out of a quoted string.
  const scriptUrl = (req) => baseUrl(req).replace(/[^\w.:/\-\[\]]/g, '');

  async function station(req, res) {
    // The station script ships with this server's address and public key baked in.
    const template = await readFile(join(root, 'station', 'Loadout.ps1'), 'utf8');
    const script = template.replace('__SERVER_URL__', scriptUrl(req)).replace('__SIGNING_KEY__', signer.publicXml)
      .replace('__SIGNING_FP__', signer.fingerprint);
    res.setHeader('Content-Disposition', 'attachment; filename="Loadout.ps1"');
    sendSigned(res, script, 'text/plain; charset=utf-8');
  }

  // Double-click launcher: fetches the latest station script on every start,
  // keeps it only if its signature matches the key baked in here, and falls
  // back to the last verified copy when the server is unreachable.
  function stationCmd(req, res) {
    const url = scriptUrl(req);
    const update = [
      "$ErrorActionPreference = 'Stop'",
      "$f = Join-Path $env:LOADOUT_DIR 'Loadout.ps1'; $sig = \"$f.sig\"",
      '$rsa = New-Object Security.Cryptography.RSACryptoServiceProvider',
      `$rsa.FromXmlString('${signer.publicXml}')`,
      'function Test-Signed([byte[]]$bytes, [string]$signature) {',
      "  try { return [bool]$signature -and $rsa.VerifyData($bytes, 'SHA256', [Convert]::FromBase64String($signature)) } catch { return $false }",
      '}',
      'try {',
      `  $r = Invoke-WebRequest '${url}/station.ps1' -UseBasicParsing -TimeoutSec 10`,
      '  $bytes = $r.RawContentStream.ToArray(); $signature = [string]$r.Headers[\'X-Loadout-Signature\']',
      "  if (-not (Test-Signed $bytes $signature)) { throw 'the download failed its signature check' }",
      "  [IO.File]::WriteAllBytes(\"$f.download\", $bytes); [IO.File]::WriteAllText(\"$sig.download\", $signature)",
      '  Move-Item "$f.download" $f -Force; Move-Item "$sig.download" $sig -Force',
      '} catch {',
      `  Write-Host "Loadout: could not update the station app from ${url} ($($_.Exception.Message)). Using the copy downloaded earlier."`,
      '}',
      // The copy about to run must carry this server's signature, every time.
      "$ok = (Test-Path $f) -and (Test-Path $sig) -and (Test-Signed ([IO.File]::ReadAllBytes($f)) ([IO.File]::ReadAllText($sig).Trim()))",
      "if (-not $ok) { Write-Host 'Loadout: no verified copy of the station app on this PC. Download Loadout.cmd again from the admin page.'; exit 1 }",
    ].join('\n');
    const lines = [
      '@echo off',
      `rem Loadout station for ${url} (signing key ${signer.fingerprint})`,
      'set "LOADOUT_DIR=%~dp0"',
      // -EncodedCommand (UTF-16LE base64) avoids cmd.exe quoting rules entirely.
      `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${Buffer.from(update, 'utf16le').toString('base64')}`,
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
  const dbFile = process.env.DB_FILE || join(root, 'data', 'profiles.db');
  const store = new Store(dbFile, { maxProfiles: Number(process.env.MAX_PROFILES || 100_000) });
  const signer = new Signer(process.env.SIGNING_KEY_FILE || join(dirname(dbFile), 'signing-key.pem'));
  // Optional retention: delete setups neither saved nor loaded for this many days.
  const ttlDays = Number(process.env.PROFILE_TTL_DAYS || 0);
  if (ttlDays > 0) {
    const prune = () => { const n = store.prune(ttlDays); if (n) console.log(`Deleted ${n} setups unused for ${ttlDays} days`); };
    prune(); setInterval(prune, 86_400_000).unref();
  }
  createApp({
    store,
    signer,
    publicUrl: process.env.PUBLIC_URL,
    trustProxy: process.env.TRUST_PROXY === '1',
    createLimit: Number(process.env.CREATE_LIMIT || 60),
    readLimit: Number(process.env.READ_LIMIT || 600),
  }).listen(port, host, () => {
    console.log(`Loadout listening on http://${host}:${port}`);
    console.log(`Station signing key fingerprint: ${signer.fingerprint}`);
  });
}
