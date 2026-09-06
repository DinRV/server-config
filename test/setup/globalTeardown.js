const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.join(__dirname, '../../.test-env-cache');

module.exports = async function globalTeardown() {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      fs.unlinkSync(CACHE_PATH);
      console.log('[jest:globalTeardown] Environment cache cleaned up');
    }
  } catch (err) {
    // Non-fatal
  }
};
