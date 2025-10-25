const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const distIndexPath = path.resolve(__dirname, '..', 'client', 'dist', 'index.html');

if (fs.existsSync(distIndexPath)) {
  process.exit(0);
}

const hasViteDependency =
  fs.existsSync(path.resolve(__dirname, '..', 'node_modules', 'vite')) ||
  fs.existsSync(path.resolve(__dirname, '..', 'client', 'node_modules', 'vite'));

if (!hasViteDependency) {
  console.error('[ensure-client-dist] Missing client build and Vite dependency not installed.');
  console.error('[ensure-client-dist] Install devDependencies and run "npm run frontend" before starting the backend.');
  process.exit(1);
}

console.log('[ensure-client-dist] Client build missing. Running "npm run build:client"...');
const result = spawnSync('npm', ['run', 'build:client'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  console.error('[ensure-client-dist] Failed to build the client bundle.');
  process.exit(result.status ?? 1);
}
