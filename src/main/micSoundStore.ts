/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where each microphone's sound is kept: `mic-sound.json` in userData,
 * written whole by temp-and-rename so a crash mid-write leaves the previous
 * file, never half of one.
 */

import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import {
  clampMicSoundFile,
  EMPTY_MIC_SOUND,
  IMicSoundFile,
} from '../common/micSound';
import writeFileAtomically from './atomicWrite';

export const MIC_SOUND_FILENAME = 'mic-sound.json';

export const readMicSound = (userDataDir: string): IMicSoundFile => {
  let content: string;
  try {
    content = fs.readFileSync(
      path.join(userDataDir, MIC_SOUND_FILENAME),
      'utf8',
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.error('Could not read the microphones’ sound', error);
    }
    return EMPTY_MIC_SOUND;
  }
  try {
    return clampMicSoundFile(JSON.parse(content));
  } catch (error) {
    // A file that does not parse is kept aside rather than overwritten, so
    // whatever was in it can still be recovered by hand.
    log.error(
      'The microphones’ sound file is unreadable; starting clean',
      error,
    );
    try {
      fs.renameSync(
        path.join(userDataDir, MIC_SOUND_FILENAME),
        path.join(userDataDir, `${MIC_SOUND_FILENAME}.unreadable`),
      );
    } catch (renameError) {
      log.error('Could not set the unreadable file aside', renameError);
    }
    return EMPTY_MIC_SOUND;
  }
};

export const writeMicSound = (userDataDir: string, file: IMicSoundFile): void =>
  writeFileAtomically(
    path.join(userDataDir, MIC_SOUND_FILENAME),
    `${JSON.stringify(file, null, 2)}\n`,
  );
