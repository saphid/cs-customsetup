// Profile storage: one SQLite file, 6-digit public load codes, secret edit keys.
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomInt, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const hash = (key) => createHash('sha256').update(key).digest();

export class Store {
  constructor(file) {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS profiles (
        code TEXT PRIMARY KEY,
        edit_hash BLOB NOT NULL,
        profile TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        loads INTEGER NOT NULL DEFAULT 0
      );`);
  }

  create(profile) {
    const editKey = randomBytes(18).toString('base64url');
    const now = new Date().toISOString();
    const insert = this.db.prepare(
      'INSERT INTO profiles (code, edit_hash, profile, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
    for (let attempt = 0; attempt < 50; attempt++) {
      // No leading zero, so the code survives spreadsheets and numeric keypads.
      const code = String(randomInt(100000, 1000000));
      try {
        insert.run(code, hash(editKey), JSON.stringify(profile), now, now);
        return { code, editKey };
      } catch (error) {
        if (!String(error.message).includes('UNIQUE')) throw error;
      }
    }
    throw new Error('Could not allocate a free code');
  }

  get(code) {
    const row = this.db.prepare('SELECT profile, updated_at, loads FROM profiles WHERE code = ?').get(code);
    return row ? { profile: JSON.parse(row.profile), updatedAt: row.updated_at, loads: row.loads } : null;
  }

  canEdit(code, editKey) {
    const row = this.db.prepare('SELECT edit_hash FROM profiles WHERE code = ?').get(code);
    if (!row || typeof editKey !== 'string' || !editKey) return false;
    return timingSafeEqual(Buffer.from(row.edit_hash), hash(editKey));
  }

  update(code, profile) {
    this.db.prepare('UPDATE profiles SET profile = ?, updated_at = ? WHERE code = ?')
      .run(JSON.stringify(profile), new Date().toISOString(), code);
  }

  countLoad(code) {
    this.db.prepare('UPDATE profiles SET loads = loads + 1 WHERE code = ?').run(code);
  }
}
