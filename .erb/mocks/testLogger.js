const os = require('os');
const path = require('path');
const log = require('electron-log/node');

// Keep real diagnostics, but never write test failures into the user's app log.
log.transports.file.resolvePathFn = () =>
  path.join(os.tmpdir(), `fluideq-jest-${process.pid}.log`);

// Nothing on the console unless asked for. Dozens of suites drive a failure on
// purpose — a broken profile, a missing helper, a full disk — and the app logs
// each one as it should; printed, those lines filled the CI log with red that
// read as failures when every test had passed. A test that cares what was
// logged spies on `log` and asserts it; the lines still land in the file
// above. FLUIDEQ_TEST_LOG=1 prints them again, for reading one suite's run.
log.transports.console.level = process.env.FLUIDEQ_TEST_LOG ? 'silly' : false;

module.exports = log;
