/* FluidEQ — GPL-3.0-or-later */
// Run from the repo root with native arrival replay, baseline source and new
// source executable paths. All three are device-free fixture targets.
// This never opens an audio device, starts FluidEQ or sends network traffic.
process.env.NODE_ENV = 'production';
require('ts-node/register/transpile-only');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const base = require('../configs/webpack.config.base').default;
const entry = path.resolve('.erb/scripts/share-audio-continuity-fixture.cjs');
const folder = path.resolve('outputs/share-audio-continuity');
if (!process.argv[2] || !process.argv[3] || !process.argv[4])
  throw new Error('Provide replay, baseline-source and source fixture paths.');
os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL);
const run = (file, args) =>
  new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) reject(new Error(`${error.message}\n${stderr}`));
      else resolve(stdout.trim());
    });
  });
const build = new Promise((resolve, reject) =>
  webpack(
    {
      ...base,
      mode: 'production',
      target: 'node',
      externalsType: 'commonjs',
      parallelism: 1,
      entry,
      output: { ...base.output, path: folder, filename: 'fixture.cjs' },
      node: { __dirname: false, __filename: false },
      optimization: {
        minimize: true,
        minimizer: [new TerserPlugin({ parallel: false })],
      },
      plugins: [
        ...base.plugins,
        new webpack.DefinePlugin({
          'process.env.FEQ_FIXTURE_SOURCE': JSON.stringify('0'),
        }),
      ],
    },
    (error, stats) =>
      error || stats.hasErrors()
        ? reject(error || new Error(stats.toString('errors-only')))
        : resolve(),
  ),
);
build
  .then(async () => {
    const results = [];
    for (const load of ['sleep', 'load']) {
      for (let repeat = 0; repeat < 3; repeat += 1) {
        for (const mode of ['baseline', 'worker']) {
          const source = path.resolve(
            process.argv[mode === 'baseline' ? 3 : 4],
          );
          const result = JSON.parse(
            await run(process.execPath, [
              path.join(folder, 'fixture.cjs'),
              mode,
              load,
              source,
            ]),
          );
          if (mode === 'worker' && !result.scheduling)
            process.stderr.write(JSON.stringify(result) + '\n');
          if (
            !result.ordered ||
            result.received !== result.sent ||
            result.received === 0 ||
            result.visualFrames === 0
          )
            throw new Error('Fixture corrupted or reordered PCM.');
          if (
            mode === 'worker' &&
            (result.sent !== 1600 || !result.consecutive || !result.scheduling)
          )
            throw new Error(
              'Audio service did not preserve capture continuity or obtain scoped scheduling.',
            );
          if (process.argv[2])
            result.playback = JSON.parse(
              await run(path.resolve(process.argv[2]), [
                path.resolve(`outputs/share-audio-${mode}-arrivals.txt`),
              ]),
            );
          results.push({ repeat, ...result });
          process.stdout.write(
            JSON.stringify(results[results.length - 1]) + '\n',
          );
        }
      }
    }
    fs.writeFileSync(
      path.join(folder, 'results.json'),
      JSON.stringify(results, null, 2),
    );
  })
  .catch((error) => {
    process.stderr.write(String(error));
    process.exitCode = 1;
  });
