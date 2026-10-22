import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
mkdirSync('.local', { recursive: true });
if (!existsSync('.env')) {
  const example = readFileSync('.env.example', 'utf8');
  writeFileSync('.env', example.replace('REPLACE_WITH_GENERATED_LOCAL_VALUE', randomBytes(32).toString('base64url')), { mode: 0o600 });
  console.log('Created ignored .env with a random bootstrap password. Open it locally to sign in; do not share it.');
} else console.log('Existing .env preserved.');
console.log('Next: npm run tide:up, then open http://localhost:8080 and follow docs/tidecloak-setup.md.');
