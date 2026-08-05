/**
 * Starts the renderer dev server, which in turn starts the preload build and
 * the main process (see `webpack.config.renderer.dev.ts`).
 *
 * It runs webpack-cli inside *this* process rather than shelling out, and the
 * reason is Ctrl+C. `pnpm` and everything in `node_modules/.bin` are `.cmd`
 * shims on Windows, and cmd.exe answers Ctrl+C inside a batch file by stopping
 * to ask "Terminate batch job (Y/N)?". The old chain — pnpm, pnpm, cross-env,
 * webpack — stacked four of those between the console and the dev server. One
 * plain node process asks nothing and dies on the first Ctrl+C.
 */
const chalk = require('chalk');
const net = require('net');
const path = require('path');

const port = Number(process.env.PORT || 1212);

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.TS_NODE_TRANSPILE_ONLY = 'true';
// We resolved the local webpack-cli ourselves; skip its own re-resolution.
process.env.WEBPACK_CLI_SKIP_IMPORT_LOCAL = 'true';

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
      `Port "${port}" on "localhost" is already in use. Please use another port. ex: PORT=4343 pnpm dev`,
    ),
  );
  process.exit(1);
});

probe.once('listening', () => {
  probe.close(startDevServer);
});

probe.listen(port, '127.0.0.1');
