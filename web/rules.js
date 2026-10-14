// Console command allowlist shared by the server (validation) and the web
// importer. Anything not listed here never reaches a station's cfg.
// Settings come from web/cvars.js, generated from the CS2 convar dump.
import { CVARS } from './cvars.js';

// Commands a bind may run besides +/- actions, slots and settings.
const BIND_COMMANDS = new Set(['drop', 'lastinv', 'invprev', 'invnext', 'say', 'say_team', 'toggleconsole', 'player_ping',
  'buymenu', 'teammenu', 'showscores', 'messagemode', 'messagemode2', 'radio', 'radio1', 'radio2', 'radio3', 'use', 'kill',
  'callvote']);

export const KEY_NAME = /^[a-z0-9_]{1,16}$|^[`\-=[\];',./\\]$/;
const NUMBER = /^-?(\d+(\.\d*)?|\.\d+)$/;
// Text settings (radio wheel lines, map lists, bindings names) may hold any
// printable text except the quote and ';' that would end the command.
const TEXT = /^[^"';\u0000-\u001f\u007f]{0,256}$/;
const WORD = /^[\w.\-!?,:']{1,40}$/;

// Set only through the form: the station converts sensitivity to its mouse's
// DPI, which a second assignment in a bind or extra line would undo.
const FORM_ONLY = new Set(['sensitivity']);

export const isAllowedConvar = (name) => Object.hasOwn(CVARS, String(name).toLowerCase()) && !FORM_ONLY.has(String(name).toLowerCase());

// Drops a // comment, but not // inside a quoted value.
export function stripComment(line) {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (!quoted && line[i] === '/' && line[i + 1] === '/') return line.slice(0, i).trim();
  }
  return line.trim();
}

const unquote = (s) => String(s).replace(/^"(.*)"$/, '$1');

// Checks one value against the convar's type and range from the dump.
export function checkValue(name, raw) {
  const spec = isAllowedConvar(name) && CVARS[String(name).toLowerCase()];
  if (!spec) return FORM_ONLY.has(String(name).toLowerCase()) ? `set ${name} in the form, not here` : `"${name}" is not an allowed setting`;
  const value = unquote(raw);
  if (spec[0] === 'b') return /^(0|1|true|false)$/.test(value) ? null : `${name} must be 0 or 1`;
  if (spec[0] === 's') return TEXT.test(value) ? null : `${name} has unsupported characters`;
  if (!NUMBER.test(value)) return `${name} must be a number`;
  const n = Number(value), [, lo, hi] = spec;
  if ((lo != null && n < lo) || (hi != null && n > hi)) return `${name} must be between ${lo ?? '-∞'} and ${hi ?? '∞'}`;
  return null;
}

// A bind's command: one or more ';'-separated parts, each an action, a slot,
// an allowed command, or an allowed setting with a valid value. Nested
// bind/alias/exec and every unlisted command are refused.
export function checkBindCommand(command) {
  const text = String(command).trim();
  if (!text || text.length > 200 || /["\r\n]/.test(text)) return 'command must be 1-200 characters without quotes';
  for (const part of text.split(';')) {
    const [head, ...args] = part.trim().split(/\s+/);
    if (!head) continue;
    const h = head.toLowerCase();
    if (/^[+-][a-z0-9_]+$/.test(h) && !args.length) continue;
    if (/^slot\d{1,2}$/.test(h) && !args.length) continue;
    if (h === 'toggle') {          // toggle <setting> [value ...]
      if (args.length && isAllowedConvar(args[0]) && args.slice(1).every((v) => !checkValue(args[0], v))) continue;
      return 'toggle needs an allowed setting and valid values';
    }
    if (h === 'incrementvar') {    // incrementvar <setting> <min> <max> <step>
      if (args.length === 4 && isAllowedConvar(args[0]) && args.slice(1).every((v) => NUMBER.test(v))
        && !checkValue(args[0], args[1]) && !checkValue(args[0], args[2])) continue;
      return 'incrementvar needs an allowed setting, min, max and step';
    }
    if (BIND_COMMANDS.has(h) && args.every((a) => WORD.test(a))) continue;
    if (isAllowedConvar(h) && args.length === 1 && !checkValue(h, args[0])) continue;
    return `"${head}" is not allowed in a bind`;
  }
  return null;
}

const words = (text) => [...String(text).matchAll(/"[^"]*"|\S+/g)].map((m) => m[0]);

// One line of extra commands: "<setting> <value>", "bind <key> <command>" or
// "unbind <key>". Returns an error string, or null when the line is allowed.
export function checkCfgLine(line) {
  const [head = '', ...args] = words(line);
  const h = unquote(head).toLowerCase();
  if (h === 'bind') {
    if (args.length !== 2) return 'bind needs a key and a command';
    if (!KEY_NAME.test(unquote(args[0]).toLowerCase())) return `"${unquote(args[0])}" is not a CS2 key name`;
    return checkBindCommand(unquote(args[1]));
  }
  if (h === 'unbind') {
    return args.length === 1 && KEY_NAME.test(unquote(args[0]).toLowerCase()) ? null : 'unbind needs one key name';
  }
  if (!isAllowedConvar(h)) return FORM_ONLY.has(h) ? `set ${h} in the form, not here` : `"${h}" is not an allowed setting`;
  if (args.length !== 1) return `"${h}" needs exactly one value`;
  return checkValue(h, args[0]);
}
