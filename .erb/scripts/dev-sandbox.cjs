/**
 * A second development copy of FluidEQ that cannot reach the sound of the one
 * it runs beside (`src/main/devSandbox.ts`).
 *
 * What `dev.cjs` does, less the two steps that change the machine: it never
 * swaps the installed FluidEQ Engine for the one just built (that is an
 * elevated install and a Windows audio restart), and never stamps the shared
 * development Electron binary. Its own dev server port, DevTools port and data
 * folder, so it can run while `pnpm dev` does.
 *
 *   pnpm dev:sandbox            data in %TEMP%\fluideq-sandbox
 *   FLUIDEQ_SANDBOX_DIR=D:\x pnpm dev:sandbox
 *
 * With FLUIDEQ_SANDBOX_ENGINE=live it is the experimental build instead: it
 * drives the real engine, so it can be heard, and takes the real single-copy
 * lock, so it runs only while the listener's own FluidEQ does not. Its data
 * is its own — by default %APPDATA%\FluidEQ-experimental, copied from the
 * development FluidEQ's on its first run — so going back to that FluidEQ
 * finds everything as it was left. It still installs and repairs nothing.
 */
require('./dev-privileges.cjs')();

const chalk = require('chalk');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

const isLive = process.env.FLUIDEQ_SANDBOX_ENGINE === 'live';

process.env.PORT = process.env.PORT || '1213';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.TS_NODE_TRANSPILE_ONLY = 'true';
process.env.WEBPACK_CLI_SKIP_IMPORT_LOCAL = 'true';
process.env.FLUIDEQ_SANDBOX_DIR =
  process.env.FLUIDEQ_SANDBOX_DIR ||
  (isLive
    ? path.join(process.env.APPDATA || os.homedir(), 'FluidEQ-experimental')
    : path.join(os.tmpdir(), 'fluideq-sandbox'));
process.env.FLUIDEQ_SANDBOX_CDP_PORT =
  process.env.FLUIDEQ_SANDBOX_CDP_PORT || '9244';

const fail = (message) => {
  console.error(chalk.whiteBright.bgRed.bold(message));
  process.exit(1);
};

/**
 * The experimental build drives the engine, and the engine takes its orders
 * from whichever FluidEQ holds its owner pipe: two at once would fight over
 * every config. The app's own lock refuses the second as well; this says why
 * before anything is built.
 */
const ownerPipeIsHeld = () => {
  try {
    return fs.readdirSync('\\\\.\\pipe\\').includes('FluidEQ-Engine-Owner');
  } catch {
    return false;
  }
};

/**
 * What a first run copies from the development FluidEQ's data: everything a
 * listener set up — presets, profiles, the Library, scenes, Karaoke — and
 * none of what Chromium rebuilds by itself or the logs.
 */
const NOT_COPIED = new Set([
  'logs',
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'Partitions',
  'Crashpad',
  'blob_storage',
  'DIPS',
  'DIPS-wal',
  'lockfile',
  'DevToolsActivePort',
  'library-index.json.bak',
  'library-index.migrated.json',
]);

const seedFromDevelopmentData = (userData) => {
  if (fs.existsSync(userData)) {
    return;
  }
  const source = path.join(process.env.APPDATA || os.homedir(), 'FluidEQ');
  if (!fs.existsSync(source)) {
    return;
  }
  console.log(chalk.cyan(`Copying your FluidEQ's settings from ${source}…`));
  fs.cpSync(source, userData, {
    recursive: true,
    filter: (from) => {
      const name = path.relative(source, from).split(path.sep)[0];
      return !NOT_COPIED.has(name) && !name.startsWith('Singleton');
    },
  });
};

if (isLive) {
  if (ownerPipeIsHeld()) {
    fail(
      'Your FluidEQ is running. Quit it from its tray icon first: one FluidEQ drives the engine at a time.',
    );
  }
  seedFromDevelopmentData(
    path.join(process.env.FLUIDEQ_SANDBOX_DIR, 'userData'),
  );
}

if (process.env.PORT === '1212') {
  fail(
    'Port 1212 is the development window. A sandbox needs a port of its own.',
  );
}

const buildNativeEngine = () => {
  const { execFileSync } = require('child_process');
  const tsNode = require.resolve('ts-node/dist/bin.js');
  console.log(chalk.cyan('Building the native DSP engine…'));
  execFileSync(
    process.execPath,
    [tsNode, path.join(__dirname, 'build-native-dsp.ts')],
    { stdio: 'inherit', env: process.env },
  );
};

const startDevServer = () => {
  const cli = require.resolve('webpack-cli/bin/cli.js');
  const config = path.join(
    __dirname,
    '..',
    'configs',
    'webpack.config.renderer.dev.cjs',
  );
  process.argv = [process.argv[0], cli, 'serve', '--config', config];
  require(cli);
};

const probe = net.createServer();
probe.once('error', () => {
  console.error(
    chalk.whiteBright.bgRed.bold(
      `Port "${process.env.PORT}" is already in use. Set PORT to another one.`,
    ),
  );
  process.exit(1);
});
probe.once('listening', () => {
  probe.close(() => {
    try {
      buildNativeEngine();
    } catch {
      console.error(
        chalk.whiteBright.bgRed.bold('The native DSP engine failed to build.'),
      );
      process.exit(1);
    }
    console.log(
      chalk.cyan(
        `${isLive ? 'Experimental, driving the real engine' : 'Sandbox'}: data in ${process.env.FLUIDEQ_SANDBOX_DIR}, DevTools on ${process.env.FLUIDEQ_SANDBOX_CDP_PORT}, no engine install.`,
      ),
    );
    startDevServer();
  });
});
probe.listen(Number(process.env.PORT), '127.0.0.1');
