/** Keep main's measured native builder intact; add Linux's platform wiring. */
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
if (process.platform === 'linux') {
  const toolchain = path.join(root, 'native/linux/toolchain.cmake');
  if (
    process.env.CMAKE_TOOLCHAIN_FILE &&
    path.resolve(process.env.CMAKE_TOOLCHAIN_FILE) !== toolchain
  ) {
    throw new Error(
      'The Linux build needs its platform toolchain; refusing to replace a different CMAKE_TOOLCHAIN_FILE.',
    );
  }
  process.env.CMAKE_TOOLCHAIN_FILE = toolchain;
  const build = path.join(root, 'native/.build');
  const cache = path.join(build, 'CMakeCache.txt');
  if (fs.existsSync(cache)) {
    const configured = fs
      .readFileSync(cache, 'utf8')
      .match(/^CMAKE_TOOLCHAIN_FILE:[^=]+=(.+)$/m)?.[1];
    if (configured && path.resolve(configured) !== toolchain) {
      throw new Error(
        'The native build was configured with a different toolchain.',
      );
    }
    if (!configured) {
      // CMake reads the toolchain while discovering the compiler. Discard only
      // pre-toolchain configure metadata; keep all produced helper binaries.
      fs.rmSync(cache);
      fs.rmSync(path.join(build, 'CMakeFiles'), {
        recursive: true,
        force: true,
      });
    }
  }
}

// The shared script owns generators, compiler discovery, tests and Windows
// packaging. Loading it after the Linux environment keeps that code identical.
require('./build-native-dsp');

if (process.platform === 'linux') {
  [
    'FluidEQ-Engine',
    'FluidEQ-Volume',
    'FluidEQ-Media',
    'FluidEQ-Wallpaper',
  ].forEach((name) => {
    if (!fs.existsSync(path.join(root, 'native/.build/bin', name))) {
      throw new Error(`The Linux native build did not produce ${name}.`);
    }
  });
}
