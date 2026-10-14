// Turns a normalized profile into a CS2 cfg file and a station bundle.

const q = (value) => `"${value}"`;
const ASPECT_MODE = { '4:3': 0, '16:9': 1, '16:10': 2 };

// CS2 reads the mouse directly, so in-game feel is sensitivity x DPI (eDPI).
// When the station's mouse runs at a different DPI, scaling the sensitivity
// keeps the player's eDPI, and so their cm/360, exactly the same.
export function stationSensitivity(p, stationDpi) {
  if (!stationDpi || stationDpi === p.mouse.dpi) return { sensitivity: p.mouse.sensitivity, converted: false, clamped: false };
  const exact = (p.mouse.sensitivity * p.mouse.dpi) / stationDpi;
  const clamped = exact < 0.0001 || exact > 8;
  // Six significant digits: well within CS2's float precision, so eDPI is kept.
  const sensitivity = Number(Math.min(8, Math.max(0.0001, exact)).toPrecision(6));
  return { sensitivity, converted: true, clamped };
}

export function buildCfg(p, code, { stationDpi } = {}) {
  const sens = stationSensitivity(p, stationDpi);
  const lines = [
    `// CS Setup profile ${code} for ${p.name}${p.team ? ` (${p.team})` : ''}`,
    '// Generated file. The station rewrites it on every load.',
    '',
    // A known starting point: CS2's default keys, then the player's binds.
    'binddefaults',
    '',
    '// Mouse',
    ...(sens.converted ? [`// ${p.mouse.sensitivity} at ${p.mouse.dpi} DPI, converted for this PC's ${stationDpi} DPI mouse`] : []),
    `sensitivity ${q(sens.sensitivity)}`,
    `zoom_sensitivity_ratio ${q(p.mouse.zoomSensitivity)}`,
    `m_yaw ${q(p.mouse.yaw)}`,
    '',
    '// Crosshair (sizes in pixels at 1080p)',
  ];
  const c = p.crosshair;
  if (c.shareCode) {
    // apply_crosshair_code is development-only in release CS2; the station
    // copies the code for Settings > Game > Crosshair > Import instead.
    lines.push(`// Share code: ${c.shareCode}`);
  }
  lines.push(
    `cl_crosshairstyle ${q(c.style)}`,
    `cl_crosshair_length ${q(c.length)}`,
    `cl_crosshair_thickness ${q(c.thickness)}`,
    `cl_crosshair_gap ${q(c.gap)}`,
    `cl_crosshair_drawoutline ${q(c.outline)}`,
    `cl_crosshaircolor_r ${q(c.r)}`,
    `cl_crosshaircolor_g ${q(c.g)}`,
    `cl_crosshaircolor_b ${q(c.b)}`,
    `cl_crosshaircolor_a ${q(c.a)}`,
    `cl_crosshairdot ${q(+c.dot)}`,
    `cl_crosshair_t ${q(+c.tStyle)}`,
    `cl_crosshair_recoil ${q(+c.followRecoil)}`,
    // Sizes above were authored at 1080p; set last because size changes update it.
    'cl_crosshair_screen_height "1080"',
  );
  lines.push(
    '',
    '// Viewmodel',
    `viewmodel_fov ${q(p.viewmodel.fov)}`,
    `viewmodel_offset_x ${q(p.viewmodel.offsetX)}`,
    `viewmodel_offset_y ${q(p.viewmodel.offsetY)}`,
    `viewmodel_offset_z ${q(p.viewmodel.offsetZ)}`,
    '',
    '// HUD, radar, audio, performance',
    `hud_scaling ${q(p.hud.scale)}`,
    `cl_hud_color ${q(p.hud.color)}`,
    `cl_radar_scale ${q(p.hud.radarScale)}`,
    `cl_hud_radar_scale ${q(p.hud.radarHudScale)}`,
    `cl_radar_always_centered ${q(+p.hud.radarCentered)}`,
    `cl_radar_rotate ${q(+p.hud.radarRotate)}`,
    `volume ${q(p.audio.volume)}`,
    `fps_max ${q(p.misc.fpsMax)}`,
    `cl_showfps ${q(+p.misc.showFps)}`,
  );
  if (p.binds.length) {
    lines.push('', '// Binds');
    for (const { key, command } of p.binds) lines.push(`bind ${q(key)} ${q(command)}`);
  }
  if (p.extraCfg) lines.push('', '// Extra commands', p.extraCfg);
  lines.push('', `echo "CS Setup: loaded profile ${code} (${p.name})"`, '');
  return lines.join('\r\n');
}

// What the Windows station needs: the cfg text plus settings it applies
// outside the game. Video values go into cs2_video.txt, which CS2 only reads
// at start-up.
export function stationBundle(p, code, { stationDpi } = {}) {
  const sens = stationSensitivity(p, stationDpi);
  const edpi = Math.round(p.mouse.dpi * p.mouse.sensitivity);
  return {
    code,
    name: p.name,
    team: p.team,
    cfgName: 'cssetup',
    cfg: buildCfg(p, code, { stationDpi }),
    sensitivity: sens.sensitivity,
    windowsMouse: p.windows.applyMouse ? {
      pointerSpeed: p.mouse.windowsPointerSpeed,
      enhancePointerPrecision: p.mouse.enhancePointerPrecision,
    } : null,
    video: p.video.apply ? {
      'setting.defaultres': p.video.width,
      'setting.defaultresheight': p.video.height,
      'setting.aspectratiomode': ASPECT_MODE[p.video.aspect],
      'setting.fullscreen': p.video.mode === 'fullscreen' ? 1 : 0,
      'setting.nowindowborder': p.video.mode === 'borderless' ? 1 : 0,
      ...(p.video.refreshRate ? { 'setting.refreshrate_numerator': p.video.refreshRate, 'setting.refreshrate_denominator': 1 } : {}),
    } : null,
    crosshairCode: p.crosshair.shareCode || null,
    warnings: sens.clamped
      ? [`Your ${edpi} eDPI does not fit CS2's sensitivity range on this ${stationDpi} DPI mouse: sensitivity ${sens.sensitivity} gives ${Math.round(sens.sensitivity * stationDpi * 100) / 100} eDPI. Ask the admin to change the mouse DPI.`] : [],
    notes: [
      ...(p.crosshair.shareCode
        ? ['Crosshair code copied: in CS2 open Settings > Game > Crosshair > Import and press Ctrl+V.'] : []),
      ...(p.video.apply && p.video.scaling === 'stretched'
        ? ['Stretched picture needs GPU scaling set to Full-screen (NVIDIA Control Panel > Adjust desktop size and position, or AMD GPU Scaling). Ask the admin if it shows black bars.'] : []),
      sens.converted && !sens.clamped
        ? `Sensitivity ${sens.sensitivity} on this ${stationDpi} DPI mouse = your ${p.mouse.sensitivity} at ${p.mouse.dpi} DPI (${edpi} eDPI).`
        : sens.clamped ? `Your setup: ${p.mouse.dpi} DPI x ${p.mouse.sensitivity} = ${edpi} eDPI.`
        : `Mouse: ${p.mouse.dpi} DPI x ${p.mouse.sensitivity} = ${edpi} eDPI.${stationDpi ? '' : ' Set the mouse to your DPI.'}`,
    ],
  };
}
