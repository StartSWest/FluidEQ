/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * WHO A SONG IS BY, NAME BY NAME: the artists an artist tag credits, for the
 * artist page (every song somebody is on) and for the links an artist name
 * becomes in the Library.
 *
 * A tag is one line of text however many people it names — "Britney Spears
 * feat. *NSYNC", "Bad Bunny, Jhay Cortez", "Simon & Garfunkel". Two kinds of
 * joint are told apart:
 *
 * - a STRONG joint always separates two credits: "feat.", "ft.",
 *   "featuring", "vs.", a semicolon, a slash with spaces round it. "AC/DC"
 *   keeps its slash; nobody writes a duo with a bare one.
 * - a WEAK joint, a comma or an ampersand, separates two people only
 *   sometimes: music-metadata joins a file's several artists with them, and
 *   bands are named with them ("Earth, Wind & Fire"). A link splits on one
 *   only where the library already knows one of the halves as an artist
 *   (`artistLinkParts`); the store files the song under every half anyway
 *   (`trackCredits`), so whichever way a link resolves, its page holds the
 *   song.
 *
 * A credit's id is `artistKeyOf` its name — the very fold `artistKey` gives
 * a song's own artist, so a credited name and an album artist of the same
 * spelling are one page: case and accents folded, the ends trimmed, "The"
 * and every other character kept as written.
 */

import { normalizeForSearch } from './grouping';
import type { ILibraryTrack } from './types';

/** The longest artist line main is asked to link; a longer one is drawn as
 * plain text rather than sent (`libraryRequestGuard.ts`). */
export const MAX_ARTIST_LINE = 500;

/** The artist page a name opens: the same fold as `artistKey`. */
export const artistKeyOf = (name: string): string => normalizeForSearch(name);

/** A run of an artist line: a name that opens a page (`id`), or the text
 * between names. Joined back, the runs are the line exactly as written. */
export interface IArtistLinkPart {
  text: string;
  id?: string;
}

type TJoint = 'feat' | 'strong' | 'weak';

interface IToken {
  /** A name, or the joint after it (absent for the last name). */
  name: string;
  joint?: { kind: TJoint; text: string };
}

/**
 * One alternation, so the line is cut once from the left: a featuring
 * marker first (with the bracket some taggers open it with), then the other
 * strong joints, then the weak ones. Spaces round a weak joint belong to it.
 */
const JOINTS =
  /(\s*[([]\s*(?:feat\.?|ft\.?|featuring)\s+|\s+(?:feat\.?|ft\.?|featuring)\s+)|(\s+(?:vs\.?|versus)\s+|\s*;\s*|\s+\/\s+)|(\s*,\s+|\s+&\s+)/giu;

const tokenize = (line: string): IToken[] => {
  const tokens: IToken[] = [];
  let start = 0;
  JOINTS.lastIndex = 0;
  for (
    let match = JOINTS.exec(line);
    match !== null;
    match = JOINTS.exec(line)
  ) {
    let kind: TJoint = 'weak';
    if (match[1] !== undefined) {
      kind = 'feat';
    } else if (match[2] !== undefined) {
      kind = 'strong';
    }
    tokens.push({
      name: line.slice(start, match.index),
      joint: { kind, text: match[0] },
    });
    start = match.index + match[0].length;
  }
  tokens.push({ name: line.slice(start) });
  return tokens;
};

/** A name with the space and the closing bracket a "(feat. X)" leaves on
 * it set aside as plain text — only that bracket: "Sunn O)))" keeps its own. */
const trimmedName = (
  raw: string,
  closesBracket: boolean,
): { lead: string; name: string; tail: string } => {
  const lead = /^\s*/u.exec(raw)?.[0] ?? '';
  let body = raw.slice(lead.length);
  let tail = /\s*$/u.exec(body)?.[0] ?? '';
  body = body.slice(0, body.length - tail.length);
  if (closesBracket && /[)\]]$/u.test(body)) {
    tail = `${body.slice(-1)}${tail}`;
    body = body.slice(0, -1).trimEnd();
  }
  return { lead, name: body, tail };
};

/** A strong segment of the line: its names, and the weak joints between. */
interface ISegment {
  /** Before the line's first featuring marker: the people the song is by,
   * rather than the ones it features. */
  isLead: boolean;
  /** The runs of the segment, a name's own run carrying `name`. */
  runs: { text: string; name?: string }[];
}

const segmentsOf = (line: string): ISegment[] => {
  const segments: ISegment[] = [];
  let current: ISegment = { isLead: true, runs: [] };
  let isLead = true;
  let isBracketOpen = false;
  const tokens = tokenize(line);
  tokens.forEach((token, index) => {
    const { lead, name, tail } = trimmedName(
      token.name,
      isBracketOpen && index === tokens.length - 1,
    );
    if (lead) {
      current.runs.push({ text: lead });
    }
    current.runs.push(name ? { text: name, name } : { text: '' });
    if (tail) {
      current.runs.push({ text: tail });
    }
    const { joint } = token;
    if (joint === undefined) {
      return;
    }
    if (joint.kind === 'weak') {
      current.runs.push({ text: joint.text });
      return;
    }
    segments.push(current);
    // The joint stands between the two segments, in neither.
    segments.push({ isLead: false, runs: [{ text: joint.text }] });
    if (joint.kind === 'feat') {
      isLead = false;
      isBracketOpen = /[([]/u.test(joint.text);
    }
    current = { isLead, runs: [] };
  });
  segments.push(current);
  return segments;
};

const namesOf = (segment: ISegment): string[] =>
  segment.runs.flatMap((run) => (run.name === undefined ? [] : [run.name]));

/** The segment's own text, its edges trimmed: "Pitbull & Ke$ha". */
const segmentText = (segment: ISegment): string =>
  segment.runs
    .map((run) => run.text)
    .join('')
    .trim();

/**
 * The line as runs, each name that opens a page carrying its id.
 *
 * The whole line is one link where the library knows it as an artist —
 * "Simon & Garfunkel" stays one band. Otherwise each strong segment is one
 * link, split at its commas and ampersands only where the library knows one
 * of the parts: "Bad Bunny, Jhay Cortez" splits once Bad Bunny has a record
 * here; "Earth, Wind & Fire" never does.
 */
export const artistLinkParts = (
  line: string,
  isKnown: (id: string) => boolean,
): IArtistLinkPart[] => {
  const whole = line.trim();
  if (whole === '') {
    return line === '' ? [] : [{ text: line }];
  }
  if (isKnown(artistKeyOf(whole))) {
    const lead = line.slice(0, line.indexOf(whole));
    const tail = line.slice(lead.length + whole.length);
    return [
      ...(lead ? [{ text: lead }] : []),
      { text: whole, id: artistKeyOf(whole) },
      ...(tail ? [{ text: tail }] : []),
    ];
  }
  const parts: IArtistLinkPart[] = [];
  segmentsOf(line).forEach((segment) => {
    const names = namesOf(segment);
    const isSplit =
      names.length > 1 &&
      !isKnown(artistKeyOf(segmentText(segment))) &&
      names.some((name) => isKnown(artistKeyOf(name)));
    if (isSplit || names.length === 0) {
      segment.runs.forEach((run) => {
        if (run.text === '') {
          return;
        }
        parts.push(
          run.name === undefined
            ? { text: run.text }
            : { text: run.text, id: artistKeyOf(run.name) },
        );
      });
      return;
    }
    // One link over the segment's text, its edge spaces left plain.
    const text = segment.runs.map((run) => run.text).join('');
    const name = text.trim();
    const lead = text.slice(0, text.indexOf(name));
    const tail = text.slice(lead.length + name.length);
    if (lead) {
      parts.push({ text: lead });
    }
    parts.push({ text: name, id: artistKeyOf(name) });
    if (tail) {
      parts.push({ text: tail });
    }
  });
  // Neighbouring plain runs as one, so a line draws as few spans as it can.
  return parts.reduce<IArtistLinkPart[]>((joined, part) => {
    const last = joined[joined.length - 1];
    if (last !== undefined && last.id === undefined && part.id === undefined) {
      last.text += part.text;
      return joined;
    }
    joined.push({ ...part });
    return joined;
  }, []);
};

/** One credit a song is filed under. */
export interface IArtistCredit {
  id: string;
  /** The spelling the tag wrote, for a page nobody else names. */
  name: string;
  /** Credited for the record itself (its album artist, or its own artist
   * where it has none), not only as a guest on it. */
  onAlbum: boolean;
}

/** Every id a line can link to: the whole line, each strong segment and
 * each of its names — the store cannot know which way a link resolves. */
const creditNamesOf = (line: string, leadOnly: boolean): string[] => {
  const whole = line.trim();
  if (whole === '') {
    return [];
  }
  const names = [whole];
  segmentsOf(line).forEach((segment) => {
    const segmentNames = namesOf(segment);
    if (segmentNames.length === 0 || (leadOnly && !segment.isLead)) {
      return;
    }
    names.push(segmentText(segment), ...segmentNames);
  });
  return names;
};

/**
 * The credits a song is filed under: its album artist's (or, with none, its
 * own artist's) lead names as on the album — so "A feat. B" with no album
 * artist is A's single and only B's guest spot — and every name of its own
 * artist line as on the song. Its `artistKey` is always among them, so the
 * artist page holds every song the Artists shelf counts.
 */
export const trackCredits = (
  track: Pick<ILibraryTrack, 'artist' | 'albumArtist'>,
): IArtistCredit[] => {
  const credits = new Map<string, IArtistCredit>();
  const add = (name: string, onAlbum: boolean) => {
    const id = artistKeyOf(name);
    if (id === '') {
      return;
    }
    const known = credits.get(id);
    if (known === undefined) {
      credits.set(id, { id, name, onAlbum });
    } else if (onAlbum) {
      known.onAlbum = true;
    }
  };
  const albumLine = track.albumArtist ?? track.artist ?? '';
  // A song with no artist at all is the Artists shelf's "Unknown artist",
  // whose id is the empty one, and its page has to hold it too.
  if (artistKeyOf(albumLine) === '') {
    credits.set('', { id: '', name: '', onAlbum: true });
  }
  creditNamesOf(albumLine, true).forEach((name) => add(name, true));
  creditNamesOf(track.artist ?? '', false).forEach((name) => add(name, false));
  return [...credits.values()];
};
