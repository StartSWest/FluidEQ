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

import {
  IKaraokeLine,
  IKaraokeParsedLyrics,
  IKaraokeToken,
  KaraokeParseError,
} from './types';
import { isKaraokeSectionText } from './sections';

/**
 * Exported so content detection cannot drift from parsing.
 *
 * They were two separate patterns, and the day this one learned the hour form
 * the other did not: an `[01:02:03.45]` file stopped being recognised as LRC,
 * fell through to the UltraStar adapter, and told the user it declared no BPM.
 */
export const LINE_TIMESTAMP =
  /\[(\d{1,3}):(\d{1,2})(?::(\d{1,3}))?(?:\.(\d{1,4}))?\]/g;
const WORD_TIMESTAMP = /<(\d{1,3}):(\d{1,2})(?::(\d{1,3}))?(?:\.(\d{1,4}))?>/g;
const META_TAG = /^\[([a-z]+):([^\]]*)\]\s*$/i;

const fractionToMs = (fraction = ''): number => {
  if (!fraction) {
    return 0;
  }
  if (fraction.length === 1) {
    return Number(fraction) * 100;
  }
  if (fraction.length === 2) {
    return Number(fraction) * 10;
  }
  return Number(fraction.slice(0, 3));
};

/**
 * Read one timestamp, in every shape the format is written in.
 *
 * Three fields with a dotted fraction is the hour form `[hh:mm:ss.xx]`; three
 * fields without one is the older `[mm:ss:xx]`, where the last field is
 * hundredths. Keeping that distinction matters both ways round: reading
 * `[00:12:34]` as an hour form would move a line from 12 seconds to twelve
 * minutes, and rejecting `[01:02:03.45]` — which is what the parser did —
 * dropped the row silently, with no error and no count.
 */
const stampToMs = (fields: RegExpMatchArray): number => {
  const [, first, second, third, dotted] = fields;
  if (third !== undefined && dotted !== undefined) {
    return (
      Number(first) * 3_600_000 +
      Number(second) * 60_000 +
      Number(third) * 1_000 +
      fractionToMs(dotted)
    );
  }
  return (
    Number(first) * 60_000 +
    Number(second) * 1_000 +
    fractionToMs(third ?? dotted)
  );
};

const parseEnhancedTokens = (
  text: string,
  shiftMs: number,
): IKaraokeToken[] => {
  const matches = Array.from(text.matchAll(WORD_TIMESTAMP));
  if (!matches.length) {
    return [{ text }];
  }

  const tokens: IKaraokeToken[] = [];
  const prefix =
    (matches[0].index ?? 0) > 0 ? text.slice(0, matches[0].index) : '';
  if (prefix) {
    tokens.push({ text: prefix });
  }
  let previousText = prefix;
  matches.forEach((match, index) => {
    const textStart = (match.index ?? 0) + match[0].length;
    const textEnd = matches[index + 1]?.index ?? text.length;
    const startMs = stampToMs(match) + shiftMs;
    const next = matches[index + 1];
    const tokenText = text.slice(textStart, textEnd);
    tokens.push({
      text: tokenText,
      // A tag that opens mid-word does not open a word. `Hel<00:10.50>lo`
      // used to produce two word starts, which the renderer joined with a
      // space and drew as "Hel lo".
      startsWord:
        (index === 0 && !previousText) ||
        /^\s/u.test(tokenText) ||
        /\s$/u.test(previousText),
      startMs,
      endMs: next ? stampToMs(next) + shiftMs : undefined,
    });
    previousText = tokenText;
  });
  return tokens;
};

interface IKaraokeLrcRowGroup {
  /** Every time this same text is sung; more than one is a repeated line. */
  startsMs: number[];
  text: string;
}

/**
 * Split one row into the groups of timestamps that share a lyric.
 *
 * Only timestamps standing next to each other name the same words. The parser
 * used to slice the lyric from the LAST stamp on the row and give that
 * fragment to all of them, which deleted whatever came before: `[00:10.00]la
 * la [00:20.00]la` became "la" twice, and the trailing-end-tag convention
 * `[00:40.00]Some words[00:43.00]` erased the words entirely and left two
 * blank lines.
 */
const groupRowStamps = (row: string): IKaraokeLrcRowGroup[] => {
  const stamps = Array.from(row.matchAll(LINE_TIMESTAMP));
  const groups: IKaraokeLrcRowGroup[] = [];
  let startsMs: number[] = [];
  stamps.forEach((stamp, index) => {
    const textStart = (stamp.index ?? 0) + stamp[0].length;
    const textEnd = stamps[index + 1]?.index ?? row.length;
    const text = row.slice(textStart, textEnd);
    startsMs.push(stampToMs(stamp));
    if (text || index === stamps.length - 1) {
      groups.push({ startsMs, text });
      startsMs = [];
    }
  });
  return groups;
};

/** Parse line-timed LRC and enhanced word-timed LRC without touching files. */
// A named parser reads more clearly at each importer call site.
// eslint-disable-next-line import/prefer-default-export
export const parseLrc = (contents: string): IKaraokeParsedLyrics => {
  const source = contents.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!source.trim()) {
    throw new KaraokeParseError('empty', 'The lyric file is empty.');
  }

  let title: string | undefined;
  let artist: string | undefined;
  let offsetMs = 0;
  source.split('\n').forEach((row) => {
    const meta = row.trim().match(META_TAG);
    if (!meta) {
      return;
    }
    const key = meta[1].toLowerCase();
    const value = meta[2].trim();
    if (key === 'ti' && value) {
      title = value;
    } else if (key === 'ar' && value) {
      artist = value;
    } else if (key === 'offset' && /^[-+]?\d+$/.test(value)) {
      offsetMs = Number(value);
    }
  });

  /*
   * `[offset:+500]` means the words are wanted HALF A SECOND EARLIER.
   *
   * Every description of the tag agrees — "+ causing lyrics to appear sooner"
   * — and so does the one reference implementation that can be run rather
   * than read. This code added the value instead of subtracting it, which
   * moved a file by twice its own correction in the wrong direction: a lyric
   * already half a second late arrived a second late.
   */
  const timeShiftMs = -offsetMs;

  const lines: IKaraokeLine[] = [];
  let hasWordTiming = false;
  source.split('\n').forEach((row, sourceIndex) => {
    LINE_TIMESTAMP.lastIndex = 0;
    const groups = groupRowStamps(row);
    if (!groups.length) {
      return;
    }
    // A final group with no words after a group that had some is the closing
    // stamp of the row, not a line of its own: it says when the last word
    // ends. A row that is nothing but a stamp is the other thing entirely —
    // the blank instrumental marker — and keeps its line.
    const closing =
      groups.length > 1 && !groups[groups.length - 1].text
        ? groups.pop()
        : undefined;
    groups.forEach((group, groupIndex) => {
      const lyricText = group.text;
      const enhanced = WORD_TIMESTAMP.test(lyricText);
      WORD_TIMESTAMP.lastIndex = 0;
      hasWordTiming = hasWordTiming || enhanced;
      const isLastGroup = groupIndex === groups.length - 1;

      group.startsMs.forEach((rawStartMs, stampIndex) => {
        const startMs = rawStartMs + timeShiftMs;
        lines.push({
          id: `lrc-${sourceIndex}-${groupIndex}-${stampIndex}-${startMs}`,
          kind: isKaraokeSectionText(lyricText) ? 'section' : 'lyrics',
          startMs,
          // Word stamps are absolute, so a repeated line has to carry them
          // forward by the distance between the two occurrences. Without the
          // shift a repeated chorus arrived already fully sung.
          // The closing stamp belongs to the occurrence it was written for, so
          // a repeat carries it forward by the same distance as its words.
          // Handing every copy the first one's end held the first line open
          // for thirty-five seconds, overlapping the second.
          endMs:
            isLastGroup && closing
              ? closing.startsMs[0] +
                timeShiftMs +
                (rawStartMs - group.startsMs[0])
              : undefined,
          tokens: enhanced
            ? parseEnhancedTokens(
                lyricText,
                timeShiftMs + (rawStartMs - group.startsMs[0]),
              )
            : [{ text: lyricText }],
        });
      });
    });
  });

  if (!lines.length) {
    throw new KaraokeParseError(
      'missing-timing',
      'No valid LRC timestamps were found.',
    );
  }

  lines.sort((left, right) => (left.startMs ?? 0) - (right.startMs ?? 0));
  // Two lines at the same instant cannot both be shown: the active-line search
  // walks forward to the last one that has started, so every earlier copy was
  // unreachable and was handed an end time equal to its start. Keeping one
  // line per instant — the first that has words — makes the file mean what it
  // looks like it means.
  const hasWords = (line: IKaraokeLine): boolean =>
    line.tokens.some((token) => token.text.trim().length > 0);
  const keptAtInstant = new Map<number | undefined, IKaraokeLine>();
  lines.forEach((line) => {
    const held = keptAtInstant.get(line.startMs);
    if (!held || (!hasWords(held) && hasWords(line))) {
      keptAtInstant.set(line.startMs, line);
    }
  });
  const deduped = lines.filter(
    (line) => keptAtInstant.get(line.startMs) === line,
  );
  deduped.forEach((line, index) => {
    const nextStart = deduped[index + 1]?.startMs;
    if (line.endMs === undefined) {
      line.endMs = nextStart;
    } else if (nextStart !== undefined && line.endMs > nextStart) {
      // A closing stamp is a claim about one line and cannot outlive the next
      // one starting. A row that repeats its text and then closes it can say
      // so in a way that leaves the first copy still lit when the second
      // begins, and two lit lines is a defect the singer sees.
      line.endMs = nextStart;
    }
    const lastTimedToken = [...line.tokens]
      .reverse()
      .find((token) => token.startMs !== undefined);
    if (lastTimedToken && lastTimedToken.endMs === undefined) {
      // A trailing word tag with nothing after it is the line's closing stamp,
      // so it ends where it begins. Stretching it to the next line instead
      // made the renderer treat it as a held note and creep the last word of
      // every line across an instrumental gap.
      lastTimedToken.endMs = lastTimedToken.text.trim()
        ? line.endMs
        : lastTimedToken.startMs;
    }
  });

  return {
    title,
    artist,
    timingPrecision: hasWordTiming ? 'word' : 'line',
    lines: deduped,
    pitch: { kind: 'none', reason: 'missing' },
    // Zero, not the offset. `gapMs` means "the singing starts here", which LRC
    // has no way of saying; the offset is already inside every time above.
    // Reporting it here as well made the Maker's UltraStar export subtract it
    // a second time, so a file with an offset exported at twice the error.
    gapMs: 0,
    sourceFormat: hasWordTiming ? 'elrc' : 'lrc',
  };
};
