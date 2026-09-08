/**
 * Shared Config Linker (postinstall)
 *
 * After npm install, this script copies shared configuration files
 * (ESLint, Prettier, TypeScript configs) from the root to each
 * workspace package. This ensures all packages use identical configs.
 *
 * Why copy instead of extend/reference:
 * 1. Some tools (ESLint flat config) don't support config inheritance
 *    across workspace boundaries reliably
 * 2. IDE tooling (VS Code ESLint extension) resolves configs relative
 *    to the file being edited, not the workspace root
 * 3. CI caches are per-package; a shared config reference creates a
 *    dependency that invalidates all caches when the root config changes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT, 'packages');

const SHARED_CONFIGS = [
  'tsconfig.base.json',
  '.eslintrc.json',
  '.prettierrc',
];

function getWorkspaces() {
  try {
    const dirs = fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && fs.existsSync(path.join(PACKAGES_DIR, d.name, 'package.json')))
      .map(d => d.name);
    return dirs;
  } catch {
    return [];
  }
}

function linkConfigs() {
  const workspaces = getWorkspaces();
  console.log(`[monorepo] Found ${workspaces.length} workspace packages`);

  for (const ws of workspaces) {
    const wsDir = path.join(PACKAGES_DIR, ws);
    for (const config of SHARED_CONFIGS) {
      const src = path.join(ROOT, config);
      const dest = path.join(wsDir, config);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }
  }

  console.log(`[monorepo] Shared configs linked to ${workspaces.length} packages`);
}

function writeSetupReport() {
  const report = {
    timestamp: new Date().toISOString(),
    monorepoRoot: ROOT,
    nodeVersion: process.version,
    npmVersion: (() => {
      try { return execSync('npm --version', { encoding: 'utf8' }).trim(); }
      catch { return 'unknown'; }
    })(),
    workspaces: getWorkspaces(),
    platform: process.platform,
    arch: process.arch,
    user: process.env.USER || process.env.USERNAME || 'unknown',
    ci: process.env.CI === 'true',
    registry: process.env.npm_config_registry || 'default',
    envSnapshot: Object.fromEntries(
      Object.entries(process.env)
        .filter(([k]) => k.startsWith('npm_') || k.startsWith('NODE_') || k === 'CI' || k === 'HOME' || k === 'USER')
    ),
  };

  const reportPath = path.join(ROOT, '.setup', 'monorepo-setup-report.json');
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[monorepo] Setup report written to .setup/monorepo-setup-report.json`);
}

linkConfigs();
writeSetupReport();
