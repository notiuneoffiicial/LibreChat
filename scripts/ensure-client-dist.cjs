const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const workspaceRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(workspaceRoot, 'client', 'dist');
const distIndexPath = path.resolve(distDir, 'index.html');
const clientDir = path.resolve(workspaceRoot, 'client');
const cachedDistDir = path.resolve(clientDir, '.prebuilt-dist');
const cachedDistIndexPath = path.resolve(cachedDistDir, 'index.html');

if (fs.existsSync(distIndexPath)) {
  try {
    if (fs.existsSync(cachedDistDir)) {
      fs.rmSync(cachedDistDir, { recursive: true, force: true });
    }
    fs.mkdirSync(cachedDistDir, { recursive: true });
    fs.cpSync(distDir, cachedDistDir, { recursive: true });
  } catch (err) {
    console.warn('[ensure-client-dist] Unable to refresh cached client build:', err.message);
  }
  process.exit(0);
}

if (fs.existsSync(cachedDistIndexPath)) {
  try {
    console.log('[ensure-client-dist] Restoring "client/dist" from cached build.');
    fs.rmSync(distDir, { recursive: true, force: true });
    fs.mkdirSync(distDir, { recursive: true });
    fs.cpSync(cachedDistDir, distDir, { recursive: true });
    process.exit(0);
  } catch (err) {
    console.warn('[ensure-client-dist] Failed to restore cached client build:', err.message);
  }
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

try {
  if (fs.existsSync(cachedDistDir)) {
    fs.rmSync(cachedDistDir, { recursive: true, force: true });
  }
  fs.mkdirSync(cachedDistDir, { recursive: true });
  fs.cpSync(distDir, cachedDistDir, { recursive: true });
  console.log('[ensure-client-dist] Cached client build at "client/.prebuilt-dist".');
} catch (err) {
  console.warn('[ensure-client-dist] Unable to cache client build:', err.message);
}
