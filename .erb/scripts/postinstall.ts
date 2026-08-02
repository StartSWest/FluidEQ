import { execFileSync } from 'child_process';

const pnpmCommand = process.env.npm_execpath || 'pnpm';

const runPnpm = (args: string[]) => {
  execFileSync(pnpmCommand, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32' && !process.env.npm_execpath,
  });
};

runPnpm([
  'exec',
  'cross-env',
  'NODE_ENV=development',
  'TS_NODE_TRANSPILE_ONLY=true',
  'webpack',
  '--config',
  './.erb/configs/webpack.config.renderer.dev.dll.ts',
]);
