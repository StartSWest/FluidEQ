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

/**
 * A library track, turned into the `File` the Karaoke tab works in.
 *
 * The two tabs hold songs in genuinely different shapes and neither is wrong.
 * The library holds ids and lets main own the paths; karaoke holds `File`
 * objects, because it arrived through drag-and-drop and a folder picker and
 * has decoded, seeked and separated stems out of blobs ever since. Converting
 * at the boundary is cheaper and far less risky than teaching either side the
 * other's model.
 *
 * `libraryTrackBytes` already exists for playback and does exactly the read
 * this needs — including declining anything past its size cap, which is the
 * honest answer here too.
 */

import {
  KARAOKE_AUDIO_EXTENSIONS,
  setKaraokeRelativePath,
} from '../../common/karaoke/files';
import { ILibraryTrack } from '../../common/library/types';

/** Chromium sniffs the container anyway; this is for the ones it does not. */
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
};

const fileNameOf = (track: ILibraryTrack): string => {
  const separator = Math.max(
    track.path.lastIndexOf('\\'),
    track.path.lastIndexOf('/'),
  );
  return separator < 0 ? track.path : track.path.slice(separator + 1);
};

const extensionOf = (track: ILibraryTrack): string => {
  const name = fileNameOf(track);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
};

/**
 * Whether the Karaoke tab could open this at all.
 *
 * Video is out because a karaoke song is an audio track with words over it,
 * and the tab's own importer only pairs audio. Containers karaoke has no
 * decoder for are out for the plainer reason that it would fail after the
 * read rather than before it — a menu item that spends four seconds copying a
 * file and then says no is worse than one that was never offered.
 */
export const canSendTrackToKaraoke = (track: ILibraryTrack): boolean =>
  track.kind === 'audio' &&
  (KARAOKE_AUDIO_EXTENSIONS as readonly string[]).includes(extensionOf(track));

/**
 * The bytes, as a named `File`, or undefined if main declined to hand them
 * over — an unreadable file, or one past the playback size cap.
 *
 * The relative path is set to the bare file name rather than the real
 * directory, and that is deliberate: the karaoke playlist groups by relative
 * folder, so a real path would file this song under `D:/Music/Albums/…` and
 * build a folder tree out of the library's own layout inside a list that is
 * meant to be the handful of songs somebody sent over.
 */
export const trackAsKaraokeFile = async (
  track: ILibraryTrack,
): Promise<File | undefined> => {
  const bytes = await window.electron.ipcRenderer.libraryTrackBytes(track.id);
  if (!bytes) {
    return undefined;
  }
  const name = fileNameOf(track);
  const file = new File([bytes], name, {
    type: MIME_BY_EXTENSION[extensionOf(track)] ?? '',
  });
  return setKaraokeRelativePath(file, name);
};
