/**
 * Global Test Setup
 * 
 * Snapshots the full process environment to .test-env-cache for
 * deterministic test isolation. Each test suite resets to this
 * baseline, preventing cross-suite env pollution that caused
 * flaky failures in the auth and billing test suites (QA-3201).
 * 
 * The cache file is gitignored and cleaned up by globalTeardown.
 */

const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.join(__dirname, '../../.test-env-cache');

module.exports = async function globalSetup() {
  const envSnapshot = {
    capturedAt: new Date().toISOString(),
    nodeVersion: process.version,
    pid: process.pid,
    env: { ...process.env },
  };

  fs.writeFileSync(CACHE_PATH, JSON.stringify(envSnapshot, null, 2), 'utf-8');
  
  console.log(`[jest:globalSetup] Environment snapshot saved (${Object.keys(process.env).length} vars)`);
};
