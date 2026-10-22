import { spawn } from 'node:child_process';
const processes = [
  spawn(process.execPath, ['--watch', '--env-file-if-exists=.env', 'server/index.mjs'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const p of processes) p.kill(); process.exitCode = code; }
for (const p of processes) { p.on('error', () => stop(1)); p.on('exit', code => stop(code ?? 1)); }
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
