const os = require('os');
const path = require('path');
const log = require('electron-log/node');

// Keep real diagnostics, but never write test failures into the user's app log.
log.transports.file.resolvePathFn = () =>
  path.join(os.tmpdir(), `fluideq-jest-${process.pid}.log`);

module.exports = log;
