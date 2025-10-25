const fs = require('fs-extra');
const path = require('path');

async function postBuild() {
  try {
    await fs.copy('public/assets', 'dist/assets');
    await fs.copy('public/robots.txt', 'dist/robots.txt');
    console.log('✅ PWA icons and robots.txt copied successfully. Glob pattern warnings resolved.');

    const prebuiltDir = path.resolve(__dirname, '..', '.prebuilt-dist');
    await fs.remove(prebuiltDir);
    await fs.copy('dist', prebuiltDir);
    console.log('✅ Cached client build in client/.prebuilt-dist for environments without devDependencies.');
  } catch (err) {
    console.error('❌ Error copying files:', err);
    process.exit(1);
  }
}

postBuild();
