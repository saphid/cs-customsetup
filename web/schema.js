// Profile schema shared by the server, the importer and the editor controls.
// Ranges and defaults follow the CS2 convar dump of 2026-10-05
// (docs/games/counter-strike-2.md).

// [min, max, default, integer]. A value outside the range is rejected, not
// clamped, so a typo never silently becomes a different sensitivity.
export const NUMBERS = {
  'mouse.dpi': [50, 32000, 800, true],
  'mouse.sensitivity': [0.0001, 8, 1.25],
  'mouse.zoomSensitivity': [0.01, 3, 1],
  'mouse.yaw': [0.001, 0.1, 0.022],
  'mouse.windowsPointerSpeed': [1, 20, 10, true],
  'crosshair.style': [0, 9, 4, true],
  'crosshair.length': [0, 255, 8, true],
  'crosshair.thickness': [0, 32, 2, true],
  'crosshair.gap': [-100, 100, 4, true],
  'crosshair.outline': [0, 2, 1, true],
  'crosshair.r': [0, 255, 0, true],
  'crosshair.g': [0, 255, 255, true],
  'crosshair.b': [0, 255, 0, true],
  'crosshair.a': [0, 255, 255, true],
  'viewmodel.fov': [60, 68, 60],
  'viewmodel.offsetX': [-2, 2.5, 1],
  'viewmodel.offsetY': [-2, 2, 1],
  'viewmodel.offsetZ': [-2, 2, -1],
  'video.width': [640, 7680, 1920, true],
  'video.height': [480, 4320, 1080, true],
  'video.refreshRate': [0, 600, 0, true],
  'audio.volume': [0, 1, 1],
  'hud.scale': [0.9, 1.1, 1],
  'hud.color': [0, 12, 0, true],
  'hud.radarScale': [0.25, 1, 0.7],
  'hud.radarHudScale': [0.8, 1.3, 1],
  'misc.fpsMax': [0, 1000, 0, true],
  'misc.showFps': [0, 3, 0, true],   // cl_showfps mode; older saves stored true/false (= 1/0)
};

export const BOOLEANS = {
  'mouse.enhancePointerPrecision': false,
  'crosshair.dot': false,
  'crosshair.tStyle': false,
  'crosshair.followRecoil': true,
  'hud.radarCentered': true,
  'hud.radarRotate': true,
  'windows.applyMouse': true,
  'video.apply': true,
};

export const CHOICES = {
  'video.aspect': ['16:9', '4:3', '16:10'],
  'video.mode': ['fullscreen', 'windowed', 'borderless'],
  'video.scaling': ['native', 'stretched', 'black-bars'],
};

export const SHARE_CODE = /^CSGO(-[ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789]{5}){5}$/;
