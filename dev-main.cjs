const { app } = require('electron');

app.setName('FluidEQ');
require('ts-node/register/transpile-only');
const {
  exitDevSessionOnAppQuit,
} = require('./.erb/scripts/exit-dev-session-on-app-quit');

exitDevSessionOnAppQuit(app);

// The renderer gets the public values from webpack, and the packaged main
// process now gets them from EnvironmentPlugin. Development main got them from
// nowhere: `src/common` is read by both halves, so a constant like
// PRODUCT_VERSION was correct in the window and an empty string a few
// milliseconds away in the same app.
//
// The defaults rather than the .env file alone. Some of these are not in .env
// at all — FLUIDEQ_VERSION is read from release/app/package.json — so loading
// the file would have fixed the address and left the version empty. Filling
// only what is unset is what EnvironmentPlugin does, so the two halves resolve
// by the same rule. Before main, because these are read at module scope.
Object.entries(require('./.erb/configs/public-env').default).forEach(
  ([key, value]) => {
    if (process.env[key] === undefined) {
      process.env[key] = String(value);
    }
  },
);

require('./src/main/main.ts');
