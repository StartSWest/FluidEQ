/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Configure and build the native DSP host for whichever platform is running.
 *
 * Nothing here reads the developer's PATH for a compiler. Visual Studio ships
 * CMake and Ninja inside itself and does not put either on PATH, so a script
 * that assumed `cmake` would resolve would work on a machine that happened to
 * have a second copy installed and fail on a clean one — which is the failure
 * the weekly cold build exists to catch, arriving a year late.
 *
 * `pnpm build` runs this. The host is never a manual prerequisite documented
 * in a README: a build that needs a step somebody has to remember is a build
 * that stops working the first time nobody does.
 */
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import { brotliDecompressSync } from 'zlib';

const ROOT = path.join(__dirname, '..', '..');
const NATIVE_DIR = path.join(ROOT, 'native');
const BUILD_DIR = path.join(NATIVE_DIR, '.build');
const PARITY_ARCHIVE = path.join(
  NATIVE_DIR,
  'dsp-core',
  'tests',
  'parity-fixtures.tar.br',
);
const PARITY_FIXTURES_DIR = path.join(BUILD_DIR, 'fixtures');
const PARITY_ARCHIVE_SHA256 =
  'a32a67ed8d38b6d321b6ba2e7a4cf85770ad896e8892a01c43501785c0586325';
const PARITY_FIXTURE_COUNT = 2085;

const isWindows = process.platform === 'win32';
const shouldClean = process.argv.includes('--clean');
const shouldTest = process.argv.includes('--test');

const fail = (message: string): never => {
  console.error(`native dsp build: ${message}`);
  process.exit(1);
};

/** The newest Visual Studio with the C++ toolset, or nothing. */
const visualStudioRoot = (): string | undefined => {
  const vswhere = path.join(
    process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
    'Microsoft Visual Studio',
    'Installer',
    'vswhere.exe',
  );
  if (!existsSync(vswhere)) {
    return undefined;
  }
  const found = spawnSync(
    vswhere,
    [
      '-latest',
      '-prerelease',
      '-products',
      '*',
      '-requires',
      'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
      '-property',
      'installationPath',
    ],
    { encoding: 'utf8' },
  );
  const install = found.stdout?.trim().split(/\r?\n/)[0];
  return install && existsSync(install) ? install : undefined;
};

interface ITools {
  cmake: string;
  /** Empty on platforms where the compiler is already on PATH. */
  environmentSetup: string;
  generator: string[];
}

const resolveTools = (): ITools => {
  if (!isWindows) {
    return { cmake: 'cmake', environmentSetup: '', generator: [] };
  }
  const vs = visualStudioRoot();
  if (!vs) {
    return fail(
      'Visual Studio with the C++ desktop workload was not found. Install ' +
        '"Desktop development with C++" and try again.',
    );
  }
  const bundled = path.join(
    vs,
    'Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe',
  );
  const ninja = path.join(
    vs,
    'Common7/IDE/CommonExtensions/Microsoft/CMake/Ninja/ninja.exe',
  );
  const vcvars = path.join(vs, 'VC/Auxiliary/Build/vcvars64.bat');
  if (!existsSync(vcvars)) {
    return fail(`vcvars64.bat is missing from ${vs}`);
  }
  const cmake = existsSync(bundled) ? bundled : 'cmake';
  const generator = existsSync(ninja)
    ? ['-G', 'Ninja', `-DCMAKE_MAKE_PROGRAM=${ninja}`]
    : [];
  return { cmake, environmentSetup: vcvars, generator };
};

/** One shell line that establishes the MSVC environment, then runs `exe`. */
const windowsShellCommand = (tools: ITools, exe: string, args: string[]) =>
  // stderr silenced along with stdout: vcvars probes for optional components
  // with its own copy of vswhere and reports the misses, which are harmless
  // and look exactly like a broken toolchain in a build log.
  `call "${tools.environmentSetup}" >nul 2>&1 && "${exe}" ${args
    .map((arg) => `"${arg}"`)
    .join(' ')}`;

/**
 * Run a command, inheriting stdio so a compiler error reaches the terminal
 * that asked for the build rather than being summarised away.
 */
const run = (tools: ITools, args: string[]) => {
  if (!isWindows) {
    const result = spawnSync(tools.cmake, args, { stdio: 'inherit' });
    if (result.status !== 0) {
      fail(`cmake exited with ${result.status}`);
    }
    return;
  }
  // MSVC needs the environment vcvars sets, and that environment cannot be
  // inherited from Node — it has to be established inside the same shell that
  // then runs the compiler.
  //
  // `shell: true` rather than an explicit `cmd.exe` argv: passing the command
  // as an argument makes Node escape every quote in it, and vcvars' own path
  // has a space in it, so the shell received \"C:\Program Files\...\" and
  // reported it as an unrecognised command.
  const result = spawnSync(windowsShellCommand(tools, tools.cmake, args), {
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    fail(`cmake exited with ${result.status}`);
  }
};

const gitRevision = (): string => {
  const found = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    encoding: 'utf8',
    cwd: ROOT,
  });
  return found.status === 0 ? (found.stdout ?? '').trim() : 'unknown';
};

const tools = resolveTools();

if (shouldClean) {
  // Scoped to the native build directory and nowhere else. A clean that
  // reaches further is a clean somebody eventually runs by accident.
  rmSync(BUILD_DIR, { recursive: true, force: true });
  console.log(`native dsp build: removed ${BUILD_DIR}`);
  process.exit(0);
}

/** Run one of the sibling generator scripts through this same Node. */
const generate = (script: string) => {
  const result = spawnSync(
    process.execPath,
    [require.resolve('ts-node/dist/bin'), path.join(__dirname, script)],
    {
      stdio: 'inherit',
      cwd: ROOT,
      // Transpile only, because the fixture generator imports processors that
      // are written against `AudioWorkletGlobalScope`. Their `sampleRate`
      // fallback has no declaration outside a worklet, and type-checking a
      // module here would fail on a global the app's own tsconfig supplies.
      // `pnpm typecheck` still covers all of it in the right context.
      env: { ...process.env, TS_NODE_TRANSPILE_ONLY: 'true' },
    },
  );
  if (result.status !== 0) {
    fail(`${script} exited with ${result.status}`);
  }
};

/**
 * Expand the final TypeScript-to-C++ comparison corpus without bringing the
 * retired TypeScript rack back into the tree.
 *
 * The corpus was frozen from commit 929e5d397, immediately before the
 * TypeScript processors were removed. Brotli is built into Node; the payload
 * is an ordinary POSIX tar so no platform package manager or archive utility
 * becomes a test prerequisite.
 */
const extractParityFixtures = (): void => {
  const compressed = readFileSync(PARITY_ARCHIVE);
  const digest = createHash('sha256').update(compressed).digest('hex');
  if (digest !== PARITY_ARCHIVE_SHA256) {
    fail(`the frozen parity archive has SHA-256 ${digest}`);
  }

  const tar = brotliDecompressSync(compressed);
  rmSync(PARITY_FIXTURES_DIR, { recursive: true, force: true });
  mkdirSync(PARITY_FIXTURES_DIR, { recursive: true });

  let offset = 0;
  let written = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      break;
    }

    const nul = header.indexOf(0);
    const rawName = header
      .subarray(0, nul < 0 ? 100 : Math.min(nul, 100))
      .toString('utf8');
    const sizeText = header
      .subarray(124, 136)
      .toString('ascii')
      .replace(/\0/g, '')
      .trim();
    const size = Number.parseInt(sizeText || '0', 8);
    const type = header[156];
    offset += 512;

    if (!Number.isSafeInteger(size) || size < 0 || offset + size > tar.length) {
      fail(`the frozen parity archive has an invalid entry: ${rawName}`);
    }

    if (type === 0 || type === 48) {
      const name = rawName.replace(/^\.\//, '');
      if (!name || name.includes('/') || name.includes('\\')) {
        fail(`the frozen parity archive has an unsafe entry: ${rawName}`);
      }
      writeFileSync(
        path.join(PARITY_FIXTURES_DIR, name),
        tar.subarray(offset, offset + size),
      );
      written += 1;
    } else if (!(type === 53 && (rawName === './' || rawName === '.'))) {
      fail(`the frozen parity archive has an unsupported entry: ${rawName}`);
    }

    offset += Math.ceil(size / 512) * 512;
  }

  if (written !== PARITY_FIXTURE_COUNT) {
    fail(
      `the frozen parity archive contains ${written} fixtures; expected ${PARITY_FIXTURE_COUNT}`,
    );
  }
  console.log(`native parity: ${written} frozen fixtures extracted`);
};

generate('generate-native-parameters.ts');

mkdirSync(BUILD_DIR, { recursive: true });

run(tools, [
  '-S',
  NATIVE_DIR,
  '-B',
  BUILD_DIR,
  ...tools.generator,
  '-DCMAKE_BUILD_TYPE=Release',
  `-DFEQ_BUILD_REVISION=${gitRevision()}`,
]);

run(tools, ['--build', BUILD_DIR, '--config', 'Release']);

if (shouldTest) {
  // After the build, not before: nothing but the tests reads the corpus, so an
  // ordinary `pnpm build` should not pay to expand it.
  extractParityFixtures();
  const ctest = path.join(
    path.dirname(tools.cmake),
    isWindows ? 'ctest.exe' : 'ctest',
  );
  const runner = existsSync(ctest) ? ctest : 'ctest';
  const args = [
    '--test-dir',
    BUILD_DIR,
    '--output-on-failure',
    '-C',
    'Release',
  ];
  const result = isWindows
    ? spawnSync(windowsShellCommand(tools, runner, args), {
        stdio: 'inherit',
        shell: true,
      })
    : spawnSync(runner, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    fail(`ctest exited with ${result.status}`);
  }
}

const hostName = isWindows ? 'FluidEQ-DSP.exe' : 'FluidEQ-DSP';
const hostPath = path.join(BUILD_DIR, 'bin', hostName);
if (!existsSync(hostPath)) {
  fail(`the host was not produced at ${hostPath}`);
}
console.log(`native dsp build: ${hostPath}`);
