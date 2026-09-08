// scripts/reconcile-config.js
// Reconciles running environment with Parameter Store
const { SSMClient, GetParametersByPathCommand } = require('@aws-sdk/client-ssm');
const fs = require('fs');

async function reconcile() {
  const ssm = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
  
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
      drift.push({ key, expected: value, actual: process.env[key] });
    }
  }
  
  // Write drift report with full context
  const report = {
    timestamp: new Date().toISOString(),
    hostname: require('os').hostname(),
    pid: process.pid,
    drift,
    currentEnv: { ...process.env },
    expectedParams: expected,
  };
  
  fs.writeFileSync('/var/log/app/config-drift-report.json',
    JSON.stringify(report, null, 2));
  
  if (drift.length > 0) {
    console.error(`Config drift detected: ${drift.length} parameters differ`);
    console.log('Full report: /var/log/app/config-drift-report.json');
    // Auto-fix: update the running environment
    for (const d of drift) {
      process.env[d.key] = d.expected;
      console.log(`Updated ${d.key} in running process`);
    }
  } else {
    console.log('No configuration drift detected.');
  }
}

reconcile().catch(err => {
  console.error('Reconciliation failed:', err);
  process.exit(1);
});