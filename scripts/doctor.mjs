import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadConfig } from '../server/config.mjs';

export async function diagnose(env = process.env) {
  const config = loadConfig(env);
  const checks = [];
  const check = (name, ok, detail) => checks.push({ name, ok, detail });
  const [major, minor] = process.versions.node.split('.').map(Number);
  check('Node runtime', major > 22 || major === 22 && minor >= 13, 'Requires Node >=22.13.0; found ' + process.versions.node);
  check('Dependencies', existsSync('node_modules/esbuild/lib/main.js'), 'Run npm ci.');
  check('Local environment', existsSync('.env'), 'Run npm run setup. Never commit .env.');
  if (config.mode === 'simulation') {
    check('Simulation mode', true, 'Explicit local mock sign-in, role snapshots and approvals; database .local/cobid-simulation.sqlite.');
    check('Real TideCloak protection', null, 'Not active in simulation. No real identity, encryption, DPoP or ORK approval checks run in this mode.');
    return checks;
  }
  const docker = spawnSync('docker', ['info', '--format', '{{.OSType}}'], { encoding: 'utf8', timeout: 15000, windowsHide: true });
  check('Docker Linux engine', docker.status === 0 && docker.stdout.trim() === 'linux', 'Start Docker Desktop using Linux containers; an existing remote TideCloak can be used instead.');
  check('Public Tide adapter', !!config.adapter, config.issue || 'Realm/client match; strict DPoP enabled.');
  try {
    const response = await fetch(config.issuer + '/.well-known/openid-configuration', { signal: AbortSignal.timeout(5000) });
    const discovery = response.ok ? await response.json() : {};
    check('Tide realm discovery', response.ok && discovery.issuer === config.issuer, 'Expected issuer: ' + config.issuer);
  } catch { check('Tide realm discovery', false, 'Start TideCloak, finish realm enrollment, or configure TIDECLOAK_URL.'); }
  check('Live verification record', null, 'Manual gate: real encryption, decryption, denied access, and two independent approvals must be recorded in docs/verification.md. Local configuration cannot prove them.');
  if (existsSync('.env') && readFileSync('.env', 'utf8').includes('REPLACE_WITH_GENERATED_LOCAL_VALUE')) {
    check('Bootstrap password', false, 'Replace the example placeholder using npm run setup before starting TideCloak.');
  }
  return checks;
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/scripts/doctor.mjs')) {
  const checks = await diagnose();
  console.log('CoBid readiness — read-only checks; credentials and tokens are never printed.');
  for (const item of checks) console.log(`${item.ok === null ? 'MANUAL' : item.ok ? 'PASS' : 'ACTION'} ${item.name}: ${item.detail}`);
  process.exitCode = checks.some(item => item.ok === false && item.name !== 'Docker Linux engine') ? 1 : 0;
}
