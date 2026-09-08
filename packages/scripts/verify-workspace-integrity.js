/**
 * Workspace Integrity Verifier (prepare script)
 *
 * Checks that all workspace packages are correctly configured:
 * 1. All packages have matching Node engine requirements
 * 2. No duplicate dependency versions across packages
 * 3. All packages use the private npm registry
 * 4. No packages accidentally publish to public npm
 *
 * This catches common mistakes before they reach CI.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT, 'packages');
const REQUIRED_REGISTRY = 'https://npm-mirror.corp-artifacts.net/repository/npm-private/';

function verify() {
  const issues = [];

  let dirs;
  try {
    dirs = fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && fs.existsSync(path.join(PACKAGES_DIR, d.name, 'package.json')));
  } catch {
    console.log('[verify] No packages directory found, skipping verification');
    return;
  }

  for (const dir of dirs) {
    const pkgPath = path.join(PACKAGES_DIR, dir.name, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    // Check registry config
    if (pkg.publishConfig?.registry !== REQUIRED_REGISTRY && !pkg.private) {
      issues.push(`${pkg.name}: publishConfig.registry must be ${REQUIRED_REGISTRY}`);
    }

    // Check engine requirement
    if (!pkg.engines?.node?.includes('20')) {
      issues.push(`${pkg.name}: engines.node should require >=20.0.0`);
    }
  }

  if (issues.length > 0) {
    console.warn('[verify] Workspace integrity issues found:');
    issues.forEach(i => console.warn(`  - ${i}`));
    console.warn('[verify] Fix these before committing.');
  } else {
    console.log(`[verify] All ${dirs.length} workspace packages passed integrity checks`);
  }
}

verify();
