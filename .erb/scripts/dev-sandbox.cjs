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
 */
require('./dev-privileges.cjs')();

const chalk = require('chalk');
const net = require('net');
const os = require('os');
const path = require('path');

process.env.PORT = process.env.PORT || '1213';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.TS_NODE_TRANSPILE_ONLY = 'true';
process.env.WEBPACK_CLI_SKIP_IMPORT_LOCAL = 'true';
process.env.FLUIDEQ_SANDBOX_DIR =
  process.env.FLUIDEQ_SANDBOX_DIR || path.join(os.tmpdir(), 'fluideq-sandbox');
process.env.FLUIDEQ_SANDBOX_CDP_PORT =
  process.env.FLUIDEQ_SANDBOX_CDP_PORT || '9244';

if (process.env.PORT === '1212') {
  console.error(
    chalk.whiteBright.bgRed.bold(
      'Port 1212 is the development window. A sandbox needs a port of its own.',
    ),
  );
  process.exit(1);
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
        `Sandbox: data in ${process.env.FLUIDEQ_SANDBOX_DIR}, DevTools on ${process.env.FLUIDEQ_SANDBOX_CDP_PORT}, no engine install.`,
      ),
    );
    startDevServer();
  });
});
probe.listen(Number(process.env.PORT), '127.0.0.1');
