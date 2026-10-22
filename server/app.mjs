import express from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveDpopAuthRequest } from '@tidecloak/js/dpop-server';
import { room, suppliers, supplierById } from '../shared/catalog.mjs';
import { makeVerifier, hasRole, isMember, rolesOf } from './auth.mjs';
import { quoteId, quoteRole, inspectPolicy } from './policy.mjs';
import { createSimulation } from './simulation.mjs';
import { simulationPolicy } from '../shared/simulation.mjs';
const cipherSchema = z.object({ciphertext:z.string().min(32).max(180000).regex(/^[A-Za-z0-9+/=_-]+$/),format:z.enum(['string','bytes']),version:z.number().int().nonnegative()}).strict();
const requestSchema = z.object({supplier:z.enum(['design','software','video']),reason:z.string().trim().min(8).max(500)}).strict();
export function createApp(config, store) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, originAgentCluster: false }));
  // SDK DPoP document carries its own strict CSP. Connect/frame origins depend on the licensed Tide network.
  app.use((req,res,next) => {
    const hit = resolveDpopAuthRequest({pathname:req.path,expectedIssuer:config.issuer,expectedClient:config.clientId,method:req.method});
    if (!hit) return next();
    // The Tide enclave frames this SDK-owned document. Helmet's default
    // SAMEORIGIN would override the relay's own strict CSP and block it.
    res.removeHeader('X-Frame-Options');
    res.status(hit.status).set(hit.headers).send(hit.body);
  });
  app.use('/api', (_req,res,next) => { res.set('Cache-Control','no-store'); next(); });
  app.use('/api', (req,res,next) => {
    if (req.get('origin') && req.get('origin') !== config.origin) return res.status(403).json({error:'Origin not allowed.'});
    next();
  });
  app.use(express.json({limit:'256kb'}));
  const simulation = config.mode === 'simulation' ? createSimulation(store) : null;
  app.get('/api/health', (_req,res) => res.json({ok:true,mode:config.mode||'tide',identityConfigured:!!config.adapter,liveIntegrationVerified:false}));
  app.get('/api/config', (_req,res) => res.json({
    mode:config.mode||'tide',configured:!!simulation||!!config.adapter,issue:config.issue,adapter:config.adapter,
    consoleUrl:config.baseUrl+'/realms/'+config.realm+'/tide-console/',
    setupUrl:config.baseUrl,governance:{targetAdmins:3,targetApprovals:2,verified:false},
  }));
  app.get('/api/public-room', (_req,res) => res.json({room,suppliers:suppliers.map(({sample,...s})=>s)}));
  if (simulation) app.use('/api/simulation', simulation.router);
  const verifier = simulation ? simulation.verify : makeVerifier(config,store);
  app.use('/api', async (req,res,next) => {
    if (!simulation && !req.get('authorization')) return res.status(401).json({error:'Sign in with TideCloak to continue.'});
    try { req.claims = await verifier(req); if (!isMember(req.claims) && !hasRole(req.claims,'tide-realm-admin')) return res.status(403).json({error:'No CoBid membership assigned.'}); next(); }
    catch(e) { res.status(e.status || 401).json({error:e.status===503?'Complete TideCloak setup first.':'Your session could not be verified. Sign in again.'}); }
  });
  app.get('/api/me', (req,res)=>res.json({sub:req.claims.sub,name:req.claims.preferred_username || 'Team member',roles:rolesOf(req.claims)}));
  app.get('/api/room', (req,res)=>res.json({room,quotes:suppliers.map(s=>{
    const q=store.quote(s.id); const canRead=hasRole(req.claims,quoteRole(s.id)) && hasRole(req.claims,'_tide_decryptor');
    return {supplier:s.id,recordId:quoteId(s.id),status:q?'sealed':'awaiting-quote',version:q?.version||0,updatedAt:q?.updated_at||null,policyStored:!!store.policy(s.id),canRead,canWrite:hasRole(req.claims,s.role)&&hasRole(req.claims,quoteRole(s.id))&&hasRole(req.claims,'_tide_encryptor')};
  })}));
  app.get('/api/quotes/:supplier/policy', (req,res)=>{
    const s=supplierById(req.params.supplier);
    if (!s) return res.status(404).json({error:'Quote not found.'});
    if (!hasRole(req.claims,quoteRole(s.id))&&!hasRole(req.claims,'tide-realm-admin')) return res.status(403).json({error:'You do not have this quote’s access role.'});
    const p=store.policy(s.id);
    if (!p) return res.status(409).json({error:'A governance administrator must sign this quote’s policy first.'});
    res.json({policy:p.policy,recordId:quoteId(s.id)});
  });
  app.put('/api/quotes/:supplier/policy', (req,res)=>{
    const s=supplierById(req.params.supplier);
    if (!s) return res.status(404).json({error:'Quote not found.'});
    if (!hasRole(req.claims,'tide-realm-admin')) return res.status(403).json({error:'Governance administrator required.'});
    const input=z.object({policy:z.string().min(20).max(200000).regex(/^[A-Za-z0-9+/=]+$/)}).strict().parse(req.body);
    if (store.quote(s.id)) return res.status(409).json({error:'A policy cannot be replaced after a quote is sealed. Use the documented reset or a new record.'});
    try { if(simulation){if(input.policy!==simulationPolicy(s.id))throw Error('Invalid simulation policy');}else inspectPolicy(input.policy,s.id,config.adapter.vendorId); } catch { return res.status(400).json({error:'Policy does not match this quote, role, realm, or required operations.'}); }
    store.savePolicy(s.id,input.policy,req.claims.sub); store.event(req.claims.preferred_username||'Governance admin','Stored signed-policy bytes; network validation occurs on use',s.id);
    res.status(201).json({stored:true,networkVerified:false});
  });
  app.put('/api/quotes/:supplier', (req,res)=>{
    const s=supplierById(req.params.supplier);
    if (!s) return res.status(404).json({error:'Quote not found.'});
    if (!hasRole(req.claims,s.role)||!hasRole(req.claims,quoteRole(s.id))||!hasRole(req.claims,'_tide_encryptor')) return res.status(403).json({error:'Only this supplier’s authorised contributor can submit its encrypted quote.'});
    const data=cipherSchema.parse(req.body);
    if (!store.policy(s.id)) return res.status(409).json({error:'Sign the encryption policy first.'});
    store.saveQuote(s.id,data.ciphertext,data.format,data.version,req.claims.sub);
    store.event(req.claims.preferred_username||'Contributor','Submitted encrypted quote',s.id);
    res.status(201).json({saved:true});
  });
  app.get('/api/quotes/:supplier', (req,res)=>{
    const s=supplierById(req.params.supplier);
    if (!s) return res.status(404).json({error:'Quote not found.'});
    if (!hasRole(req.claims,quoteRole(s.id))||!hasRole(req.claims,'_tide_decryptor')) {
      store.event(req.claims.preferred_username||'Member','API denied protected quote access',s.id);
      return res.status(403).json({error:'Access denied. Coordination or administration alone does not grant this quote’s read permission.'});
    }
    const q=store.quote(s.id), p=store.policy(s.id);
    if (!q||!p) return res.status(404).json({error:'This supplier has not submitted a sealed quote yet.'});
    store.event(req.claims.preferred_username||'Member','Retrieved ciphertext for browser decryption',s.id);
    res.json({ciphertext:q.ciphertext,format:q.format,policy:p.policy,recordId:quoteId(s.id),version:q.version});
  });
  app.get('/api/requests', (req,res)=>{
    const all=hasRole(req.claims,'tide-realm-admin')||hasRole(req.claims,'cobid-coordinator');
    res.json({requests:store.requests().filter(r=>all||r.recipient_sub===req.claims.sub).map(r=>({...r,
      role:quoteRole(r.supplier),status:r.recipient_sub===req.claims.sub && hasRole(req.claims,quoteRole(r.supplier))&&hasRole(req.claims,'_tide_decryptor')?'effective-for-current-session':'intent-recorded',
    }))});
  });
  app.post('/api/requests', (req,res)=>{
    const data=requestSchema.parse(req.body);
    if (!isMember(req.claims)) return res.status(403).json({error:'A bidding-room membership is required.'});
    const r=store.request(data.supplier,req.claims.sub,req.claims.preferred_username||'Member',data.reason);
    store.event(req.claims.preferred_username||'Member','Recorded an access request; no permission granted',data.supplier);
    res.status(201).json({request:r,status:'intent-recorded'});
  });
  app.get('/api/activity', (_req,res)=>res.json({events:store.events()}));
  app.use('/api', (_req,res)=>res.status(404).json({error:'Unknown API operation.'}));
  if (existsSync(resolve('dist/index.html'))) {
    app.use(express.static(resolve('dist')));
    app.get('/{*path}', (_req,res)=>res.sendFile(resolve('dist/index.html')));
  }
  app.use((error,_req,res,_next)=>{
    if (error instanceof z.ZodError) return res.status(400).json({error:'Invalid request. Send only the documented fields.'});
    if (error.status===409) return res.status(409).json({error:error.message});
    if (error.type==='entity.too.large') return res.status(413).json({error:'Payload too large.'});
    if (error instanceof SyntaxError) return res.status(400).json({error:'Invalid JSON.'});
    res.status(500).json({error:'The operation failed. Retry after checking the local service.'});
  });
  return app;
}
