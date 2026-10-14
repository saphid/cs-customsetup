// Profile storage: one SQLite file, 6-digit public load codes, secret edit keys.
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomInt, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const hash = (key) => createHash('sha256').update(key).digest();

export class StoreFullError extends Error {}

export class Store {
  // maxProfiles caps storage (and keeps most of the 900,000 codes free, so a
  // new code is found at once and codes stay hard to guess).
  constructor(file, { maxProfiles = 100_000 } = {}) {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    this.maxProfiles = maxProfiles;
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
    // Added later: when a station last loaded the profile (for retention).
    const columns = this.db.prepare('PRAGMA table_info(profiles)').all().map((c) => c.name);
    if (!columns.includes('loaded_at')) this.db.exec('ALTER TABLE profiles ADD COLUMN loaded_at TEXT');
  }

  count() { return this.db.prepare('SELECT COUNT(*) AS n FROM profiles').get().n; }

  create(profile) {
    if (this.count() >= this.maxProfiles) throw new StoreFullError('This server has reached its profile limit');
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

  delete(code) {
    this.db.prepare('DELETE FROM profiles WHERE code = ?').run(code);
  }

  countLoad(code) {
    this.db.prepare('UPDATE profiles SET loads = loads + 1, loaded_at = ? WHERE code = ?').run(new Date().toISOString(), code);
  }

  // Deletes profiles neither saved nor loaded for `days` days. Returns how many.
  prune(days) {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    return Number(this.db.prepare('DELETE FROM profiles WHERE updated_at < ? AND (loaded_at IS NULL OR loaded_at < ?)')
      .run(cutoff, cutoff).changes);
  }
}
