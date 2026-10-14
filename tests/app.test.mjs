import http from 'node:http';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProfile, ValidationError } from '../server/profile.mjs';
import { buildCfg, stationBundle } from '../server/cfg.mjs';
import { Store } from '../server/store.mjs';
import { createApp } from '../server/server.mjs';
import { Signer } from '../server/signing.mjs';
import { checkBindCommand } from '../web/rules.js';
import { createPublicKey, createHash, verify } from 'node:crypto';
import { importConfig } from '../web/importer.js';
import { connect } from 'node:net';

// The PowerShell the launcher runs (it is passed as -EncodedCommand).
const launcherScript = (cmd) => Buffer.from(cmd.match(/-EncodedCommand (\S+)/)[1], 'base64').toString('utf16le');
const signedBy = (signer, bytes, sig) => verify('sha256', bytes, createPublicKey(signer.key), Buffer.from(sig, 'base64'));
const getRaw = (port, path, headers = {}) => new Promise((resolve, reject) => {
  http.get({ port, path, headers }, (r) => {
    const chunks = []; r.on('data', (d) => chunks.push(d)); r.on('end', () => resolve({ status: r.statusCode, headers: r.headers, body: Buffer.concat(chunks) }));
  }).on('error', reject);
});

test('empty profile gets CS2 defaults', () => {
  const p = normalizeProfile({});
  assert.equal(p.mouse.sensitivity, 1.25);
  assert.equal(p.mouse.windowsPointerSpeed, 10);
  assert.equal(p.mouse.enhancePointerPrecision, false);
  assert.equal(p.video.aspect, '16:9');
  assert.deepEqual(p.binds, []);
});

test('out-of-range and unsafe input is rejected with the field name', () => {
  const cases = [
    [{ mouse: { sensitivity: 50 } }, 'mouse.sensitivity'],
    [{ mouse: { dpi: 'abc' } }, 'mouse.dpi'],
    [{ video: { aspect: '21:9' } }, 'video.aspect'],
    [{ crosshair: { shareCode: 'CSGO-123' } }, 'crosshair.shareCode'],
    [{ binds: [{ key: 'mouse4', command: 'quit' }] }, 'binds.0.command'],
    [{ binds: [{ key: 'f', command: '+jump"; quit' }] }, 'binds.0.command'],
    [{ binds: [{ key: 'bad key', command: '+jump' }] }, 'binds.0.key'],
    [{ binds: [{ key: 'g', command: 'bind g quit' }] }, 'binds.0.command'],
    [{ binds: [{ key: 'g', command: 'alias x quit' }] }, 'binds.0.command'],
    [{ extraCfg: 'sv_cheats 1' }, 'extraCfg'],
    [{ extraCfg: 'cl_foo 1\nexec evil' }, 'extraCfg'],
    [{ extraCfg: 'say "hi"; quit' }, 'extraCfg'],
    [{ extraCfg: 'bind "f" "quit; exec evil"' }, 'extraCfg'],
    [{ extraCfg: 'bind "f" "bind g quit"' }, 'extraCfg'],
    [{ extraCfg: 'writekeybindings' }, 'extraCfg'],
    [{ extraCfg: 'host_writeconfig' }, 'extraCfg'],
    [{ extraCfg: 'cl_cloud_settings_enable 0' }, 'extraCfg'],
    [{ extraCfg: 'cl_radar_scale 1 2' }, 'extraCfg'],
    [{ extraCfg: 'cl_script_reload_code "evil"' }, 'extraCfg'],
    [{ binds: [{ key: 'g', command: 'cl_script_reload_code evil' }] }, 'binds.0.command'],
    [{ extraCfg: 'sensitivity "NaN"' }, 'extraCfg'],
    [{ extraCfg: 'sensitivity 9' }, 'extraCfg'],
    [{ extraCfg: 'cl_crosshairdot 5' }, 'extraCfg'],
    [{ extraCfg: 'cl_crosshairsize 2' }, 'extraCfg'],
    [{ binds: [{ key: 'g', command: 'incrementvar cl_radar_scale -inf inf nan' }] }, 'binds.0.command'],
    [{ binds: [{ key: 'g', command: 'toggle cl_radar_scale 0.4 7' }] }, 'binds.0.command'],
    [{ binds: [{ key: 'g', command: 'toggle sv_cheats 0 1' }] }, 'binds.0.command'],
    [{ extraCfg: 'cl_showfps 4' }, 'extraCfg'],
    [{ extraCfg: 'sensitivity "2"' }, 'extraCfg'],
    [{ binds: [{ key: 'g', command: 'sensitivity 2' }] }, 'binds.0.command'],
    [{ binds: [{ key: 'g', command: 'toggle sensitivity 1 2' }] }, 'binds.0.command'],
    [{ extraCfg: 'bind "g" "incrementvar sensitivity 1 3 0.5"' }, 'extraCfg'],
    [{ binds: [{ key: 'g', command: 'toggle cl_showfps 0 4' }] }, 'binds.0.command'],
    [{ extraCfg: 'name "station hijack"' }, 'extraCfg'],
    [{ extraCfg: 'password "x"' }, 'extraCfg'],
    [{ extraCfg: 'cl_quickinventory_filename "x.txt"' }, 'extraCfg'],
    [{ binds: [{ key: 'g', command: 'screenshot' }] }, 'binds.0.command'],
    [{ extraCfg: 'cl_radial_radio_tab_0_text_1 "a;quit"' }, 'extraCfg'],
    [{ mouse: { sensitivity: 9 } }, 'mouse.sensitivity'],
    [{ viewmodel: { fov: 54 } }, 'viewmodel.fov'],
    [{ hud: { scale: 0.85 } }, 'hud.scale'],
  ];
  for (const [input, field] of cases) {
    assert.throws(() => normalizeProfile(input), (e) => e instanceof ValidationError && e.field === field, JSON.stringify(input));
  }
});

test('allowed binds and extra lines pass', () => {
  const p = normalizeProfile({
    binds: [{ key: 'mouse4', command: '+voicerecord' }, { key: 'f', command: 'slot7' }, { key: 'h', command: 'toggle cl_radar_scale 0.4 1' },
      { key: 'k', command: 'say gg wp' }, { key: 'l', command: '+lookatweapon; cl_showfps 1' },
      { key: 'j', command: 'incrementvar cl_radar_scale 0.25 1 0.05' }],
    extraCfg: 'snd_mute_losefocus "0"\nbind "mouse5" "+voicerecord"\nunbind "capslock"\nr_fullscreen_gamma 2.2',
  });
  assert.equal(p.binds.length, 6);
  assert.equal(p.extraCfg.split('\n').length, 4);
});

test('cfg uses the 2026 crosshair convars and keeps share codes out of console commands', () => {
  const p = normalizeProfile({
    name: 'Tester', mouse: { sensitivity: 1.1, dpi: 400 },
    crosshair: { shareCode: 'CSGO-ABCDE-FGHJK-LMNOP-QRSTU-VWXYZ', length: 6, gap: -1, outline: 2, a: 200 },
    binds: [{ key: 'MWHEELDOWN', command: '+jump' }],
    extraCfg: '// comment\ncl_draw_only_deathnotices "0"\n',
  });
  const cfg = buildCfg(p, '482913');
  assert.match(cfg, /^binddefaults$/m);
  assert.ok(cfg.indexOf('binddefaults') < cfg.indexOf('bind "mwheeldown"'), 'defaults before player binds');
  assert.match(cfg, /^sensitivity "1.1"$/m);
  assert.doesNotMatch(cfg, /^apply_crosshair_code/m, 'development-only in release CS2');
  assert.match(cfg, /^\/\/ Share code: CSGO-ABCDE/m);
  assert.match(cfg, /^cl_crosshair_length "6"$/m);
  assert.match(cfg, /^cl_crosshair_gap "-1"$/m);
  assert.match(cfg, /^cl_crosshair_drawoutline "2"$/m);
  assert.match(cfg, /^cl_crosshaircolor_a "200"$/m);
  assert.ok(cfg.indexOf('cl_crosshair_screen_height') > cfg.indexOf('cl_crosshair_length'));
  for (const gone of ['cl_crosshairsize', 'cl_crosshairgap ', 'cl_crosshaircolor ', 'cl_crosshairusealpha', 'cl_crosshair_outlinethickness']) {
    assert.ok(!cfg.includes(gone), `${gone} no longer exists in CS2`);
  }
  assert.match(cfg, /^bind "mwheeldown" "\+jump"$/m);
  assert.match(cfg, /^cl_draw_only_deathnotices "0"$/m);
  assert.ok(cfg.includes('\r\n'), 'Windows line endings');
  assert.equal(stationBundle(p, '482913').crosshairCode, 'CSGO-ABCDE-FGHJK-LMNOP-QRSTU-VWXYZ');
});

test('station bundle maps video and Windows mouse settings', () => {
  const p = normalizeProfile({ video: { width: 1280, height: 960, aspect: '4:3', scaling: 'stretched' }, mouse: { windowsPointerSpeed: 8 } });
  assert.equal(stationBundle(p, '111111').crosshairCode, null);
  const b = stationBundle(p, '111111');
  assert.equal(b.video['setting.aspectratiomode'], 0);
  assert.equal(b.video['setting.defaultres'], 1280);
  assert.deepEqual(b.windowsMouse, { pointerSpeed: 8, enhancePointerPrecision: false });
  assert.ok(b.notes.some((n) => n.includes('GPU scaling')));
  const off = stationBundle(normalizeProfile({ video: { apply: false }, windows: { applyMouse: false } }), '111111');
  assert.equal(off.video, null);
  assert.equal(off.windowsMouse, null);
});

test('import reads autoexec lines, vcfg pairs, legacy crosshair values and share codes', () => {
  const state = normalizeProfile({});
  const { applied, extra, skipped, notes } = importConfig(`
    sensitivity "0.9"; zoom_sensitivity_ratio 1.1 // comment
    "cl_crosshairsize"		"2"
    cl_crosshair_gap "-2"
    cl_crosshaircolor 4
    bind "mouse5" "+voicerecord"
    bind "f" "bind g quit"
    apply_crosshair_code CSGO-ABCDE-FGHJK-LMNOP-QRSTU-VWXYZ
    cl_crosshairdot 1
    snd_mute_losefocus "0"
    viewmodel_fov 54
    rate 786432
    exec something
    writekeybindings
    sv_cheats 1`, state);
  assert.equal(state.mouse.sensitivity, 0.9);
  assert.equal(state.mouse.zoomSensitivity, 1.1);
  assert.equal(state.crosshair.length, 5, 'legacy size 2 -> 4.5 px, rounded');
  assert.equal(state.crosshair.gap, -2);
  assert.deepEqual([state.crosshair.r, state.crosshair.g, state.crosshair.b], [50, 250, 250]);
  assert.equal(state.crosshair.dot, true);
  assert.equal(state.viewmodel.fov, 60, 'clamped to the CS2 minimum');
  assert.equal(state.crosshair.shareCode, 'CSGO-ABCDE-FGHJK-LMNOP-QRSTU-VWXYZ');
  assert.deepEqual(state.binds, [{ key: 'mouse5', command: '+voicerecord' }]);
  assert.equal(state.extraCfg, 'snd_mute_losefocus "0"');
  assert.equal(extra, 1);
  assert.equal(skipped, 4, 'nested bind, exec, writekeybindings, sv_cheats');
  assert.equal(notes.length, 3, 'legacy sizes converted; fov adjusted; nested bind refused');
  assert.ok(notes.some((n) => n.startsWith('Binds not imported: f')));
  assert.equal(applied, 10);
  assert.doesNotThrow(() => normalizeProfile(state), 'imported state must save');
});

test('a malformed request target gets 400 and the server keeps running', async () => {
  const server = createApp({ store: new Store(':memory:'), lanHost: () => null }).listen(0);
  const port = server.address().port;
  try {
    const reply = await new Promise((resolve, reject) => {
      const socket = connect(port, '127.0.0.1', () => socket.write('GET http://[ HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'));
      let data = ''; socket.on('data', (d) => { data += d; }); socket.on('end', () => resolve(data)); socket.on('error', reject);
    });
    assert.match(reply, /^HTTP\/1.1 400/);
    assert.equal((await fetch(`http://127.0.0.1:${port}/%E0%A4%A`)).status, 400);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`)).status, 200);
  } finally { server.close(); }
});

test('creation limit is per client, using X-Forwarded-For only when trusted', async () => {
  for (const trustProxy of [false, true]) {
    const server = createApp({ store: new Store(':memory:'), lanHost: () => null, trustProxy, createLimit: 2 }).listen(0);
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (ip) => fetch(`${base}/api/profiles`, { method: 'POST', body: '{}', headers: { 'X-Forwarded-For': ip } }).then((r) => r.status);
    try {
      const statuses = [await post('10.0.0.1'), await post('10.0.0.1'), await post('10.0.0.2'), await post('10.0.0.1')];
      assert.deepEqual(statuses, trustProxy ? [201, 201, 201, 429] : [201, 201, 429, 429]);
    } finally { server.close(); }
  }
});

test('API: create, load, edit with key, cfg, QR, station bundle', async () => {
  const server = createApp({ store: new Store(':memory:'), lanHost: () => null }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const created = await fetch(`${base}/api/profiles`, { method: 'POST', body: JSON.stringify({ name: 'Ace', mouse: { sensitivity: 2 } }) });
    assert.equal(created.status, 201);
    const { code, editKey } = await created.json();
    assert.match(code, /^[1-9]\d{5}$/);

    const loaded = await (await fetch(`${base}/api/profiles/${code}`)).json();
    assert.equal(loaded.profile.name, 'Ace');

    const denied = await fetch(`${base}/api/profiles/${code}`, { method: 'PUT', body: JSON.stringify({ name: 'Hijack' }), headers: { 'X-Edit-Key': 'wrong' } });
    assert.equal(denied.status, 403);
    const edited = await fetch(`${base}/api/profiles/${code}`, { method: 'PUT', body: JSON.stringify({ name: 'Ace2' }), headers: { 'X-Edit-Key': editKey } });
    assert.equal(edited.status, 200);

    const cfg = await (await fetch(`${base}/api/profiles/${code}/cfg`)).text();
    assert.match(cfg, /Ace2/);
    const qr = await fetch(`${base}/api/profiles/${code}/qr.svg`);
    assert.match(await qr.text(), /^<svg/);
    const station = await (await fetch(`${base}/api/profiles/${code}/station`)).json();
    assert.equal(station.cfgName, 'cssetup');
    assert.equal((await fetch(`${base}/api/profiles/000000/station`)).status, 404);

    const bad = await fetch(`${base}/api/profiles`, { method: 'POST', body: JSON.stringify({ mouse: { sensitivity: -1 } }) });
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).field, 'mouse.sensitivity');

    const script = await (await fetch(`${base}/station.ps1`)).text();
    assert.ok(script.includes(`[string]$Server = '${base}'`));
    assert.ok(script.includes('<RSAKeyValue><Modulus>'), 'public key baked in');
    const cmd = await (await fetch(`${base}/station.cmd`)).text();
    assert.ok(cmd.split('\r\n').length > 5);
    assert.ok(launcherScript(cmd).includes(`Invoke-WebRequest "${base}/station.ps1?nonce=$nonce"`));
    assert.ok(launcherScript(cmd).includes("VerifyData($bytes, 'SHA256'"));
    assert.match(launcherScript(cmd), /^\$min = 3$/m, 'version floor baked in');
    // The launcher's version pattern must find the version in the script it downloads.
    const pattern = launcherScript(cmd).match(/\[regex\]::Match\([^,]+, '\(\?m\)(.+?)'\)/)[1];
    assert.equal(new RegExp(pattern, 'm').exec(script)?.[1], '3');
    // fetch() always sends the URL's host, so send a hostile Host header with node:http.
    const odd = (await getRaw(server.address().port, '/station.cmd', { Host: 'evil"&calc&%x%^|:1' })).body.toString();
    assert.ok(launcherScript(odd).includes('Invoke-WebRequest "http://evilcalcx:1/station.ps1?nonce=$nonce"'), odd);
    assert.ok(!/[&|^%"]calc/.test(odd));
    assert.equal((await fetch(`${base}/../package.json`)).status, 404);
  } finally {
    server.close();
  }
});

test('imports are brought into saveable ranges; invalid share codes are skipped', () => {
  const state = normalizeProfile({});
  const { skipped, notes } = importConfig(`cl_crosshair_gap -150
volume 5
m_yaw 0
zoom_sensitivity_ratio 0
viewmodel_offset_x -2.5
apply_crosshair_code invalid
sensitivity NaN`, state);
  assert.equal(state.crosshair.gap, -100);
  assert.equal(state.audio.volume, 1);
  assert.equal(state.mouse.yaw, 0.001);
  assert.equal(state.mouse.zoomSensitivity, 0.01);
  assert.equal(state.viewmodel.offsetX, -2);
  assert.equal(state.crosshair.shareCode, '');
  assert.equal(state.mouse.sensitivity, 1.25);
  assert.equal(skipped, 2);
  assert.ok(notes.some((n) => n.includes('5 values were outside')));
  assert.doesNotThrow(() => normalizeProfile(state));
});

test('generated allowlist covers every setting the cfg writes', async () => {
  const { CVARS } = await import('../web/cvars.js');
  const cfg = buildCfg(normalizeProfile({ binds: [{ key: 'f', command: 'slot7' }] }), '123456');
  const written = cfg.split('\r\n').map((l) => l.split(' ')[0]).filter((w) => /^[a-z_]+$/.test(w));
  const commands = new Set(['binddefaults', 'bind', 'echo', 'cl_crosshair_screen_height']);  // the last is hidden, written only by cfg.mjs
  for (const name of written) assert.ok(commands.has(name) || CVARS[name], `${name} missing from the CS2 allowlist`);
});

test('sensitivity is converted to the station mouse DPI, keeping eDPI', async () => {
  const p = normalizeProfile({ mouse: { dpi: 400, sensitivity: 2 } });
  assert.match(buildCfg(p, '123456', { stationDpi: 800 }), /^sensitivity "1"$/m);
  assert.match(buildCfg(p, '123456', { stationDpi: 400 }), /^sensitivity "2"$/m);
  const far = stationBundle(normalizeProfile({ mouse: { dpi: 3200, sensitivity: 4 } }), '123456', { stationDpi: 400 });
  assert.equal(far.sensitivity, 8);
  assert.equal(far.warnings.length, 1, 'eDPI 12800 cannot fit at 400 DPI');
  assert.ok(!far.notes.some((n) => n.includes(' = your ')), 'no equality claim when clamped');
  const fine = stationBundle(normalizeProfile({ mouse: { dpi: 400, sensitivity: 0.1 } }), '123456', { stationDpi: 32000 });
  assert.equal(fine.sensitivity, 0.00125, 'keeps 40 eDPI exactly');
  assert.equal(fine.warnings.length, 0);
  const floor = stationBundle(normalizeProfile({ mouse: { dpi: 400, sensitivity: 0.0001 } }), '123456', { stationDpi: 800 });
  assert.equal(floor.warnings.length, 1, 'clamped at the minimum is reported');

  const server = createApp({ store: new Store(':memory:'), lanHost: () => null }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const { code } = await (await fetch(`${base}/api/profiles`, { method: 'POST', body: JSON.stringify({ mouse: { dpi: 1600, sensitivity: 0.5 } }) })).json();
    const bundle = await (await fetch(`${base}/api/profiles/${code}/station?dpi=800`)).json();
    assert.equal(bundle.sensitivity, 1);
    assert.match(bundle.cfg, /^sensitivity "1"$/m);
    for (const bad of ['abc', '8e2', '0x320', '10']) {
      const ignored = await (await fetch(`${base}/api/profiles/${code}/station?dpi=${bad}`)).json();
      assert.equal(ignored.sensitivity, 0.5, bad);
    }
  } finally { server.close(); }
});

test('ordinary text settings pass', () => {
  const p = normalizeProfile({ extraCfg: [
    'cl_radial_radio_tab_0_text_1 "#Chatwheel_quiet"',
    'cl_scoreboard_mouse_enable_binding "+attack2"',
    'cl_inv_volatile_limits "0:0"',
    'cl_showfps 3',
    'cl_radial_radio_tab_0_text_2 "hello//world" // a comment',
  ].join('\n') });
  assert.equal(p.extraCfg.split('\n').length, 5);
  assert.ok(p.extraCfg.endsWith('cl_radial_radio_tab_0_text_2 "hello//world"'));
});

test('stored profiles that fail current rules are not served as cfg or station bundle', async () => {
  const store = new Store(':memory:');
  const { code } = store.create({ ...normalizeProfile({}), extraCfg: 'cl_script_reload_code "evil"' });  // saved under older rules
  const server = createApp({ store }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const view of ['cfg', 'station']) {
      const res = await fetch(`${base}/api/profiles/${code}/${view}`);
      assert.equal(res.status, 409, view);
      assert.doesNotMatch(await res.text(), /cl_script_reload_code/);
    }
    assert.equal((await fetch(`${base}/api/profiles/${code}`)).status, 200, 'still viewable for re-saving');
    assert.equal((await fetch(`${base}/api/profiles/${code}/qr.svg`)).status, 200, 'QR only links to the page');
  } finally { server.close(); }
});

test('PUBLIC_URL with a trailing slash still gives working station links', async () => {
  const server = createApp({ store: new Store(':memory:'), lanHost: () => null, publicUrl: 'http://lan.example:8080/' }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.ok(launcherScript(await (await fetch(`${base}/station.cmd`)).text()).includes('"http://lan.example:8080/station.ps1?nonce=$nonce"'));
    assert.ok((await (await fetch(`${base}/station.ps1`)).text()).includes("'http://lan.example:8080'"));
  } finally {
    server.close();
  }
});

test('binds: one held action, no release commands, only real actions', () => {
  for (const ok of ['+jump', 'slot7', '+lookatweapon; cl_showfps 1', 'toggle cl_radar_scale 0.4 1', 'say gg', 'drop']) {
    assert.equal(checkBindCommand(ok), null, ok);
  }
  for (const bad of ['+jump;-attack;-attack2', '+forward;-back', '+foo', '+jump;+duck', '-attack']) {
    assert.ok(checkBindCommand(bad), bad);
  }
  assert.throws(() => normalizeProfile({ extraCfg: 'bind "mouse5" "+jump;-attack"' }), ValidationError);
});

test('import reads CS2 key files, crosshair scale, display mode and FPS mode', () => {
  const state = normalizeProfile({});
  const { notes } = importConfig(`"config"
{
	"bindings"
	{
		"w"		"+forward"
		"MOUSE4"		"+voicerecord"
		"scancode26"		"slot8"
		"g"		"<unbound>"
		"mouse5"		"+jump;-attack"
	}
	"convars"
	{
		"cl_crosshair_length"		"4"
		"cl_crosshair_screen_height"		"720"
		"cl_showfps"		"3"
		"cl_crosshairgap"		"-1"
	}
}
"video.cfg"
{
	"setting.fullscreen"		"0"
	"setting.nowindowborder"		"1"
	"setting.refreshrate_numerator"		"239760"
	"setting.refreshrate_denominator"		"1000"
	"setting.shaderquality"		"1"
}`, state);
  assert.deepEqual(state.binds, [{ key: 'mouse4', command: '+voicerecord' }, { key: 'scancode26', command: 'slot8' }], 'defaults skipped');
  assert.equal(state.extraCfg, 'unbind "g"');
  assert.equal(state.crosshair.length, 6, '4 px at 720p = 6 px at 1080p');
  assert.equal(state.misc.showFps, 3);
  assert.equal(state.video.mode, 'borderless');
  assert.equal(state.video.refreshRate, 240);
  for (const text of ['old crosshair gap', 'Binds not imported: mouse5', '720p', 'graphics quality']) {
    assert.ok(notes.some((n) => n.includes(text)), text);
  }
  assert.doesNotThrow(() => normalizeProfile(state));
  assert.equal(normalizeProfile({ misc: { showFps: true } }).misc.showFps, 1, 'older true/false saves');
});

test('station script and bundles are signed; edit keys are verified; owners can delete', async () => {
  const signer = new Signer();
  const server = createApp({ store: new Store(':memory:'), lanHost: () => null, signer }).listen(0);
  const port = server.address().port, base = `http://127.0.0.1:${port}`;
  try {
    const { code, editKey } = await (await fetch(`${base}/api/profiles`, { method: 'POST', body: '{"name":"Sig"}' })).json();
    for (const path of ['/station.ps1', `/api/profiles/${code}/station?dpi=800`]) {
      const r = await getRaw(port, path);
      assert.ok(signedBy(signer, r.body, r.headers['x-loadout-signature']), path);
      assert.ok(!signedBy(signer, Buffer.concat([r.body, Buffer.from(' ')]), r.headers['x-loadout-signature']), 'tampering detected');
    }
    assert.ok((await getRaw(port, '/station.ps1')).body.toString().includes(signer.publicXml));
    // Freshness: a signature over the launcher's nonce and the script's hash.
    const fresh = await getRaw(port, '/station.ps1?nonce=00112233445566778899aabbccddeeff');
    const hash = createHash('sha256').update(fresh.body).digest('hex');
    assert.ok(signedBy(signer, Buffer.from(`00112233445566778899aabbccddeeff:${hash}`), fresh.headers['x-loadout-fresh']));
    assert.equal((await getRaw(port, '/station.ps1')).headers['x-loadout-fresh'], undefined);
    assert.match(signer.fingerprint, /^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
    assert.equal((await (await fetch(`${base}/api/info`)).json()).fingerprint, signer.fingerprint);

    const check = (key) => fetch(`${base}/api/profiles/${code}/verify`, { method: 'POST', headers: { 'X-Edit-Key': key } }).then((r) => r.status);
    assert.equal(await check(editKey), 200);
    assert.equal(await check('bogus'), 403);
    const del = (key) => fetch(`${base}/api/profiles/${code}`, { method: 'DELETE', headers: { 'X-Edit-Key': key } }).then((r) => r.status);
    assert.equal(await del('bogus'), 403);
    assert.equal(await del(editKey), 204);
    assert.equal((await fetch(`${base}/api/profiles/${code}`)).status, 404);
  } finally { server.close(); }
});

test('links handed to other devices never point at localhost', async () => {
  const server = createApp({ store: new Store(':memory:'), lanHost: () => '192.168.5.20' }).listen(0);
  const port = server.address().port;
  try {
    const info = JSON.parse((await getRaw(port, '/api/info', { Host: `localhost:${port}` })).body);
    assert.equal(info.url, `http://192.168.5.20:${port}`);
    assert.equal(info.reachable, true);
    const script = (await getRaw(port, '/station.ps1', { Host: `127.0.0.1:${port}` })).body.toString();
    assert.ok(script.includes(`'http://192.168.5.20:${port}'`));
  } finally { server.close(); }
});

test('reads are rate limited; the store has a size cap and retention', async () => {
  const server = createApp({ store: new Store(':memory:'), lanHost: () => null, readLimit: 3 }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await fetch(`${base}/api/profiles/123456`)).status);
    assert.deepEqual(statuses, [404, 404, 404, 429]);
  } finally { server.close(); }
  const store = new Store(':memory:', { maxProfiles: 1 });
  store.create(normalizeProfile({}));
  assert.throws(() => store.create(normalizeProfile({})), /limit/);
  store.db.exec("UPDATE profiles SET updated_at = '2020-01-01T00:00:00.000Z'");
  assert.equal(store.prune(30), 1);
  assert.equal(store.count(), 0);
});

test('import replaces what the profile had for each key it mentions', () => {
  const state = normalizeProfile({ binds: [{ key: 'w', command: 'slot7' }], extraCfg: 'bind "h" "slot9"' });
  importConfig(`unbind "g"
bind "g" "slot7"
"bindings"
{
	"scancode7"		"<unbound>"
	"w"		"+forward"
}
bind "h" "slot6"`, state);
  assert.deepEqual(state.binds, [{ key: 'g', command: 'slot7' }, { key: 'h', command: 'slot6' }], 'g: last mention wins; w back to its default');
  assert.equal(state.extraCfg, 'unbind "scancode7"', 'native unbind kept; stale bind/unbind lines removed');
});

test('a partial crosshair import rescales only what it set, and repeats identically', () => {
  const state = normalizeProfile({ crosshair: { thickness: 4, gap: 2 } });
  const text = 'cl_crosshair_length 4\ncl_crosshair_screen_height 720';
  importConfig(text, state);
  importConfig(text, state);
  assert.deepEqual([state.crosshair.length, state.crosshair.thickness, state.crosshair.gap], [6, 4, 2]);
});

test('station bundles name the code, station DPI and request nonce they answer', async () => {
  const server = createApp({ store: new Store(':memory:'), lanHost: () => null }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const { code } = await (await fetch(`${base}/api/profiles`, { method: 'POST', body: '{"mouse":{"dpi":400,"sensitivity":1}}' })).json();
    const b = await (await fetch(`${base}/api/profiles/${code}/station?dpi=800&nonce=0123456789abcdef`)).json();
    assert.deepEqual([b.code, b.stationDpi, b.nonce, b.sensitivity], [code, 800, '0123456789abcdef', 0.5]);
    const plain = await (await fetch(`${base}/api/profiles/${code}/station?nonce=bad`)).json();
    assert.deepEqual([plain.stationDpi, plain.nonce], [0, '']);
  } finally { server.close(); }
});

test('import treats scan codes, letter case and quoted lines as the same key', () => {
  const state = normalizeProfile({ extraCfg: 'unbind "scancode26"\n"bind" "h" "slot9"' });
  state.binds = [{ key: 'W', command: 'slot7' }];
  importConfig('bind "w" "+forward"\nbind "H" "slot6"', state);
  assert.deepEqual(state.binds, [{ key: 'h', command: 'slot6' }], 'w back to default; H replaces h');
  assert.equal(state.extraCfg, '', 'the scancode unbind for W and the quoted h bind are gone');
});
