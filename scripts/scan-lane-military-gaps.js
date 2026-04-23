const originalLog = console.log;
console.log = () => {};
const { getMilitaryDeepScanReport } = await import('../services/genealogy.service.js');
console.log = originalLog;

const report = getMilitaryDeepScanReport();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
