/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import fs from 'fs';
import { parseFile } from 'music-metadata';
import {
  type ILibraryTrackFacts,
  MAX_FACT_TEXT,
} from '../../common/library/trackFacts';

const finite = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;

/** A name as the parser gives it, bounded, or nothing. */
const shortText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== ''
    ? value.trim().slice(0, MAX_FACT_TEXT)
    : undefined;

/**
 * The facts the Details pane shows, read from the file: its container and
 * codec, depth, rate, channels and size. One `parseFile` with the covers
 * skipped — the pane wants none of the pictures, and an album's embedded art
 * is often most of the bytes the tags hold.
 */
export const readTrackFacts = async (
  filePath: string,
): Promise<ILibraryTrackFacts> => {
  try {
    const [{ format }, stats] = await Promise.all([
      parseFile(filePath, { skipCovers: true, duration: false }),
      fs.promises.stat(filePath),
    ]);
    const facts: ILibraryTrackFacts = {
      container: shortText(format.container),
      codec: shortText(format.codec),
      bitsPerSample: finite(format.bitsPerSample),
      bitrate: finite(format.bitrate),
      sampleRate: finite(format.sampleRate),
      channels: finite(format.numberOfChannels),
      sizeBytes: finite(stats.size),
    };
    if (typeof format.lossless === 'boolean') {
      facts.lossless = format.lossless;
    }
    return facts;
  } catch (error) {
    // eslint-disable-next-line no-console -- context-rich error before it is flattened for the pane
    console.error(`Could not read the facts of ${filePath}`, error);
    return { readFailed: true };
  }
};
