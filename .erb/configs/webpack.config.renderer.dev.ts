import 'webpack-dev-server';
import path from 'path';
import fs from 'fs';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import chalk from 'chalk';
import { merge } from 'webpack-merge';
import {
  execFileSync,
  execSync,
  spawn,
  type ChildProcess,
} from 'child_process';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import baseConfig from './webpack.config.base';
import webpackPaths from './webpack.paths';
import DSP_WORKLET_ENTRY from './webpack.dspWorklet';
import checkNodeEnv from '../scripts/check-node-env';
import PUBLIC_ENV_DEFAULTS from './public-env';

// When an ESLint server is running, we can't set the NODE_ENV so we'll check if it's
// at the dev webpack config is not accidentally run in a production environment
if (process.env.NODE_ENV === 'production') {
  checkNodeEnv('development');
}

const port = process.env.PORT || 1212;
const manifest = path.resolve(webpackPaths.dllPath, 'renderer.json');
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const requiredByDLLConfig = module.parent!.filename.includes(
  'webpack.config.renderer.dev.dll',
);

/**
 * Warn if the DLL is not built
 */
if (
  !requiredByDLLConfig &&
  !(fs.existsSync(webpackPaths.dllPath) && fs.existsSync(manifest))
) {
  console.log(
    chalk.black.bgYellow.bold(
      'The DLL files are missing. Sit back while we build them for you with "npm run build-dll"',
    ),
  );
  execSync('pnpm postinstall');
}

const configuration: webpack.Configuration = {
  devtool: 'inline-source-map',

  mode: 'development',

  // Coalesce a burst of editor saves into one completed compilation. The
  // renderer then receives a single HMR update instead of several reloads.
  watchOptions: {
    aggregateTimeout: 250,
    // Also every embedded worktree: Claude sessions and the IDE both park
    // whole checkouts (with their own node_modules) inside the repo, and a
    // stale one with a locked file once killed the entire dev process with
    // an unhandled EPERM from the watcher's scan.
    ignored: /node_modules|[\\/]\.claude[\\/]|[\\/]\.gigaide[\\/]/,
  },

  target: ['web', 'electron-renderer'],

  resolve: {
    conditionNames: ['browser', 'import', 'module', 'default'],
    alias: {
      '@fluideq/whisper-wasm': path.resolve(
        webpackPaths.rootPath,
        'node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.wasm',
      ),
      '@fluideq/whisper-runtime': path.resolve(
        webpackPaths.rootPath,
        'node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs',
      ),
    },
  },

  entry: {
    renderer: [
      `webpack-dev-server/client?http://localhost:${port}/dist`,
      'webpack/hot/only-dev-server',
      path.join(webpackPaths.srcRendererPath, 'index.tsx'),
    ],
    'karaoke-whisper-worker': path.join(
      webpackPaths.srcRendererPath,
      'karaoke/whisper.worker.ts',
    ),
    // Defined in one place so dev and prod cannot diverge; see that file for
    // the three non-default settings a worklet build needs.
    'dsp-worklet': DSP_WORKLET_ENTRY,
  },

  output: {
    path: webpackPaths.distRendererPath,
    publicPath: '/',
    filename: '[name].dev.js',
    library: {
      type: 'umd',
    },
  },

  module: {
    rules: [
      {
        test: /\.s?css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: true,
              sourceMap: true,
              importLoaders: 1,
            },
          },
          'sass-loader',
        ],
        include: /\.module\.s?(c|a)ss$/,
      },
      {
        test: /\.s?css$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
        exclude: /\.module\.s?(c|a)ss$/,
      },
      // Fonts
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
      // Images
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
      // Emitted separately so AudioWorklet.addModule receives executable JS
      // in development exactly as it does in the packaged renderer.
      {
        test: /\.worklet$/i,
        type: 'asset/resource',
        generator: { filename: '[name].js' },
      },
      {
        test: /\.(json|bin)$/i,
        resourceQuery: /url/,
        type: 'asset/resource',
        generator: { filename: 'karaoke-models/basic-pitch/[name][ext]' },
      },
      {
        // ONNX Runtime dynamically imports the JS bootstrap before it opens
        // the WASM binary. They must be emitted together under stable names,
        // so these cannot be content-hashed.
        //
        // Both Karaoke workers land here — the speech model reaches ONNX
        // through @huggingface/transformers, the separation worker imports
        // onnxruntime-web directly — and that is only safe because the two
        // resolve to one version. `onnxruntime-web` is pinned in package.json
        // to the exact build transformers depends on, rather than to a range.
        // Two versions ship these same basenames with different content, and
        // webpack fails the build outright: "Multiple chunks emit assets to
        // the same filename". One copy also keeps a second ORT runtime out of
        // the bundle.
        test: /ort-wasm-simd-threaded\.jsep\.(?:mjs|wasm)$/i,
        type: 'asset/resource',
        generator: { filename: 'karaoke-models/whisper/[name][ext]' },
      },
    ],
  },
  plugins: [
    ...(requiredByDLLConfig
      ? []
      : [
          new webpack.DllReferencePlugin({
            context: webpackPaths.dllPath,
            manifest: require(manifest),
            sourceType: 'var',
          }),
        ]),

    new webpack.NoEmitOnErrorsPlugin(),

    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     *
     * By default, use 'development' as NODE_ENV. This can be overriden with
     * 'staging', for example, by changing the ENV variables in the npm scripts
     */
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'development',
      ...PUBLIC_ENV_DEFAULTS,
    }),

    new webpack.LoaderOptionsPlugin({
      debug: true,
    }),

    new ReactRefreshWebpackPlugin({ overlay: false }),

    new HtmlWebpackPlugin({
      filename: path.join('index.html'),
      template: path.join(webpackPaths.srcRendererPath, 'index.ejs'),
      minify: {
        collapseWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true,
      },
      isBrowser: false,
      env: process.env.NODE_ENV,
      isDevelopment: process.env.NODE_ENV !== 'production',
      nodeModules: webpackPaths.appNodeModulesPath,
      chunks: ['renderer'],
    }),
  ],

  node: {
    __dirname: false,
    __filename: false,
  },

  devServer: {
    port,
    compress: true,
    hot: true,
    // React Fast Refresh/HMR updates the existing window in place. A full
    // live-reload would throw away the UI state on every source save.
    liveReload: false,
    client: {
      overlay: false,
    },
    headers: { 'Access-Control-Allow-Origin': '*' },
    static: {
      publicPath: '/',
    },
    historyApiFallback: {
      verbose: true,
    },
    // Ctrl+C is handled below instead: the built-in handler asks for a second
    // one before it lets go, and the point is to leave nothing running.
    setupExitSignals: false,
    setupMiddlewares(middlewares) {
      const children: ChildProcess[] = [];
      let shuttingDown = false;

      /**
       * Run a CLI on its own node process. Not `pnpm <script>`: pnpm and every
       * `node_modules/.bin` entry are `.cmd` shims on Windows, and Ctrl+C
       * inside a batch file stops cmd.exe to ask "Terminate batch job (Y/N)?".
       */
      const spawnNode = (
        bin: string,
        args: string[],
        env: NodeJS.ProcessEnv,
      ) => {
        const child = spawn(process.execPath, [require.resolve(bin), ...args], {
          stdio: 'inherit',
          env: { ...process.env, ...env },
        });
        children.push(child);
        return child;
      };

      /** One Ctrl+C takes the whole dev session down, orphaning nothing. */
      const shutdown = () => {
        if (shuttingDown) return;
        shuttingDown = true;

        children.forEach((child) => {
          if (!child.pid || child.exitCode !== null) return;
          try {
            if (process.platform === 'win32') {
              // Electron is a grandchild of electronmon; /T reaches it.
              execFileSync(
                'taskkill',
                ['/pid', String(child.pid), '/T', '/F'],
                { stdio: 'ignore' },
              );
            } else {
              child.kill('SIGKILL');
            }
          } catch {
            // Already gone.
          }
        });

        process.exit(0);
      };

      // Prepended so it beats webpack-cli's own graceful-shutdown handler.
      (['SIGINT', 'SIGTERM', 'SIGBREAK'] as NodeJS.Signals[]).forEach(
        (signal) => process.prependListener(signal, shutdown),
      );

      console.log('Starting preload.js builder...');
      const preloadProcess = spawnNode(
        'webpack-cli/bin/cli.js',
        ['--config', path.join(__dirname, 'webpack.config.preload.dev.cjs')],
        { NODE_ENV: 'development', TS_NODE_TRANSPILE_ONLY: 'true' },
      )
        .on('close', (code: number) => {
          if (!shuttingDown) process.exit(code!);
        })
        .on('error', (spawnError) => console.error(spawnError));

      console.log('Starting Main Process...');
      spawnNode('electronmon/bin/cli.js', ['dev-main.cjs', '--no-sandbox'], {
        NODE_ENV: 'development',
      })
        .on('close', (code: number) => {
          if (shuttingDown) return;
          preloadProcess.kill();
          process.exit(code!);
        })
        .on('error', (spawnError) => console.error(spawnError));
      return middlewares;
    },
  },
};

export default merge(baseConfig, configuration);
