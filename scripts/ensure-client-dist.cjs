const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const workspaceRoot = path.resolve(__dirname, '..');
const distIndexPath = path.resolve(workspaceRoot, 'client', 'dist', 'index.html');

if (fs.existsSync(distIndexPath)) {
  process.exit(0);
}

const userAgent = process.env.npm_config_user_agent ?? '';
const pkgManager = (() => {
  if (process.env.ENSURE_CLIENT_DIST_PM) {
    return process.env.ENSURE_CLIENT_DIST_PM;
  }
  if (userAgent.startsWith('pnpm')) {
    return 'pnpm';
  }
  if (userAgent.startsWith('yarn')) {
    return 'yarn';
  }
  if (userAgent.startsWith('bun')) {
    return 'bun';
  }
  return 'npm';
})();

const buildCommand = process.env.ENSURE_CLIENT_DIST_COMMAND;
const commandLabel =
  buildCommand || `${pkgManager} run build:client`;

console.log(`[ensure-client-dist] Client build missing. Running "${commandLabel}"...`);

const result = buildCommand
  ? spawnSync(buildCommand, {
      stdio: 'inherit',
      cwd: workspaceRoot,
      shell: true,
    })
  : spawnSync(pkgManager, ['run', 'build:client'], {
      stdio: 'inherit',
      cwd: workspaceRoot,
      shell: process.platform === 'win32',
    });

if (result.status !== 0) {
  console.error('[ensure-client-dist] Failed to build the client bundle.');
  if (!buildCommand) {
    console.error(
      '[ensure-client-dist] Ensure dev dependencies are installed (e.g. run without "--omit=dev") and retry "npm run build:client".'
    );
  }
  process.exit(result.status ?? 1);
}

if (!fs.existsSync(distIndexPath)) {
  console.error('[ensure-client-dist] Build command completed but "client/dist/index.html" is still missing.');
  process.exit(1);
}
