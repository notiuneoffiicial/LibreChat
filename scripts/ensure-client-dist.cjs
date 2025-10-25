const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const workspaceRoot = path.resolve(__dirname, '..');
const distIndexPath = path.resolve(workspaceRoot, 'client', 'dist', 'index.html');
const clientDir = path.resolve(workspaceRoot, 'client');

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
const defaultScript = process.env.ENSURE_CLIENT_DIST_SCRIPT || 'frontend';
const commandLabel = buildCommand || `${pkgManager} run ${defaultScript}`;

let missingLocalVite = false;

if (!buildCommand) {
  const viteExecutable =
    process.platform === 'win32'
      ? path.resolve(clientDir, 'node_modules', '.bin', 'vite.cmd')
      : path.resolve(clientDir, 'node_modules', '.bin', 'vite');
  missingLocalVite =
    !fs.existsSync(viteExecutable) && !fs.existsSync(path.resolve(clientDir, 'node_modules', 'vite'));

  if (missingLocalVite) {
    console.error('[ensure-client-dist] "client/dist" is missing and Vite is not installed in this environment.');
    console.error(
      '[ensure-client-dist] Build the client bundle before stripping devDependencies (e.g. run "npm run frontend") or provide a prebuilt "client/dist" directory.'
    );
    console.error(
      '[ensure-client-dist] You can also supply a custom build command via ENSURE_CLIENT_DIST_COMMAND when running with devDependencies present.'
    );
    process.exit(1);
  }
}

console.log(`[ensure-client-dist] Client build missing. Running "${commandLabel}"...`);

const result = buildCommand
  ? spawnSync(buildCommand, {
      stdio: 'inherit',
      cwd: workspaceRoot,
      shell: true,
    })
  : spawnSync(pkgManager, ['run', defaultScript], {
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
