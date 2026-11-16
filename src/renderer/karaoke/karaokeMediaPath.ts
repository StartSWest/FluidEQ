/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { karaokeRestoredFileToken } from '../../common/karaoke/files';

/**
 * Where a karaoke song's file is on disk, for the Library's native player.
 *
 * The Karaoke holds songs as `File` objects — it arrived through drag-and-drop
 * and a folder picker, and decodes, seeks and separates out of blobs — while
 * the host decodes a file by its path, as it does every Library track. Four
 * kinds of file reach the Karaoke and each knows its path a different way:
 *
 * - dropped or picked: Electron names the real file (`getPathForFile`);
 * - sent from the Library: a copy of the bytes, so the Library's own path is
 *   noted on it when it is made (`libraryToKaraoke.ts`);
 * - restored from last session: bytes main read back from a path the window
 *   named when it saved, asked for by the token it was handed;
 * - a separated stem: written by main under the song's id, asked for by it.
 *
 * A file with no path — a stem whose save failed, a byte copy nobody noted —
 * plays where it always has, on the page's own `<audio>` element.
 */
export type TKaraokeHostSource =
  | { kind: 'path'; path: string }
  | { kind: 'stem'; key: string; role: 'vocals' | 'instrumental' };

const HOST_SOURCE = Symbol('karaokeHostSource');

type TSourcedFile = File & { [HOST_SOURCE]?: TKaraokeHostSource };

/** Note where a file made from bytes really lives. Returns the same file. */
export const setKaraokeHostSource = (
  file: File,
  source: TKaraokeHostSource,
): File => {
  (file as TSourcedFile)[HOST_SOURCE] = source;
  return file;
};

/**
 * One of a song's two stems as the Karaoke holds it, noted as the stem main
 * keeps on disk under the song's id (`karaoke-stems-*` in main's
 * `karaokeSeparation.ts`).
 */
export const karaokeStemFile = (
  key: string,
  role: 'vocals' | 'instrumental',
  bytes: BlobPart,
  name: string,
): File =>
  setKaraokeHostSource(new File([bytes], name, { type: 'audio/wav' }), {
    kind: 'stem',
    key,
    role,
  });

const pathOfDiskFile = (file: File): string | undefined => {
  try {
    return window.electron?.ipcRenderer.getPathForFile?.(file) || undefined;
  } catch {
    // A `File` made in this window has no path to give, and some builds of
    // the bridge say so by throwing.
    return undefined;
  }
};

/**
 * The path, when it can be known without asking main: a note on the file, or
 * a real file from a drop or a picker. `undefined` means "ask"
 * (`resolveKaraokeMediaPath`), not "none".
 */
export const karaokeMediaPathNow = (file: File): string | undefined => {
  const source = (file as TSourcedFile)[HOST_SOURCE];
  if (source?.kind === 'path') {
    return source.path;
  }
  return source === undefined ? pathOfDiskFile(file) : undefined;
};

/** The path, asking main where only main knows; `undefined` for none. */
export const resolveKaraokeMediaPath = async (
  file: File,
): Promise<string | undefined> => {
  const known = karaokeMediaPathNow(file);
  if (known) {
    return known;
  }
  const bridge = window.electron?.ipcRenderer;
  const source = (file as TSourcedFile)[HOST_SOURCE];
  if (source?.kind === 'stem') {
    const stems = await bridge?.karaokeStemPaths?.(source.key);
    return stems?.[source.role];
  }
  const token = karaokeRestoredFileToken(file);
  if (token) {
    return (await bridge?.karaokeSessionAudioPath?.(token)) || undefined;
  }
  return undefined;
};
