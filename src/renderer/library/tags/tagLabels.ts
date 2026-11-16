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

import type { TTagFieldKey } from '../../../common/library/tagFields';
import type { TranslationKey } from '../../../common/i18n';

/** Each field's name, written out so the unread-keys check can see them. */
export const FIELD_LABEL_KEYS: Record<TTagFieldKey, TranslationKey> = {
  title: 'library.tags.field.title',
  artist: 'library.tags.field.artist',
  composer: 'library.tags.field.composer',
  album: 'library.tags.field.album',
  albumArtist: 'library.tags.field.albumArtist',
  trackNo: 'library.tags.field.trackNo',
  trackTotal: 'library.tags.field.trackTotal',
  discNo: 'library.tags.field.discNo',
  discTotal: 'library.tags.field.discTotal',
  year: 'library.tags.field.year',
  genre: 'library.tags.field.genre',
  bpm: 'library.tags.field.bpm',
  comment: 'library.tags.field.comment',
  grouping: 'library.tags.field.grouping',
  publisher: 'library.tags.field.publisher',
  copyright: 'library.tags.field.copyright',
  isrc: 'library.tags.field.isrc',
  conductor: 'library.tags.field.conductor',
  subtitle: 'library.tags.field.subtitle',
  remixer: 'library.tags.field.remixer',
  initialKey: 'library.tags.field.initialKey',
  compilation: 'library.tags.field.compilation',
  titleSort: 'library.tags.field.titleSort',
  artistSort: 'library.tags.field.artistSort',
  albumSort: 'library.tags.field.albumSort',
  albumArtistSort: 'library.tags.field.albumArtistSort',
  composerSort: 'library.tags.field.composerSort',
  musicBrainzTrackId: 'library.tags.field.musicBrainzTrackId',
  musicBrainzReleaseId: 'library.tags.field.musicBrainzReleaseId',
  musicBrainzArtistId: 'library.tags.field.musicBrainzArtistId',
  musicBrainzReleaseArtistId: 'library.tags.field.musicBrainzReleaseArtistId',
  musicBrainzReleaseGroupId: 'library.tags.field.musicBrainzReleaseGroupId',
};

/** "1.2 MB", "38 KB": a cover's size in the panel's facts line. */
export const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

/** "JPEG", "PNG": the picture's kind from its type. */
export const imageKind = (mime: string): string =>
  mime
    .replace(/^image\//, '')
    .replace('jpeg', 'jpg')
    .toUpperCase()
    .replace('JPG', 'JPEG');
