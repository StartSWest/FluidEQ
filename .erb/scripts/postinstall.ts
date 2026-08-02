import { execFileSync } from 'child_process';

const runPnpm = (args: string[]) => {
  execFileSync('pnpm', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
};

if (process.platform === 'win32') {
  execFileSync('pnpm', ['exec', 'electron-builder', 'install-app-deps'], {
    stdio: 'inherit',
    shell: true,
  });
}

runPnpm([
  'exec',
  'cross-env',
  'NODE_ENV=development',
  'TS_NODE_TRANSPILE_ONLY=true',
  'webpack',
  '--config',
  './.erb/configs/webpack.config.renderer.dev.dll.ts',
]);
