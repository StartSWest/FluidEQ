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

import { karaokeMakerLineLooksLikeLabel } from './makerProject/sectionLabels';

import {
  IKaraokeLine,
  IKaraokeParsedLyrics,
  IKaraokeToken,
  KaraokeParseError,
} from './types';

const LINE_TIMESTAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const WORD_TIMESTAMP = /<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>/g;
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

const timestampToMs = (
  minutes: string,
  seconds: string,
  fraction?: string,
): number =>
  Number(minutes) * 60_000 + Number(seconds) * 1_000 + fractionToMs(fraction);

const parseEnhancedTokens = (
  text: string,
  offsetMs: number,
): IKaraokeToken[] => {
  const matches = Array.from(text.matchAll(WORD_TIMESTAMP));
  if (!matches.length) {
    return [{ text }];
  }

  const tokens: IKaraokeToken[] = [];
  if ((matches[0].index ?? 0) > 0) {
    tokens.push({ text: text.slice(0, matches[0].index) });
  }
  let previousText = '';
  matches.forEach((match, index) => {
    const textStart = (match.index ?? 0) + match[0].length;
    const textEnd = matches[index + 1]?.index ?? text.length;
    const startMs = timestampToMs(match[1], match[2], match[3]) + offsetMs;
    const next = matches[index + 1];
    const tokenText = text.slice(textStart, textEnd);
    tokens.push({
      text: tokenText,
      startsWord:
        index === 0 || /^\s/u.test(tokenText) || /\s$/u.test(previousText),
      startMs,
      endMs: next
        ? timestampToMs(next[1], next[2], next[3]) + offsetMs
        : undefined,
    });
    previousText = tokenText;
  });
  return tokens;
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

  const lines: IKaraokeLine[] = [];
  let hasWordTiming = false;
  source.split('\n').forEach((row, sourceIndex) => {
    LINE_TIMESTAMP.lastIndex = 0;
    const stamps = Array.from(row.matchAll(LINE_TIMESTAMP));
    if (!stamps.length) {
      return;
    }
    const lyricText = row.slice(
      Math.max(...stamps.map((stamp) => (stamp.index ?? 0) + stamp[0].length)),
    );
    const enhanced = WORD_TIMESTAMP.test(lyricText);
    WORD_TIMESTAMP.lastIndex = 0;
    hasWordTiming = hasWordTiming || enhanced;

    stamps.forEach((stamp, stampIndex) => {
      const startMs = timestampToMs(stamp[1], stamp[2], stamp[3]) + offsetMs;
      lines.push({
        id: `lrc-${sourceIndex}-${stampIndex}-${startMs}`,
        kind: karaokeMakerLineLooksLikeLabel(lyricText) ? 'section' : 'lyrics',
        startMs,
        tokens: enhanced
          ? parseEnhancedTokens(lyricText, offsetMs)
          : [{ text: lyricText }],
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
  lines.forEach((line, index) => {
    const nextStart = lines[index + 1]?.startMs;
    line.endMs = nextStart;
    const lastTimedToken = [...line.tokens]
      .reverse()
      .find((token) => token.startMs !== undefined);
    if (lastTimedToken && lastTimedToken.endMs === undefined) {
      lastTimedToken.endMs = nextStart;
    }
  });

  return {
    title,
    artist,
    timingPrecision: hasWordTiming ? 'word' : 'line',
    lines,
    pitch: { kind: 'none', reason: 'missing' },
    gapMs: offsetMs,
    sourceFormat: hasWordTiming ? 'elrc' : 'lrc',
  };
};
