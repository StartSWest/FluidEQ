/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type IKaraokePlaylistItem,
  isKaraokeImageFile,
  karaokeFileExtension,
} from '../../common/karaoke/files';
import { karaokePlaylistFolderPath } from './karaokePlaylistTree';

/**
 * What a song's row says under its title, as the Library's row does: the
 * artist when the file is named "Artist - Title", otherwise the folder the
 * song is in, otherwise its format. The playlist item's own title has the
 * name's dashes turned into spaces, so the artist is read from the file's
 * name, where the " - " is still there.
 */
export interface IKaraokePlaylistRowNames {
  title: string;
  subtitle: string;
}

const tidy = (text: string) =>
  text.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();

export const karaokePlaylistRowNames = (
  item: IKaraokePlaylistItem,
): IKaraokePlaylistRowNames => {
  const extension = karaokeFileExtension(item.audio.name);
  const base = extension
    ? item.audio.name.slice(0, -(extension.length + 1))
    : item.audio.name;
  const separator = base.indexOf(' - ');
  if (separator > 0) {
    const artist = tidy(base.slice(0, separator));
    const title = tidy(base.slice(separator + 3));
    if (artist && title) {
      return { title, subtitle: artist };
    }
  }
  const folder = karaokePlaylistFolderPath(item);
  const folderName = folder?.slice(folder.lastIndexOf('/') + 1);
  return {
    title: item.title,
    subtitle: folderName
      ? tidy(folderName)
      : karaokeFileExtension((item.lyrics ?? item.audio).name).toUpperCase(),
  };
};

const COVER_NAME = /(^|[^a-z])(cover|folder|front|album|art)([^a-z]|$)/i;

/**
 * The picture a row shows: the song's own picture in its folder, a file
 * named like a cover first (`cover.jpg`, `folder.jpg`, `Front.png`), else
 * the first picture there. Nothing makes the row draw the Library's
 * generated tile, the same one an untagged Library song gets.
 */
export const karaokePlaylistCoverFile = (
  item: IKaraokePlaylistItem,
): File | undefined => {
  const pictures = item.media.filter((file) => isKaraokeImageFile(file));
  return pictures.find((file) => COVER_NAME.test(file.name)) ?? pictures[0];
};
