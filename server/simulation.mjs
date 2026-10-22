import { Router } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { simulationPeople, encodeSimulationQuote, simulationPolicy } from '../shared/simulation.mjs';
import { suppliers, supplierById } from '../shared/catalog.mjs';
import { hasRole } from '../shared/access.mjs';
import { quoteId, quoteRole } from './policy.mjs';

const COOKIE = 'cobid_simulation';
const SESSION_MS = 30 * 60 * 1000;
const grantSchema = z.object({ supplier: z.enum(['design', 'software', 'video']), recipient: z.enum(simulationPeople.map(person => person.id)), reason: z.string().trim().min(8).max(500) }).strict();

export function createSimulation(store) {
  const router = Router();
  const sessions = new Map();
  store.db.exec(`
    CREATE TABLE IF NOT EXISTS simulation_grants (recipient TEXT NOT NULL, supplier TEXT NOT NULL, PRIMARY KEY(recipient,supplier));
    CREATE TABLE IF NOT EXISTS simulation_changes (id TEXT PRIMARY KEY, supplier TEXT NOT NULL, recipient TEXT NOT NULL, requested_by TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS simulation_approvals (change_id TEXT NOT NULL, actor TEXT NOT NULL, PRIMARY KEY(change_id,actor));
  `);

  const personById = id => simulationPeople.find(person => person.id === id);
  const rolesFor = person => [...new Set([...person.roles, ...store.db.prepare('SELECT supplier FROM simulation_grants WHERE recipient=?').all(person.id).map(row => quoteRole(row.supplier))])];
  const member = claims => ({ sub: claims.sub, name: claims.preferred_username, roles: claims.realm_access.roles });
  const claimsFor = person => ({ sub: person.id, preferred_username: person.name, realm_access: { roles: rolesFor(person) } });

  function seed() {
    for (const supplier of suppliers) {
      if (!store.policy(supplier.id)) store.savePolicy(supplier.id, simulationPolicy(supplier.id), 'simulation-seed');
      if (!store.quote(supplier.id)) store.db.prepare('INSERT INTO quotes VALUES (?,?,?,?,?,?)').run(supplier.id, encodeSimulationQuote(supplier.sample, quoteId(supplier.id)), 'string', 1, 'simulation-seed', new Date().toISOString());
    }
  }
  seed();

  function readSession(req) {
    const cookies = (req.get('cookie') || '').split(';').map(value => value.trim());
    const cookie = cookies.find(value => value.startsWith(COOKIE + '='));
    const id = cookie?.slice(COOKIE.length + 1);
    const session = id && sessions.get(id);
    if (!session || session.expires <= Date.now()) { if (id) sessions.delete(id); return null; }
    return { id, session };
  }
  function verify(req) {
    const current = readSession(req);
    if (!current) throw Object.assign(new Error('Your simulation session expired. Choose a demo identity again.'), { status: 401 });
    return current.session.claims;
  }
  function endSession(req) { const previous = readSession(req); if (previous) sessions.delete(previous.id); }

  router.get('/session', (req, res) => {
    const current = readSession(req);
    res.json({ mode: 'simulation', member: current ? member(current.session.claims) : null });
  });
  router.post('/session', (req, res) => {
    const { identity } = z.object({ identity: z.enum(simulationPeople.map(person => person.id)) }).strict().parse(req.body);
    endSession(req);
    for (const [id, session] of sessions) if (session.expires <= Date.now()) sessions.delete(id);
    const id = randomBytes(32).toString('base64url');
    const claims = claimsFor(personById(identity));
    sessions.set(id, { claims, expires: Date.now() + SESSION_MS });
    res.cookie(COOKIE, id, { httpOnly: true, sameSite: 'strict', path: '/api', maxAge: SESSION_MS });
    store.event(claims.preferred_username, 'Simulation: selected demo identity');
    res.json({ mode: 'simulation', member: member(claims) });
  });
  router.post('/logout', (req, res) => {
    endSession(req);
    res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'strict', path: '/api' });
    res.json({ signedOut: true });
  });
  router.use((req, res, next) => {
    try { req.claims = verify(req); next(); }
    catch (error) { res.status(401).json({ error: error.message }); }
  });
  router.post('/refresh', (req, res) => {
    const { session } = readSession(req);
    session.claims = claimsFor(personById(req.claims.sub));
    session.expires = Date.now() + SESSION_MS;
    res.json({ mode: 'simulation', member: member(session.claims) });
  });

  router.use((req, res, next) => {
    if (!hasRole(req.claims, 'tide-realm-admin')) return res.status(403).json({ error: 'Choose a demo governance administrator to review simulated role changes.' });
    next();
  });
  const changes = () => store.db.prepare('SELECT * FROM simulation_changes ORDER BY created_at DESC').all().map(change => ({
    ...change, approvals: store.db.prepare('SELECT actor FROM simulation_approvals WHERE change_id=?').all(change.id).map(row => row.actor), threshold: 2,
    role: quoteRole(change.supplier), recipientName: personById(change.recipient)?.name, requesterName: personById(change.requested_by)?.name,
  }));
  router.get('/governance', (_req, res) => res.json({ mode: 'simulation', changes: changes() }));
  router.post('/governance', (req, res) => {
    const input = grantSchema.parse(req.body);
    const duplicate = store.db.prepare("SELECT id FROM simulation_changes WHERE recipient=? AND supplier=? AND status='pending'").get(input.recipient, input.supplier);
    if (duplicate) return res.status(409).json({ error: 'A pending simulation request already targets this recipient and quote.' });
    const id = randomUUID();
    store.db.prepare('INSERT INTO simulation_changes (id,supplier,recipient,requested_by,reason,created_at) VALUES (?,?,?,?,?,?)').run(id, input.supplier, input.recipient, req.claims.sub, input.reason, new Date().toISOString());
    store.event(req.claims.preferred_username, 'Simulation: proposed quote role for ' + personById(input.recipient).name, input.supplier);
    res.status(201).json({ mode: 'simulation', change: changes().find(change => change.id === id) });
  });
  router.post('/governance/:id/:action', (req, res) => {
    z.object({}).strict().parse(req.body);
    if (!['approve', 'deny'].includes(req.params.action)) return res.status(404).json({ error: 'Unknown simulation action.' });
    const change = store.db.prepare('SELECT * FROM simulation_changes WHERE id=?').get(req.params.id);
    if (!change) return res.status(404).json({ error: 'Simulation request not found.' });
    if (change.status !== 'pending') return res.status(409).json({ error: 'Only pending simulation changes can be reviewed.' });
    store.db.exec('BEGIN IMMEDIATE');
    try {
      if (req.params.action === 'deny') store.db.prepare("UPDATE simulation_changes SET status='denied' WHERE id=?").run(change.id);
      else {
        store.db.prepare('INSERT OR IGNORE INTO simulation_approvals VALUES (?,?)').run(change.id, req.claims.sub);
        const count = store.db.prepare('SELECT count(*) AS count FROM simulation_approvals WHERE change_id=?').get(change.id).count;
        if (count >= 2) {
          store.db.prepare('INSERT OR IGNORE INTO simulation_grants VALUES (?,?)').run(change.recipient, change.supplier);
          store.db.prepare("UPDATE simulation_changes SET status='approved' WHERE id=?").run(change.id);
        }
      }
      store.db.exec('COMMIT');
    } catch (error) { store.db.exec('ROLLBACK'); throw error; }
    const updated = changes().find(item => item.id === change.id);
    store.event(req.claims.preferred_username, 'Simulation: ' + (req.params.action === 'deny' ? 'denied role change' : 'recorded independent approval (' + updated.approvals.length + '/2)'), change.supplier);
    res.json({ mode: 'simulation', change: updated });
  });
  router.get('/access/:supplier', (req, res) => {
    const supplier = supplierById(req.params.supplier);
    if (!supplier) return res.status(404).json({ error: 'Unknown quote.' });
    res.json({ mode: 'simulation', entries: simulationPeople.filter(person => rolesFor(person).includes(quoteRole(supplier.id))).map(person => ({ id: person.id, username: person.name, enabled: true, canDecrypt: rolesFor(person).includes('_tide_decryptor') })) });
  });
  router.post('/reset', (req, res) => {
    z.object({ confirm: z.literal(true) }).strict().parse(req.body);
    store.db.exec('BEGIN IMMEDIATE');
    try {
      for (const table of ['simulation_approvals', 'simulation_changes', 'simulation_grants', 'quotes', 'policies', 'requests', 'events']) store.db.exec('DELETE FROM ' + table);
      seed();
      store.db.exec('COMMIT');
    } catch (error) { store.db.exec('ROLLBACK'); throw error; }
    // Update every mock session so reset immediately removes simulated grants.
    for (const session of sessions.values()) session.claims = claimsFor(personById(session.claims.sub));
    store.event('Simulation', 'Simulation: restored synthetic quotes and initial roles');
    res.json({ mode: 'simulation', reset: true });
  });
  return { router, verify };
}
