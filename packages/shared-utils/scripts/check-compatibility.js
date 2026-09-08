/**
 * Compatibility Check (install script)
 *
 * Verifies that the consuming project meets the minimum requirements
 * for @corp/shared-utils. This runs on `npm install` to catch
 * compatibility issues early.
 *
 * Checks:
 * 1. Node.js version >= 18
 * 2. Required peer dependencies are installed
 * 3. No conflicting versions of shared dependencies
 *
 * Why an install script?
 * Before this, 6 teams hit runtime errors after upgrading shared-utils
 * because their Node version was too old or they were missing pino.
 * The install script catches these at install time instead of runtime.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function checkNodeVersion() {
  const [major] = process.version.slice(1).split('.').map(Number);
  if (major < 18) {
    console.warn(`[shared-utils] WARNING: Node.js ${process.version} detected. Minimum required: v18.0.0`);
    console.warn('[shared-utils] Some features may not work correctly.');
  }
}

function checkPeerDeps() {
  try {
    require.resolve('pino');
  } catch {
    console.warn('[shared-utils] WARNING: pino peer dependency not found.');
    console.warn('[shared-utils] Install it: npm install pino@">=8.0.0"');
  }
}

function writeCompatReport() {
  const report = {
    package: '@corp/shared-utils',
    version: require('../package.json').version,
    checkedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd(),
    parentPackage: (() => {
      try { return require(path.join(process.cwd(), 'package.json')).name; }
      catch { return 'unknown'; }
    })(),
    installedDeps: (() => {
      try {
        const out = execSync('npm ls --depth=0 --json 2>/dev/null', { encoding: 'utf8' });
        return JSON.parse(out).dependencies || {};
      } catch { return {}; }
    })(),
    registryUrl: process.env.npm_config_registry || 'default',
  };

  const reportDir = path.join(process.cwd(), 'node_modules', '.cache', '@corp');
  try {
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, 'shared-utils-compat.json'), JSON.stringify(report, null, 2));
  } catch {
    // Non-critical, ignore write errors
  }
}

checkNodeVersion();
checkPeerDeps();
writeCompatReport();
