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
 * Each editor field read from and written to node-taglib-sharp's combined
 * tag, which holds every tag the file carries: one assignment reaches the
 * ID3v2 and ID3v1 of an MP3, or the ID3 chunk and RIFF INFO of a WAV.
 *
 * Text crosses the wire; the tag wants numbers, lists and switches. A list
 * shows its values joined by "; " and a changed list is written back as the
 * one value typed — splitting on a separator would break the band whose name
 * has one in it.
 */

import type { Tag } from 'node-taglib-sharp';
import type { TTagFieldKey, TTagFields } from '../../common/library/tagFields';
import { TAG_FIELDS } from '../../common/library/tagFields';

interface IFieldAccess {
  read: (tag: Tag) => string;
  write: (tag: Tag, value: string) => void;
}

const text = (value: string | undefined | null): string => value ?? '';

const list = (values: readonly string[] | undefined | null): string =>
  (values ?? []).filter((value) => value !== '').join('; ');

const asList = (value: string): string[] => (value === '' ? [] : [value]);

const count = (value: number | undefined | null): string =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? String(value)
    : '';

/** `''` is zero, which every tag model reads as "none" and drops. */
const asCount = (value: string): number => (value === '' ? 0 : Number(value));

const ACCESS: Record<TTagFieldKey, IFieldAccess> = {
  title: {
    read: (tag) => text(tag.title),
    write: (tag, value) => {
      tag.title = value;
    },
  },
  artist: {
    read: (tag) => list(tag.performers),
    write: (tag, value) => {
      tag.performers = asList(value);
    },
  },
  composer: {
    read: (tag) => list(tag.composers),
    write: (tag, value) => {
      tag.composers = asList(value);
    },
  },
  album: {
    read: (tag) => text(tag.album),
    write: (tag, value) => {
      tag.album = value;
    },
  },
  albumArtist: {
    read: (tag) => list(tag.albumArtists),
    write: (tag, value) => {
      tag.albumArtists = asList(value);
    },
  },
  trackNo: {
    read: (tag) => count(tag.track),
    write: (tag, value) => {
      tag.track = asCount(value);
    },
  },
  trackTotal: {
    read: (tag) => count(tag.trackCount),
    write: (tag, value) => {
      tag.trackCount = asCount(value);
    },
  },
  discNo: {
    read: (tag) => count(tag.disc),
    write: (tag, value) => {
      tag.disc = asCount(value);
    },
  },
  discTotal: {
    read: (tag) => count(tag.discCount),
    write: (tag, value) => {
      tag.discCount = asCount(value);
    },
  },
  year: {
    read: (tag) => count(tag.year),
    write: (tag, value) => {
      tag.year = asCount(value);
    },
  },
  genre: {
    read: (tag) => list(tag.genres),
    write: (tag, value) => {
      tag.genres = asList(value);
    },
  },
  bpm: {
    read: (tag) => count(tag.beatsPerMinute),
    write: (tag, value) => {
      tag.beatsPerMinute = asCount(value);
    },
  },
  comment: {
    read: (tag) => text(tag.comment),
    write: (tag, value) => {
      tag.comment = value;
    },
  },
  grouping: {
    read: (tag) => text(tag.grouping),
    write: (tag, value) => {
      tag.grouping = value;
    },
  },
  publisher: {
    read: (tag) => text(tag.publisher),
    write: (tag, value) => {
      tag.publisher = value;
    },
  },
  copyright: {
    read: (tag) => text(tag.copyright),
    write: (tag, value) => {
      tag.copyright = value;
    },
  },
  isrc: {
    read: (tag) => text(tag.isrc),
    write: (tag, value) => {
      tag.isrc = value;
    },
  },
  conductor: {
    read: (tag) => text(tag.conductor),
    write: (tag, value) => {
      tag.conductor = value;
    },
  },
  subtitle: {
    read: (tag) => text(tag.subtitle),
    write: (tag, value) => {
      tag.subtitle = value;
    },
  },
  remixer: {
    read: (tag) => text(tag.remixedBy),
    write: (tag, value) => {
      tag.remixedBy = value;
    },
  },
  initialKey: {
    read: (tag) => text(tag.initialKey),
    write: (tag, value) => {
      tag.initialKey = value;
    },
  },
  compilation: {
    read: (tag) => (tag.isCompilation ? '1' : ''),
    write: (tag, value) => {
      tag.isCompilation = value === '1';
    },
  },
  titleSort: {
    read: (tag) => text(tag.titleSort),
    write: (tag, value) => {
      tag.titleSort = value;
    },
  },
  artistSort: {
    read: (tag) => list(tag.performersSort),
    write: (tag, value) => {
      tag.performersSort = asList(value);
    },
  },
  albumSort: {
    read: (tag) => text(tag.albumSort),
    write: (tag, value) => {
      tag.albumSort = value;
    },
  },
  albumArtistSort: {
    read: (tag) => list(tag.albumArtistsSort),
    write: (tag, value) => {
      tag.albumArtistsSort = asList(value);
    },
  },
  composerSort: {
    read: (tag) => list(tag.composersSort),
    write: (tag, value) => {
      tag.composersSort = asList(value);
    },
  },
  musicBrainzTrackId: {
    read: (tag) => text(tag.musicBrainzTrackId),
    write: (tag, value) => {
      tag.musicBrainzTrackId = value;
    },
  },
  musicBrainzReleaseId: {
    read: (tag) => text(tag.musicBrainzReleaseId),
    write: (tag, value) => {
      tag.musicBrainzReleaseId = value;
    },
  },
  musicBrainzArtistId: {
    read: (tag) => text(tag.musicBrainzArtistId),
    write: (tag, value) => {
      tag.musicBrainzArtistId = value;
    },
  },
  musicBrainzReleaseArtistId: {
    read: (tag) => text(tag.musicBrainzReleaseArtistId),
    write: (tag, value) => {
      tag.musicBrainzReleaseArtistId = value;
    },
  },
  musicBrainzReleaseGroupId: {
    read: (tag) => text(tag.musicBrainzReleaseGroupId),
    write: (tag, value) => {
      tag.musicBrainzReleaseGroupId = value;
    },
  },
};

/** Every field the file has a value for. */
export const readTagFields = (tag: Tag): TTagFields => {
  const fields: TTagFields = {};
  TAG_FIELDS.forEach((key) => {
    const value = ACCESS[key].read(tag);
    if (value !== '') {
      fields[key] = value;
    }
  });
  return fields;
};

export const writeTagField = (
  tag: Tag,
  key: TTagFieldKey,
  value: string,
): void => {
  ACCESS[key].write(tag, value);
};
