import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(join(directory, item.name)) : item.name.endsWith('.mjs') ? [join(directory, item.name)] : []);
}
const paths = ['server', 'scripts', 'shared', 'tests', 'src/lib'].flatMap(files);
for (const file of paths) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) { console.error(result.stderr); process.exit(1); }
}
console.log(`JavaScript syntax checks passed for ${paths.length} modules. TypeScript is checked separately with tsc.`);
