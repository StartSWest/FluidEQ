/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IKaraokePlaylistItem,
  karaokeFileRelativePath,
  setKaraokeRelativePath,
  setKaraokeRestoredFileToken,
} from '../../common/karaoke/files';
import { IKaraokeRestoredFile } from '../../common/karaoke/sessionPersistence';

// Putting a saved karaoke session back: a restored file rebuilt as a File
// with its path and token, the playlist in its saved order with anything
// newer after it, and the identity two imports of one file share.

export const importedFileIdentity = (file: File): string =>
  karaokeFileRelativePath(file).toLowerCase();

export const restoredKaraokeFile = (saved: IKaraokeRestoredFile): File => {
  const file = new File(
    saved.role === 'lyrics' ? [saved.text ?? ''] : [],
    saved.name,
    {
      type: saved.type,
      lastModified: saved.lastModified,
    },
  );
  setKaraokeRelativePath(file, saved.relativePath);
  setKaraokeRestoredFileToken(file, saved.token);
  return file;
};

export const orderedRestoredPlaylist = (
  items: readonly IKaraokePlaylistItem[],
  order: readonly string[],
): IKaraokePlaylistItem[] => {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = order
    .map((id) => byId.get(id))
    .filter((item): item is IKaraokePlaylistItem => Boolean(item));
  const included = new Set(ordered.map((item) => item.id));
  items.forEach((item) => {
    if (!included.has(item.id)) {
      ordered.push(item);
    }
  });
  return ordered;
};
