/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A song's file name made from its tags, by a pattern such as
 * "{track} - {title}" (Ivan, 2026-11-17: "rename the files too to have
 * better format", over "01-Avril_Lavigne_-_Girlfriend_(Clean_Edit)-phrc").
 *
 * Shared by the window, which shows each new name before Save, and main,
 * which takes a name only when it is already what `cleanFileName` makes of
 * it — so the name previewed is the name written, and nothing the window
 * sends can reach another folder or a name Windows refuses.
 */

/** What a pattern can name, each in braces. */
export const FILE_NAME_TOKENS = [
  'track',
  'title',
  'artist',
  'albumArtist',
  'album',
  'year',
  'disc',
] as const;

export type TFileNameToken = (typeof FILE_NAME_TOKENS)[number];

export type TFileNameValues = Partial<Record<TFileNameToken, string>>;

/** The patterns offered by name; anything else is typed. */
export const FILE_NAME_PRESETS: readonly string[] = [
  '{track} - {title}',
  '{track} - {artist} - {title}',
  '{artist} - {title}',
  '{disc}-{track} - {title}',
];

/** Longest base name kept, in UTF-16 units: Windows allows 255 for the
 * whole name, and a folder deep in a library leaves the path less. */
export const MAX_FILE_NAME_LENGTH = 180;

/** Longest pattern taken; a pattern is a few tokens and separators. */
export const MAX_FILE_NAME_PATTERN_LENGTH = 200;

/** Names Windows keeps for devices, with or without an extension. */
const RESERVED_NAME = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/i;

/**
 * Turns text into a base name every one of FluidEQ's systems can hold, or
 * `undefined` when nothing is left. A colon becomes " -" ("Act I: Prelude"
 * reads "Act I - Prelude"), a slash or a bar a hyphen, a double quote a
 * single one; `? * < >` and control characters go. Runs of spaces become
 * one, and a trailing dot or space goes, since Windows drops them itself
 * and the file would then not be found under the name it was given.
 */
export const cleanFileName = (text: string): string | undefined => {
  let name = '';
  [...text].forEach((character) => {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) {
      name += ' ';
    } else if (character === ':') {
      name += ' -';
    } else if (character === '/' || character === '\\' || character === '|') {
      name += '-';
    } else if (character === '"') {
      name += "'";
    } else if (!'?*<>'.includes(character)) {
      name += character;
    }
  });
  name = name.replace(/\s+/g, ' ').trim();
  if (name.length > MAX_FILE_NAME_LENGTH) {
    // Never through the middle of a surrogate pair.
    name = [...name].reduce(
      (kept, character) =>
        kept.length + character.length > MAX_FILE_NAME_LENGTH
          ? kept
          : kept + character,
      '',
    );
  }
  name = name.replace(/[ .]+$/, '');
  if (name === '' || /^\.+$/.test(name)) {
    return undefined;
  }
  return RESERVED_NAME.test(name) ? `${name}_` : name;
};

type TPatternPart = { text: string } | { token: TFileNameToken };

const isToken = (value: string): value is TFileNameToken =>
  (FILE_NAME_TOKENS as readonly string[]).includes(value);

/** A pattern read into its pieces; a brace that names nothing is text. */
const partsOf = (pattern: string): TPatternPart[] => {
  const parts: TPatternPart[] = [];
  const matcher = /\{([a-zA-Z]+)\}/g;
  let at = 0;
  let match = matcher.exec(pattern);
  while (match !== null) {
    const [whole, name] = match;
    if (isToken(name)) {
      if (match.index > at) {
        parts.push({ text: pattern.slice(at, match.index) });
      }
      parts.push({ token: name });
      at = match.index + whole.length;
    }
    match = matcher.exec(pattern);
  }
  if (at < pattern.length) {
    parts.push({ text: pattern.slice(at) });
  }
  return parts;
};

/** True when a pattern names at least one tag: text alone would give every
 * song the same name. */
export const isFileNamePattern = (pattern: string): boolean =>
  pattern.length <= MAX_FILE_NAME_PATTERN_LENGTH &&
  partsOf(pattern).some((part) => 'token' in part);

/** A track number padded to two digits, or as many as the album's count
 * needs: "01" of 12, "001" of 120. Anything that is not a number is kept. */
export const paddedTrack = (trackNo: string, trackTotal?: string): string => {
  const number = Number.parseInt(trackNo, 10);
  if (!/^\d+$/.test(trackNo.trim()) || Number.isNaN(number)) {
    return trackNo.trim();
  }
  const total = Number.parseInt(trackTotal ?? '', 10);
  const width = Math.max(
    2,
    Number.isNaN(total) ? 0 : String(total).length,
    String(number).length,
  );
  return String(number).padStart(width, '0');
};

/**
 * The base name a pattern makes of one song's values, cleaned, or
 * `undefined` when it makes nothing. A tag the song does not have takes the
 * text joining it to the next tag with it — "{track} - {title}" on a song
 * with no number is "Title", never " - Title" — or, for the last tag, the
 * text in front of it.
 */
export const fileNameOf = (
  pattern: string,
  values: TFileNameValues,
): string | undefined => {
  const parts = partsOf(pattern);
  const valueOf = (part: TPatternPart): string =>
    'token' in part ? (values[part.token] ?? '').trim() : part.text;
  const dropped = new Set<number>();
  parts.forEach((part, index) => {
    if (!('token' in part) || valueOf(part) !== '') {
      return;
    }
    dropped.add(index);
    const hasLaterToken = parts
      .slice(index + 1)
      .some((later) => 'token' in later);
    const joinIndex = hasLaterToken ? index + 1 : index - 1;
    const join = parts[joinIndex];
    if (join !== undefined && !('token' in join)) {
      dropped.add(joinIndex);
    }
  });
  const text = parts
    .filter((_, index) => !dropped.has(index))
    .map(valueOf)
    .join('');
  return cleanFileName(text);
};
