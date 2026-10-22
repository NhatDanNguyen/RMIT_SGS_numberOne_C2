import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve, dirname, basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../server/config.mjs';

export function resetDemo(databasePath, { policies = false, simulation = false } = {}) {
  const root = resolve('.local');
  const path = resolve(databasePath);
  if (!path.startsWith(root + '\\') && !path.startsWith(root + '/')) throw new Error('Reset is limited to a database inside this repository’s .local directory.');
  if (!existsSync(path)) return { reset: false, reason: 'No local demo database exists yet.' };
  const db = new DatabaseSync(path);
  let backup;
  try {
    db.exec('PRAGMA busy_timeout=5000');
    const folder = join(dirname(path), 'backups');
    mkdirSync(folder, { recursive: true });
    backup = join(folder, basename(path) + '.' + new Date().toISOString().replace(/[:.]/g, '-') + '.' + randomUUID() + '.bak');
    // SQLite produces a consistent snapshot including WAL data; copying the main
    // file alone could miss recent committed writes.
    db.prepare('VACUUM INTO ?').run(backup);
    db.exec('BEGIN IMMEDIATE');
    try {
      const simulationTables = simulation ? ['simulation_approvals', 'simulation_changes', 'simulation_grants'].filter(table => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)) : [];
      for (const table of [...simulationTables, 'quotes', 'requests', 'events', ...(policies ? ['policies'] : [])]) db.exec('DELETE FROM ' + table);
      // Replay history remains until its original expiry; resetting the demo must not make proofs reusable.
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  } finally { db.close(); }
  return { reset: true, backup, policiesRemoved: policies };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv.includes('--confirm')) {
    console.error('Stop CoBid, then run npm run demo:reset -- --confirm. This backs up and clears application quotes, requests and activity. Add --policies to remove signed policies too. Tide accounts, roles and governance are managed separately.');
    process.exitCode = 1;
  } else {
    try { const config = loadConfig(); console.log(JSON.stringify(resetDemo(config.databasePath, { policies: process.argv.includes('--policies'), simulation: config.mode === 'simulation' }), null, 2)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
