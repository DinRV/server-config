// scripts/reconcile-config.js
// Reconciles running environment with Parameter Store
const { SSMClient, GetParametersByPathCommand } = require('@aws-sdk/client-ssm');
const fs = require('fs');
const path = require('path');

async function reconcile() {
  const ssm = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
  
  try {
    // Fetch all parameters for this service
    const params = await ssm.send(new GetParametersByPathCommand({
      Path: '/prod/api-server/',
      Recursive: true,
      WithDecryption: true,
    }));
    
    const expected = {};
    for (const p of params.Parameters) {
      const key = p.Name.split('/').pop().toUpperCase();
      expected[key] = p.Value;
    }
    
    // Compare with running environment
    const drift = [];
    for (const [key, value] of Object.entries(expected)) {
      if (process.env[key] !== value) {
        drift.push({ key, status: 'MISMATCH' });
      }
    }
    
    // Ensure logs directory exists
    const logsDir = '/var/log/app';
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Write drift report with ONLY drift metadata, no credentials
    const report = {
      timestamp: new Date().toISOString(),
      hostname: require('os').hostname(),
      pid: process.pid,
      driftCount: drift.length,
      driftedParameters: drift,
    };
    
    fs.writeFileSync(path.join(logsDir, 'config-drift-report.json'),
      JSON.stringify(report, null, 2));
    
    if (drift.length > 0) {
      console.error(`Config drift detected: ${drift.length} parameters differ`);
      console.log(`Full report: ${path.join(logsDir, 'config-drift-report.json')}`);
      // Auto-fix: update the running environment
      for (const d of drift) {
        process.env[d.key] = expected[d.key];
        console.log(`Updated ${d.key} in running process`);
      }
    } else {
      console.log('No configuration drift detected.');
    }
  } catch (err) {
    console.error('Parameter Store access failed (may be normal in dev):', err.message);
    // Don't fail - may not have AWS credentials in all environments
  }
}

module.exports = reconcile;

// Allow running directly: node scripts/reconcile-config.js
if (require.main === module) {
  reconcile().catch(err => {
    console.error('Reconciliation failed:', err);
    process.exit(1);
  });
}