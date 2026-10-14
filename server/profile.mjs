// Profile schema: every field is checked here, so cfg and station output only
// ever contain allowlisted commands with checked values. Ranges and defaults
// follow the CS2 convar dump of 2026-10-05 (docs/cs2-reference.md).
import { KEY_NAME, checkBindCommand, checkCfgLine, stripComment } from '../web/rules.js';
import { NUMBERS, BOOLEANS, CHOICES, SHARE_CODE } from '../web/schema.js';

export { NUMBERS, BOOLEANS, CHOICES };

export class ValidationError extends Error {
  constructor(message, field) { super(message); this.field = field; }
}

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const set = (obj, path, value) => {
  const keys = path.split('.'); const last = keys.pop();
  let o = obj; for (const k of keys) o = (o[k] ??= {});
  o[last] = value;
};

const text = (value, field, max) => {
  if (value == null) return '';
  if (typeof value !== 'string') throw new ValidationError(`${field} must be text`, field);
  const clean = value.replace(/[\u0000-\u001f\u007f"]/g, '').trim();
  if (clean.length > max) throw new ValidationError(`${field} is longer than ${max} characters`, field);
  return clean;
};

export function normalizeProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('Profile must be an object');
  const out = {
    version: 2,
    name: text(input.name, 'name', 40) || 'Player',
    team: text(input.team, 'team', 40),
  };

  for (const [path, [min, max, fallback, integer]] of Object.entries(NUMBERS)) {
    const raw = get(input, path);
    if (raw === undefined || raw === null || raw === '') { set(out, path, fallback); continue; }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new ValidationError(`${path} must be between ${min} and ${max}`, path);
    }
    set(out, path, integer ? Math.round(value) : Math.round(value * 10000) / 10000);
  }
  for (const [path, fallback] of Object.entries(BOOLEANS)) {
    const raw = get(input, path);
    set(out, path, raw === undefined ? fallback : raw === true);
  }
  for (const [path, options] of Object.entries(CHOICES)) {
    const raw = get(input, path);
    if (raw === undefined) { set(out, path, options[0]); continue; }
    if (!options.includes(raw)) throw new ValidationError(`${path} must be one of ${options.join(', ')}`, path);
    set(out, path, raw);
  }

  const shareCode = text(get(input, 'crosshair.shareCode'), 'crosshair.shareCode', 40);
  if (shareCode && !SHARE_CODE.test(shareCode)) {
    throw new ValidationError('Crosshair code should look like CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx', 'crosshair.shareCode');
  }
  out.crosshair.shareCode = shareCode;

  const binds = Array.isArray(input.binds) ? input.binds : [];
  if (binds.length > 60) throw new ValidationError('At most 60 binds', 'binds');
  out.binds = binds.map((bind, i) => {
    const key = String(bind?.key ?? '').trim().toLowerCase();
    const command = String(bind?.command ?? '').trim();
    if (!KEY_NAME.test(key)) throw new ValidationError(`Bind ${i + 1}: "${key}" is not a CS2 key name`, `binds.${i}.key`);
    const problem = checkBindCommand(command);
    if (problem) throw new ValidationError(`Bind ${i + 1}: ${problem}`, `binds.${i}.command`);
    return { key, command };
  });

  // Extra lines cover settings the form does not. One command per line.
  const rawExtra = input.extraCfg ?? '';
  if (typeof rawExtra !== 'string' || rawExtra.length > 8000) {
    throw new ValidationError('Extra commands must be text under 8000 characters', 'extraCfg');
  }
  const lines = rawExtra.split(/\r?\n/).map(stripComment).filter(Boolean);
  if (lines.length > 200) throw new ValidationError('At most 200 extra commands', 'extraCfg');
  lines.forEach((line, i) => {
    const problem = line.length > 200 ? 'line is too long' : checkCfgLine(line);
    if (problem) throw new ValidationError(`Extra line ${i + 1}: ${problem}`, 'extraCfg');
  });
  out.extraCfg = lines.join('\n');

  return out;
}
