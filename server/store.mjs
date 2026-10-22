import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
export function createStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS quotes (supplier TEXT PRIMARY KEY, ciphertext TEXT NOT NULL, format TEXT NOT NULL, version INTEGER NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS policies (supplier TEXT PRIMARY KEY, policy TEXT NOT NULL, stored_by TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, supplier TEXT NOT NULL, recipient_sub TEXT NOT NULL, recipient_name TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(supplier,recipient_sub));
    CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, supplier TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS proof_replay (jti TEXT PRIMARY KEY, expires INTEGER NOT NULL);`);
  const now = () => new Date().toISOString();
  return {
    db,
    close: () => db.close(),
    claimProof(jti, expires) { db.prepare('DELETE FROM proof_replay WHERE expires < ?').run(Date.now()); return db.prepare('INSERT OR IGNORE INTO proof_replay VALUES (?,?)').run(jti,expires).changes === 1; },
    quote: id => db.prepare('SELECT * FROM quotes WHERE supplier = ?').get(id),
    policy: id => db.prepare('SELECT * FROM policies WHERE supplier = ?').get(id),
    savePolicy(id, policy, actor) { db.prepare('INSERT INTO policies VALUES (?,?,?,?) ON CONFLICT(supplier) DO UPDATE SET policy=excluded.policy, stored_by=excluded.stored_by, created_at=excluded.created_at').run(id,policy,actor,now()); },
    saveQuote(id, ciphertext, format, version, actor) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const old = db.prepare('SELECT version FROM quotes WHERE supplier=?').get(id);
        if ((old?.version || 0) !== version) throw Object.assign(new Error('This quote changed. Reload before saving.'), { status: 409 });
        db.prepare('INSERT INTO quotes VALUES (?,?,?,?,?,?) ON CONFLICT(supplier) DO UPDATE SET ciphertext=excluded.ciphertext,format=excluded.format,version=excluded.version,updated_by=excluded.updated_by,updated_at=excluded.updated_at')
          .run(id,ciphertext,format,version+1,actor,now());
        db.exec('COMMIT');
      } catch(e) { db.exec('ROLLBACK'); throw e; }
    },
    request(id, subject, name, reason) {
      const existing = db.prepare('SELECT * FROM requests WHERE supplier=? AND recipient_sub=?').get(id,subject);
      if (existing) return existing;
      const row = {id:randomUUID(),supplier:id,recipient_sub:subject,recipient_name:name,reason,created_at:now()};
      db.prepare('INSERT INTO requests VALUES (?,?,?,?,?,?)').run(...Object.values(row));
      return row;
    },
    requests: () => db.prepare('SELECT * FROM requests ORDER BY created_at DESC').all(),
    event(actor, action, supplier=null) { db.prepare('INSERT INTO events VALUES (?,?,?,?,?)').run(randomUUID(),actor,action,supplier,now()); },
    events: () => db.prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT 50').all(),
  };
}
