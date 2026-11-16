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
 * Each format's own names for the editor's fields, and the fields a file
 * keeps that have no name here (More fields).
 *
 * The common fields are written through node-taglib-sharp's combined tag,
 * which sets every tag the file carries at once — an MP3's ID3v2, ID3v1 and
 * APEv2 stay in step that way. What this module adds is the part the
 * combined tag does not do: the codes the panel shows beside each field, the
 * raw fields listed by code, and which tags a write must create or must not.
 */

import {
  ApeTag,
  ApeTagItemType,
  AsfObjectDataType,
  AsfTag,
  File,
  Id3v2FrameIdentifiers as FrameIdentifiers,
  Id3v2Tag,
  Id3v2TextInformationFrame as TextInformationFrame,
  Id3v2UserTextInformationFrame as UserTextInformationFrame,
  Mpeg4AppleTag as AppleTag,
  TagTypes,
  XiphComment,
} from 'node-taglib-sharp';
import type {
  ITagExtraField,
  TTagFieldKey,
  TTagFormat,
} from '../../common/library/tagFields';
import { MAX_EXTRA_CODE } from '../../common/library/tagFields';

/** The tag model a format keeps its fields in. */
export type TTagFamily = 'id3' | 'xiph' | 'apple' | 'asf';

const FORMAT_BY_EXTENSION: Record<string, TTagFormat> = {
  mp3: 'mp3',
  aac: 'aac',
  flac: 'flac',
  ogg: 'ogg',
  opus: 'opus',
  m4a: 'm4a',
  m4b: 'm4a',
  alac: 'm4a',
  wav: 'wav',
  aiff: 'aiff',
  wma: 'wma',
};

/** The type node-taglib-sharp opens each format as, named rather than read
 * from the extension: an `.alac` file is an MP4 container. */
const MIME_BY_FORMAT: Record<TTagFormat, string> = {
  mp3: 'taglib/mp3',
  aac: 'taglib/aac',
  flac: 'taglib/flac',
  ogg: 'taglib/ogg',
  opus: 'taglib/opus',
  m4a: 'taglib/m4a',
  wav: 'taglib/wav',
  aiff: 'taglib/aiff',
  wma: 'taglib/wma',
};

export const FAMILY_BY_FORMAT: Record<TTagFormat, TTagFamily> = {
  mp3: 'id3',
  aac: 'id3',
  wav: 'id3',
  aiff: 'id3',
  flac: 'xiph',
  ogg: 'xiph',
  opus: 'xiph',
  m4a: 'apple',
  wma: 'asf',
};

export const tagFormatOfPath = (filePath: string): TTagFormat | undefined => {
  const dot = filePath.lastIndexOf('.');
  if (dot < 0) {
    return undefined;
  }
  return FORMAT_BY_EXTENSION[filePath.slice(dot + 1).toLowerCase()];
};

export const openTagFile = (filePath: string, format: TTagFormat): File =>
  File.createFromPath(filePath, MIME_BY_FORMAT[format]);

/** True for the formats whose ID3v2 version the panel lets the user pick. */
export const canChooseId3v2Version = (format: TTagFormat): boolean =>
  FAMILY_BY_FORMAT[format] === 'id3';

/** True where an ID3v1 tag at the end of the file is a thing. */
export const keepsId3v1 = (format: TTagFormat): boolean =>
  format === 'mp3' || format === 'aac';

const ID3_CODES: Record<TTagFieldKey, string> = {
  title: 'TIT2',
  artist: 'TPE1',
  composer: 'TCOM',
  album: 'TALB',
  albumArtist: 'TPE2',
  trackNo: 'TRCK',
  trackTotal: 'TRCK',
  discNo: 'TPOS',
  discTotal: 'TPOS',
  year: 'TDRC',
  genre: 'TCON',
  bpm: 'TBPM',
  comment: 'COMM',
  grouping: 'TIT1',
  publisher: 'TPUB',
  copyright: 'TCOP',
  isrc: 'TSRC',
  conductor: 'TPE3',
  subtitle: 'TIT3',
  remixer: 'TPE4',
  initialKey: 'TKEY',
  compilation: 'TCMP',
  titleSort: 'TSOT',
  artistSort: 'TSOP',
  albumSort: 'TSOA',
  albumArtistSort: 'TSO2',
  composerSort: 'TSOC',
  musicBrainzTrackId: 'UFID',
  musicBrainzReleaseId: 'TXXX:MusicBrainz Album Id',
  musicBrainzArtistId: 'TXXX:MusicBrainz Artist Id',
  musicBrainzReleaseArtistId: 'TXXX:MusicBrainz Album Artist Id',
  musicBrainzReleaseGroupId: 'TXXX:MusicBrainz Release Group Id',
};

const XIPH_CODES: Record<TTagFieldKey, string> = {
  title: 'TITLE',
  artist: 'ARTIST',
  composer: 'COMPOSER',
  album: 'ALBUM',
  albumArtist: 'ALBUMARTIST',
  trackNo: 'TRACKNUMBER',
  trackTotal: 'TRACKTOTAL',
  discNo: 'DISCNUMBER',
  discTotal: 'DISCTOTAL',
  year: 'DATE',
  genre: 'GENRE',
  bpm: 'TEMPO',
  comment: 'COMMENT',
  grouping: 'GROUPING',
  publisher: 'ORGANIZATION',
  copyright: 'COPYRIGHT',
  isrc: 'ISRC',
  conductor: 'CONDUCTOR',
  subtitle: 'SUBTITLE',
  remixer: 'REMIXEDBY',
  initialKey: 'INITIALKEY',
  compilation: 'COMPILATION',
  titleSort: 'TITLESORT',
  artistSort: 'ARTISTSORT',
  albumSort: 'ALBUMSORT',
  albumArtistSort: 'ALBUMARTISTSORT',
  composerSort: 'COMPOSERSORT',
  musicBrainzTrackId: 'MUSICBRAINZ_TRACKID',
  musicBrainzReleaseId: 'MUSICBRAINZ_ALBUMID',
  musicBrainzArtistId: 'MUSICBRAINZ_ARTISTID',
  musicBrainzReleaseArtistId: 'MUSICBRAINZ_ALBUMARTISTID',
  musicBrainzReleaseGroupId: 'MUSICBRAINZ_RELEASEGROUPID',
};

const APPLE_CODES: Record<TTagFieldKey, string> = {
  title: '©nam',
  artist: '©ART',
  composer: '©wrt',
  album: '©alb',
  albumArtist: 'aART',
  trackNo: 'trkn',
  trackTotal: 'trkn',
  discNo: 'disk',
  discTotal: 'disk',
  year: '©day',
  genre: '©gen',
  bpm: 'tmpo',
  comment: '©cmt',
  grouping: '©grp',
  publisher: '----:publisher',
  copyright: 'cprt',
  isrc: '----:ISRC',
  conductor: '©con',
  subtitle: '----:SUBTITLE',
  remixer: '----:REMIXEDBY',
  initialKey: '----:initialkey',
  compilation: 'cpil',
  titleSort: 'sonm',
  artistSort: 'soar',
  albumSort: 'soal',
  albumArtistSort: 'soaa',
  composerSort: 'soco',
  musicBrainzTrackId: '----:MusicBrainz Track Id',
  musicBrainzReleaseId: '----:MusicBrainz Album Id',
  musicBrainzArtistId: '----:MusicBrainz Artist Id',
  musicBrainzReleaseArtistId: '----:MusicBrainz Album Artist Id',
  musicBrainzReleaseGroupId: '----:MusicBrainz Release Group Id',
};

const ASF_CODES: Record<TTagFieldKey, string> = {
  title: 'Title',
  artist: 'Author',
  composer: 'WM/Composer',
  album: 'WM/AlbumTitle',
  albumArtist: 'WM/AlbumArtist',
  trackNo: 'WM/TrackNumber',
  trackTotal: 'TrackTotal',
  discNo: 'WM/PartOfSet',
  discTotal: 'WM/PartOfSet',
  year: 'WM/Year',
  genre: 'WM/Genre',
  bpm: 'WM/BeatsPerMinute',
  comment: 'Description',
  grouping: 'WM/ContentGroupDescription',
  publisher: 'WM/Publisher',
  copyright: 'Copyright',
  isrc: 'WM/ISRC',
  conductor: 'WM/Conductor',
  subtitle: 'WM/SubTitle',
  remixer: 'WM/ModifiedBy',
  initialKey: 'WM/InitialKey',
  compilation: 'WM/IsCompilation',
  titleSort: 'WM/TitleSortOrder',
  artistSort: 'WM/ArtistSortOrder',
  albumSort: 'WM/AlbumSortOrder',
  albumArtistSort: 'WM/AlbumArtistSortOrder',
  composerSort: 'WM/ComposerSortOrder',
  musicBrainzTrackId: 'MusicBrainz/Track Id',
  musicBrainzReleaseId: 'MusicBrainz/Album Id',
  musicBrainzArtistId: 'MusicBrainz/Artist Id',
  musicBrainzReleaseArtistId: 'MusicBrainz/Album Artist Id',
  musicBrainzReleaseGroupId: 'MusicBrainz/Release Group Id',
};

export const FIELD_CODES: Record<TTagFamily, Record<TTagFieldKey, string>> = {
  id3: ID3_CODES,
  xiph: XIPH_CODES,
  apple: APPLE_CODES,
  asf: ASF_CODES,
};

/**
 * Codes the editor's own fields already cover, plus the ones that are not
 * a field anybody types — pictures, lyrics (the Lyrics tab's), the year's
 * older spellings — so More fields does not list the same value twice.
 */
const HIDDEN_CODES: Record<TTagFamily, ReadonlySet<string>> = {
  id3: new Set([
    ...Object.values(ID3_CODES),
    'TYER',
    'TDAT',
    'TIME',
    'TORY',
    'TRDA',
    'APIC',
    'USLT',
    'SYLT',
    'TXXX:MusicBrainz Track Id',
  ]),
  xiph: new Set([
    ...Object.values(XIPH_CODES),
    'BPM',
    'DESCRIPTION',
    'TOTALTRACKS',
    'TOTALDISCS',
    'ALBUM ARTIST',
    'METADATA_BLOCK_PICTURE',
    'COVERART',
    'COVERARTMIME',
    'LYRICS',
    'UNSYNCEDLYRICS',
  ]),
  apple: new Set(Object.values(APPLE_CODES)),
  asf: new Set([
    ...Object.values(ASF_CODES),
    'WM/Text',
    'WM/Picture',
    'WM/Lyrics',
    'WM/Lyrics_Synchronised',
  ]),
};

/**
 * Freeform MP4 names worth looking for. An MP4's `ilst` cannot be listed
 * through node-taglib-sharp's public surface, so the M4A extras are the
 * well-known names other taggers write, read by name.
 */
const APPLE_FREEFORM_NAMES = [
  'LABEL',
  'CATALOGNUMBER',
  'BARCODE',
  'MOOD',
  'LANGUAGE',
  'MEDIA',
  'ORIGINALDATE',
  'ORIGINALYEAR',
  'ENCODEDBY',
  'LYRICIST',
  'WRITER',
  'SCRIPT',
  'ARTISTS',
  'RELEASETYPE',
  'RELEASESTATUS',
  'RELEASECOUNTRY',
];

const APPLE_MEAN = 'com.apple.iTunes';

const joinValues = (values: readonly string[]): string =>
  values.filter((value) => value !== '').join('; ');

const id3Extras = (tag: Id3v2Tag, hidden: ReadonlySet<string>) => {
  const extras: ITagExtraField[] = [];
  tag.frames.forEach((frame) => {
    if (frame instanceof UserTextInformationFrame) {
      const code = `TXXX:${frame.description}`;
      if (!hidden.has(code)) {
        extras.push({ code, value: joinValues(frame.text) });
      }
      return;
    }
    if (frame instanceof TextInformationFrame) {
      const code = frame.frameId.toString();
      if (!hidden.has(code)) {
        extras.push({ code, value: joinValues(frame.text) });
      }
    }
  });
  return extras;
};

const xiphExtras = (tag: XiphComment, hidden: ReadonlySet<string>) =>
  tag.fieldNames
    .filter((name) => !hidden.has(name.toUpperCase()))
    .map((name) => ({ code: name, value: joinValues(tag.getField(name)) }));

const apeExtras = (tag: ApeTag) => {
  // APEv2 rides along on an MP3; its common items are the combined tag's.
  const covered = new Set([
    'TITLE',
    'ARTIST',
    'ALBUM',
    'ALBUM ARTIST',
    'ALBUMARTIST',
    'COMPOSER',
    'TRACK',
    'DISC',
    'YEAR',
    'GENRE',
    'COMMENT',
    'BPM',
    'LYRICS',
  ]);
  return tag.items
    .filter(
      (item) =>
        item.type === ApeTagItemType.Text &&
        !covered.has(item.key.toUpperCase()) &&
        !item.key.toUpperCase().startsWith('COVER ART'),
    )
    .map((item) => ({ code: `APE:${item.key}`, value: joinValues(item.text) }));
};

const asfExtras = (tag: AsfTag, hidden: ReadonlySet<string>) =>
  tag.extendedContentDescriptionObject.descriptors
    .filter(
      (descriptor) =>
        descriptor.type === AsfObjectDataType.Unicode &&
        !hidden.has(descriptor.name),
    )
    .map((descriptor) => ({
      code: descriptor.name,
      value: descriptor.stringValue,
    }));

const appleExtras = (tag: AppleTag) =>
  APPLE_FREEFORM_NAMES.map((name) => ({
    code: `----:${name}`,
    value: joinValues(tag.getItunesStrings(APPLE_MEAN, name)),
  })).filter((extra) => extra.value !== '');

/** The raw fields of every tag the file carries, by code. */
export const readExtras = (
  file: File,
  family: TTagFamily,
): ITagExtraField[] => {
  const hidden = HIDDEN_CODES[family];
  const extras: ITagExtraField[] = [];
  const id3 = file.getTag(TagTypes.Id3v2, false);
  if (id3 instanceof Id3v2Tag) {
    extras.push(...id3Extras(id3, HIDDEN_CODES.id3));
  }
  const xiph = file.getTag(TagTypes.Xiph, false);
  if (xiph instanceof XiphComment) {
    extras.push(...xiphExtras(xiph, hidden));
  }
  const ape = file.getTag(TagTypes.Ape, false);
  if (ape instanceof ApeTag) {
    extras.push(...apeExtras(ape));
  }
  const asf = file.getTag(TagTypes.Asf, false);
  if (asf instanceof AsfTag) {
    extras.push(...asfExtras(asf, hidden));
  }
  const apple = file.getTag(TagTypes.Apple, false);
  if (apple instanceof AppleTag) {
    extras.push(...appleExtras(apple));
  }
  // One row per code: a frame repeated in two tags is one field to the reader.
  const seen = new Set<string>();
  return extras.filter((extra) => {
    if (seen.has(extra.code) || extra.code.length > MAX_EXTRA_CODE) {
      return false;
    }
    seen.add(extra.code);
    return true;
  });
};

/**
 * Whether `code` names a field this format can hold as text. The window may
 * only add codes that pass, and main refuses any other.
 */
export const isWritableExtraCode = (
  family: TTagFamily,
  code: string,
): boolean => {
  if (code.length === 0 || code.length > MAX_EXTRA_CODE) {
    return false;
  }
  if (HIDDEN_CODES[family].has(code)) {
    return false;
  }
  switch (family) {
    case 'id3':
      if (code.startsWith('TXXX:')) {
        return /^TXXX:[\x20-\x7e]{1,80}$/.test(code);
      }
      if (code.startsWith('APE:')) {
        return /^APE:[\x20-\x7e]{2,80}$/.test(code);
      }
      return (
        /^T[A-Z0-9]{3}$/.test(code) &&
        code !== 'TXXX' &&
        Object.prototype.hasOwnProperty.call(FrameIdentifiers, code)
      );
    case 'xiph':
      // Vorbis comment names: printable ASCII without '='.
      return /^[\x20-\x3c\x3e-\x7d]{1,64}$/.test(code);
    case 'apple':
      return /^----:[A-Za-z0-9 _.-]{1,64}$/.test(code);
    case 'asf':
      return /^[\x20-\x7e]{1,64}$/.test(code);
    default:
      return false;
  }
};

const setId3Extra = (tag: Id3v2Tag, code: string, value: string) => {
  if (code.startsWith('TXXX:')) {
    const description = code.slice('TXXX:'.length);
    const frames = tag.frames.filter(
      (frame): frame is UserTextInformationFrame =>
        frame instanceof UserTextInformationFrame &&
        frame.description === description,
    );
    frames.forEach((frame) => tag.removeFrame(frame));
    if (value !== '') {
      const frame = UserTextInformationFrame.fromDescription(description);
      frame.text = [value];
      tag.addFrame(frame);
    }
    return;
  }
  const ident = Object.prototype.hasOwnProperty.call(FrameIdentifiers, code)
    ? FrameIdentifiers[code as keyof typeof FrameIdentifiers]
    : undefined;
  if (ident === undefined) {
    return;
  }
  if (value === '') {
    tag.removeFrames(ident);
  } else {
    tag.setTextFrame(ident, value);
  }
};

/** Sets or removes one raw field; `''` removes it. */
export const writeExtra = (file: File, code: string, value: string): void => {
  if (code.startsWith('APE:')) {
    const ape = file.getTag(TagTypes.Ape, false);
    if (ape instanceof ApeTag) {
      const key = code.slice('APE:'.length);
      if (value === '') {
        ape.removeItem(key);
      } else {
        ape.setStringValue(key, value);
      }
    }
    return;
  }
  const id3 = file.getTag(TagTypes.Id3v2, false);
  if (id3 instanceof Id3v2Tag) {
    setId3Extra(id3, code, value);
  }
  const xiph = file.getTag(TagTypes.Xiph, false);
  if (xiph instanceof XiphComment) {
    if (value === '') {
      xiph.removeField(code);
    } else {
      xiph.setFieldAsStrings(code, value);
    }
  }
  const asf = file.getTag(TagTypes.Asf, false);
  if (asf instanceof AsfTag) {
    if (value === '') {
      asf.removeDescriptors(code);
    } else {
      asf.setDescriptorString(value, code);
    }
  }
  const apple = file.getTag(TagTypes.Apple, false);
  if (apple instanceof AppleTag && code.startsWith('----:')) {
    const name = code.slice('----:'.length);
    if (value === '') {
      apple.setItunesStrings(APPLE_MEAN, name);
    } else {
      apple.setItunesStrings(APPLE_MEAN, name, value);
    }
  }
};

/** What the file carries now, named as the panel shows them. */
export const tagNamesOnDisk = (file: File): string[] => {
  const names: string[] = [];
  const onDisk = file.tagTypesOnDisk;
  const has = (type: TagTypes) => (onDisk & type) !== 0; // eslint-disable-line no-bitwise -- a flag set
  if (has(TagTypes.Id3v2)) {
    const id3 = file.getTag(TagTypes.Id3v2, false);
    names.push(id3 instanceof Id3v2Tag ? `ID3v2.${id3.version}` : 'ID3v2');
  }
  if (has(TagTypes.Id3v1)) {
    names.push('ID3v1');
  }
  if (has(TagTypes.Ape)) {
    names.push('APEv2');
  }
  // An Ogg or Opus file leaves `tagTypesOnDisk` empty although its comment
  // header is read (measured on 6.0.3), so a non-empty comment counts too.
  const xiph = file.getTag(TagTypes.Xiph, false);
  if (has(TagTypes.Xiph) || (xiph instanceof XiphComment && !xiph.isEmpty)) {
    names.push('Vorbis');
  }
  if (has(TagTypes.Apple)) {
    names.push('iTunes');
  }
  if (has(TagTypes.RiffInfo)) {
    names.push('RIFF INFO');
  }
  if (has(TagTypes.Asf)) {
    names.push('ASF');
  }
  return names;
};
