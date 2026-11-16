/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  karaokeFileRelativePath,
  karaokeRestoredFileToken,
  setKaraokeRelativePath,
  setKaraokeRestoredFileToken,
} from '../../common/karaoke/files';

/**
 * A restored session's files are empty shells with a token until their bytes
 * are asked for (`restoredKaraokeFile`): the song when it is opened, its
 * picture when it is drawn - on the stage, or on its row in the playlist.
 */
export const materializeRestoredAudio = async (file: File): Promise<File> => {
  const token = karaokeRestoredFileToken(file);
  if (!token) {
    return file;
  }
  const reader = window.electron?.ipcRenderer.readKaraokeSessionFile;
  if (!reader) {
    throw new Error('The saved karaoke file bridge is unavailable.');
  }
  const restored = await reader(token);
  if (!restored) {
    throw new Error('The saved karaoke audio is no longer available.');
  }
  const materialized = new File([Uint8Array.from(restored.data)], file.name, {
    type: restored.type || file.type,
    lastModified: restored.lastModified || file.lastModified,
  });
  setKaraokeRelativePath(materialized, karaokeFileRelativePath(file));
  setKaraokeRestoredFileToken(materialized, token);
  return materialized;
};

/**
 * The same fetch for artwork, but never fatal.
 *
 * A restored session hands back picture and video files as empty shells with a
 * token; the bytes only arrive when asked for. Without this the stage got a
 * zero-length blob and drew a broken image, which is worse than the gradient
 * it replaced. And unlike the audio, a cover that has been moved or deleted
 * since the session was saved is not a reason to fail the song — it is a
 * reason to have no cover.
 */
export const materializeRestoredMedia = async (
  file: File | undefined,
): Promise<File | undefined> => {
  if (!file) {
    return undefined;
  }
  try {
    return await materializeRestoredAudio(file);
  } catch {
    return undefined;
  }
};
