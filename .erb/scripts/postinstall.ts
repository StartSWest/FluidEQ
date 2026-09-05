import { execFileSync } from 'child_process';

const pnpmScript = process.env.npm_execpath;
if (!pnpmScript) {
  throw new Error('Run postinstall through pnpm install.');
}
const pnpmIsScript = /\.[cm]?js$/i.test(pnpmScript);
const pnpmCommand = pnpmIsScript ? process.execPath : pnpmScript;

const runPnpm = (args: string[]) => {
  execFileSync(pnpmCommand, pnpmIsScript ? [pnpmScript, ...args] : args, {
    stdio: 'inherit',
    // npm_execpath names either pnpm's JS entry or its standalone executable.
    // Invoke it directly: shell:true concatenates arguments and raises DEP0190.
  });
};

runPnpm([
  'exec',
  'cross-env',
  'NODE_ENV=development',
  'TS_NODE_TRANSPILE_ONLY=true',
  'webpack',
  '--config',
  './.erb/configs/webpack.config.renderer.dev.dll.cjs',
]);

// Windows names a process from the version resource inside its executable, so
// the development binary calls itself "Electron" until it is stamped. Done here
// rather than by hand, so a reinstall repairs it instead of silently reverting.
require('./name-dev-electron');
