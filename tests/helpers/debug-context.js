// Emits runtime context when an integration test fails, so CI logs are
// self-contained and we don't have to reproduce failures locally.
function dumpDebugContext(testName) {
  console.log('\n=== Debug Context for Failed Test ===');
  console.log('Test:', testName);
  console.log('Node:', process.version);
  console.log('Platform:', process.platform);
  console.log('Cwd:', process.cwd());
  console.log('\n--- Environment Snapshot ---');

  Object.entries(process.env)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, val]) => {
      console.log(key + '=' + val);
    });

  console.log('--- End Environment Snapshot ---\n');
}

module.exports = { dumpDebugContext };
