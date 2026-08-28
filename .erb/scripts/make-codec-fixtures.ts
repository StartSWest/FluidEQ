/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One short clip in every container the native decoder claims to read.
 *
 * Written to the temp directory rather than committed, for two reasons. A
 * repository is not the place for five more audio files, and — the one that
 * matters — an encoder is a dependency of this check and of nothing else. The
 * build does not need ffmpeg, the app does not need ffmpeg, and nothing ships
 * with ffmpeg. It is used here the way a hammer is used to build a house that
 * does not then contain a hammer.
 *
 * `smoke-decoders.ts` skips a format whose fixture is absent and says which,
 * so a machine without an encoder runs a smaller honest suite rather than a
 * green one that tested nothing.
 */
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

/** Container to codec. The names are ffmpeg's. */
const FORMATS: readonly { extension: string; codec: string }[] = [
  { extension: 'flac', codec: 'flac' },
  { extension: 'ogg', codec: 'libvorbis' },
  { extension: 'm4a', codec: 'aac' },
  { extension: 'wma', codec: 'wmav2' },
  { extension: 'opus', codec: 'libopus' },
];

const main = (): void => {
  const source = path.resolve(__dirname, '../..', 'karaoke_instrumental.mp3');
  if (!existsSync(source)) {
    console.error(`codec fixtures: ${source} is missing`);
    process.exit(2);
  }

  const probe = spawnSync('ffmpeg', ['-version'], { windowsHide: true });
  if (probe.status !== 0) {
    // Not an error. The suite is designed to run without these.
    console.log('codec fixtures: no ffmpeg on PATH, nothing written');
    console.log('  smoke-decoders will skip the formats it cannot find');
    return;
  }

  const into = tmpdir();
  FORMATS.forEach(({ extension, codec }) => {
    const target = path.join(into, `feq-test.${extension}`);
    // Eight seconds: long enough that a seek to one second still has audio
    // after it, short enough that five of them cost nothing.
    const run = spawnSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-i', source, '-t', '8', '-c:a', codec, target],
      { windowsHide: true },
    );
    if (run.status === 0 && existsSync(target)) {
      console.log(`  ${extension.padEnd(5)} ${target}`);
      return;
    }
    // Named rather than swallowed: a build of ffmpeg without libopus is a
    // normal thing to have, and "opus was skipped" is more useful than a
    // format quietly missing from the suite later.
    console.log(`  ${extension.padEnd(5)} not encoded (${codec} unavailable)`);
  });
};

main();
