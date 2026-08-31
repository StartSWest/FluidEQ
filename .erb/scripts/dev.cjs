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

/**
 * Build the native engine first, every time.
 *
 * `pnpm dev` used to leave it alone, on the reasonable-sounding grounds that
 * the C++ changes rarely and CMake is slow. Both halves were wrong. The link
 * between the host and this process is a byte layout each side holds its own
 * copy of, so ANY change to it makes a stale binary desynchronise — surfacing
 * as diagnostic 3005 with `magic: 0`, which names the symptom and nothing
 * about the cause. Pulling across such a change and running `pnpm dev` is
 * exactly when it happens, and the app comes up with no audio, no meters and
 * no graph.
 *
 * A warm tree costs six seconds when nothing changed — measured, not guessed,
 * and most of it is CMake reconfiguring rather than ninja, which reports "no
 * work to do". Six seconds on every `pnpm dev` against an evening lost to a
 * silent desynchronisation is not a close call.
 *
 * A build failure stops the dev server rather than launching against the
 * previous binary. Launching against it is the whole failure this prevents.
 */
const buildNativeEngine = () => {
  const { execFileSync } = require('child_process');
  const tsNode = require.resolve('ts-node/dist/bin.js');
  const script = path.join(__dirname, 'build-native-dsp.ts');
  console.log(chalk.cyan('Building the native DSP engine…'));
  execFileSync(process.execPath, [tsNode, script], {
    stdio: 'inherit',
    env: process.env,
  });
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
      `Port "${port}" on "localhost" is already in use. Please use another port. ex: PORT=4343 pnpm dev`,
    ),
  );
  process.exit(1);
});

probe.once('listening', () => {
  probe.close(() => {
    try {
      buildNativeEngine();
    } catch {
      // `build-native-dsp` has already printed what CMake said; repeating it
      // here would bury it. Stopping is the point: a dev server running
      // against a stale engine is the failure being prevented.
      console.error(
        chalk.whiteBright.bgRed.bold(
          'The native DSP engine failed to build. Fix it before starting dev — running against the previous binary desynchronises the wire.',
        ),
      );
      process.exit(1);
    }
    startDevServer();
  });
});

probe.listen(port, '127.0.0.1');
