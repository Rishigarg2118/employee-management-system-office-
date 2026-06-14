const { execSync } = require('child_process');
const path = require('path');

const tests = [
  { name: 'Enterprise Device Trust UAT', file: 'uat_device_trust.js' },
  { name: 'Desktop Productivity Agent UAT', file: 'uat_desktop_agent.js' },
  { name: 'Browser Intelligence Extension UAT', file: 'uat_browser_intelligence.js' },
  { name: 'Telemetry Processing Engine UAT', file: 'uat_telemetry_engine.js' },
  { name: 'Productivity Classification Rules UAT', file: 'uat_productivity_intelligence.js' },
  { name: 'Live workforce Command Center UAT', file: 'uat_workforce_command_center.js' },
  { name: 'Enterprise Analytics Reports UAT', file: 'uat_enterprise_reports.js' },
  { name: 'Secure JWT/HMAC Signatures End-to-End UAT', file: 'uat_test_secure.js' },
  { name: 'Concurrency & Workstation Stress Test', file: 'stress_test.js' }
];

console.log('===========================================================');
console.log('     STARTING FULL ENTERPRISE RELEASE CANDIDATE TESTS');
console.log('===========================================================\n');

let totalPassed = 0;
let totalFailed = 0;

for (const t of tests) {
  console.log(`Running: ${t.name} (${t.file})...`);
  const start = Date.now();
  try {
    const fullPath = path.join(__dirname, t.file);
    const runnerCmd = t.file === 'uat_desktop_agent.js' ? 'npx ts-node' : 'node';
    const output = execSync(`${runnerCmd} "${fullPath}"`, {
      env: { ...process.env, NODE_PATH: path.join(__dirname, '../backend/node_modules') },
      stdio: 'pipe'
    }).toString();
    const duration = Date.now() - start;
    console.log(output);
    console.log(`-----------------------------------------------------------`);
    console.log(`✅ Passed: ${t.name} (${duration}ms)\n`);
    totalPassed++;
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`❌ FAILED: ${t.name} (${duration}ms)`);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    console.error(err.message);
    console.log(`-----------------------------------------------------------\n`);
    totalFailed++;
  }
}

console.log('===========================================================');
console.log('                 FINAL TEST RUN SUMMARY');
console.log('===========================================================');
console.log(`Total Test Suites Executed : ${tests.length}`);
console.log(`Passed Suites              : ${totalPassed}`);
console.log(`Failed Suites              : ${totalFailed}`);
console.log('===========================================================');

if (totalFailed > 0) {
  process.exit(1);
} else {
  console.log('All release candidate verification suites passed. The system is Genuinely Production Ready!');
  process.exit(0);
}
