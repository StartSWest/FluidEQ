import { execFileSync } from 'child_process';

const pnpmScript = process.env.npm_execpath;
const pnpmCommand =
  pnpmScript && /\.[cm]?js$/i.test(pnpmScript) ? process.execPath : 'pnpm';

const runPnpm = (args: string[]) => {
  execFileSync(
    pnpmCommand,
    pnpmCommand === process.execPath ? [pnpmScript!, ...args] : args,
    {
      stdio: 'inherit',
      shell: process.platform === 'win32' && pnpmCommand === 'pnpm',
    }
  );
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
