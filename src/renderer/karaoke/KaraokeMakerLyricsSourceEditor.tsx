/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject, useMemo, useState } from 'react';
import {
  IKaraokeMakerLine,
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  karaokeMakerLineIsSection,
} from '../../common/karaoke/makerProject';

interface IKaraokeMakerLyricsSourceEditorProps {
  value: string;
  project: IKaraokeMakerProject;
  disabled: boolean;
  placeholder: string;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
}

interface IHighlightSegment {
  text: string;
  timing?: 'timed' | 'untimed' | 'section';
}

const wordsInLine = (line: IKaraokeMakerLine): IKaraokeMakerToken[][] => {
  const words: IKaraokeMakerToken[][] = [];
  line.tokens.forEach((token) => {
    if (token.startsWord !== false || !words.length) {
      words.push([token]);
    } else {
      words[words.length - 1].push(token);
    }
  });
  return words;
};

const wordTiming = (
  tokens: readonly IKaraokeMakerToken[],
): IHighlightSegment['timing'] =>
  tokens.every(
    (token) =>
      token.startMs !== undefined &&
      token.endMs !== undefined &&
      token.endMs > token.startMs,
  )
    ? 'timed'
    : 'untimed';

const highlightedLine = (
  rawLine: string,
  line: IKaraokeMakerLine | undefined,
): IHighlightSegment[] => {
  if (!line || !rawLine.trim()) {
    return [{ text: rawLine }];
  }
  if (karaokeMakerLineIsSection(line)) {
    return [{ text: rawLine, timing: 'section' }];
  }
  const leading = rawLine.match(/^\s*/u)?.[0] ?? '';
  const trailing = rawLine.match(/\s*$/u)?.[0] ?? '';
  const core = rawLine.slice(leading.length, rawLine.length - trailing.length);
  const words = wordsInLine(line);
  const parts = core.split(/(\s+)/u).filter((part) => part !== '');
  const rawWords = parts.filter((part) => !/^\s+$/u.test(part));
  const segments: IHighlightSegment[] = [];
  if (leading) {
    segments.push({ text: leading });
  }
  if (rawWords.length === words.length) {
    let wordIndex = 0;
    parts.forEach((part) => {
      if (/^\s+$/u.test(part)) {
        segments.push({ text: part });
      } else {
        segments.push({ text: part, timing: wordTiming(words[wordIndex]) });
        wordIndex += 1;
      }
    });
  } else {
    const projectText = words
      .flatMap((tokens) => tokens)
      .map((token) => token.text)
      .join('');
    if (!/\s/u.test(core) && projectText === core) {
      words.forEach((tokens) =>
        segments.push({
          text: tokens.map((token) => token.text).join(''),
          timing: wordTiming(tokens),
        }),
      );
    } else {
      const allTimed =
        words.length > 0 && words.every((word) => wordTiming(word) === 'timed');
      segments.push({ text: core, timing: allTimed ? 'timed' : 'untimed' });
    }
  }
  if (trailing) {
    segments.push({ text: trailing });
  }
  return segments;
};

const highlightSegments = (
  value: string,
  project: IKaraokeMakerProject,
): IHighlightSegment[] => {
  const lines = value.split('\n');
  let projectLineIndex = 0;
  return lines.flatMap((rawLine, index) => {
    const line = rawLine.trim()
      ? project.lyrics.lines[projectLineIndex]
      : undefined;
    if (rawLine.trim()) {
      projectLineIndex += 1;
    }
    const segments = highlightedLine(rawLine, line);
    return index < lines.length - 1 ? [...segments, { text: '\n' }] : segments;
  });
};

/**
 * A real textarea with a synchronized, non-interactive color layer beneath it.
 * Native textareas cannot color individual words; keeping the textarea on top
 * preserves selection, keyboard editing, spellcheck and undo while the mirror
 * paints words whose reconciled tokens already own timing.
 */
const KaraokeMakerLyricsSourceEditor = ({
  value,
  project,
  disabled,
  placeholder,
  textareaRef,
  onChange,
}: IKaraokeMakerLyricsSourceEditorProps) => {
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const segments = useMemo(
    () => highlightSegments(value, project),
    [project, value],
  );
  return (
    <div className="karaoke-maker__lyrics-source-editor">
      <div className="karaoke-maker__lyrics-source-highlight" aria-hidden>
        <div
          style={{
            transform: `translate(${-scroll.left}px, ${-scroll.top}px)`,
          }}
        >
          {segments.map((segment, index) => (
            <span
              // Text position is the stable identity here; there is no model id
              // for whitespace between words.
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className={segment.timing ? `is-${segment.timing}` : undefined}
            >
              {segment.text}
            </span>
          ))}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) =>
          setScroll({
            left: event.currentTarget.scrollLeft,
            top: event.currentTarget.scrollTop,
          })
        }
        placeholder={placeholder}
        spellCheck
      />
    </div>
  );
};

export default KaraokeMakerLyricsSourceEditor;
