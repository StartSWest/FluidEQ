/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { parseFile } from 'music-metadata';
import { restoredKaraokeAudioPath } from './karaokeSession';

/**
 * How long a restored playlist song is, in seconds, or `null` where the file
 * does not say. A restored song is a name and a token in the window until it
 * is opened, so its row's length was read from an empty file and never
 * printed; the window's own way, a media element over the file's bytes,
 * would carry the whole song across for one number. Read here from the
 * file's header alone - no covers, no scan of the stream - the way the
 * Library reads a track's facts.
 */
const readRestoredKaraokeDuration = async (
  token: string,
): Promise<number | null> => {
  const localPath = restoredKaraokeAudioPath(token);
  if (!localPath) {
    return null;
  }
  try {
    const { format } = await parseFile(localPath, {
      skipCovers: true,
      duration: false,
    });
    const seconds = format.duration;
    return typeof seconds === 'number' &&
      Number.isFinite(seconds) &&
      seconds > 0
      ? seconds
      : null;
  } catch {
    // A song moved or deleted since the session was saved has no length to
    // print, which is what null says.
    return null;
  }
};

export default readRestoredKaraokeDuration;
