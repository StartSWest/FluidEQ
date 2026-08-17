/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MutableRefObject, useMemo } from 'react';
import {
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  karaokeMakerLineIsSection,
  karaokeMakerTokenWasUserTouched,
} from '../../common/karaoke/makerProject';
import { TSelection } from './useKaraokeMakerSelection';
import { DEFAULT_VIEW_MS } from './useKaraokeMakerEditorView';
import {
  BASE_LYRIC_SECTION_TOP,
  SECTION_GROUP_HEIGHT,
  lyricSectionHeight,
} from './makerCanvasGeometry';
import {
  KARAOKE_MAKER_LYRIC_LANE_COUNT,
  groupKaraokeMakerWordSyllables,
  karaokeMakerLyricFocus,
  karaokeMakerSectionGroups,
} from './makerCanvasLayout';
import { ICanvasLyricToken, ICanvasLyricWord } from './makerCanvasTypes';

/** The tightest the view may be zoomed, so a word never fills the screen. */
const MIN_VIEW_MS = 650;

const LYRIC_SECTION_HEIGHT = lyricSectionHeight(KARAOKE_MAKER_LYRIC_LANE_COUNT);

/**
 * Everything the canvas draws, derived from the project and the view.
 *
 * A hundred and ninety-five lines that compute rather than decide: the visible
 * window and its limits, how tall the lyric lane is, which words fall inside
 * the view, which one has focus and how long it has had it. Nothing here is
 * state and nothing here has an effect — given the same project and the same
 * window it produces the same answer.
 *
 * That is why seven parameters cover it, where the pointer handlers needed
 * forty-three. It is the largest thing taken out of this component and the one
 * that depended on it least, which is the usual shape of code that has ended up
 * somewhere by accident rather than by design.
 */
export interface IMakerCanvasModelParams {
  project: IKaraokeMakerProject;
  tokens: IKaraokeMakerToken[];
  selection: TSelection;
  /** The audio's length, which bounds everything else here. */
  durationMs: number;
  viewDurationMs: number;
  visualPlayheadMs: number;
  /**
   * When the focused word last changed.
   *
   * Read here to decide whether a word is still animating in, written by the
   * effect that notices the focus move.
   */
  wordFocusAnimationRef: MutableRefObject<{
    tokenId?: string;
    startedAt: number;
  }>;
}

export const useMakerCanvasModel = ({
  durationMs,
  project,
  selection,
  tokens,
  viewDurationMs,
  visualPlayheadMs,
  wordFocusAnimationRef,
}: IMakerCanvasModelParams) => {
  const effectiveDurationMs = Math.max(
    1_000,
    durationMs || project.audio.durationMs || DEFAULT_VIEW_MS,
  );
  const minimumViewDurationMs = Math.min(MIN_VIEW_MS, effectiveDurationMs);
  const maximumViewDurationMs = Math.max(
    minimumViewDurationMs,
    effectiveDurationMs,
  );
  const visibleViewDurationMs = Math.max(
    minimumViewDurationMs,
    Math.min(maximumViewDurationMs, viewDurationMs),
  );
  const maximumViewStartMs = Math.max(
    0,
    effectiveDurationMs - visibleViewDurationMs,
  );
  const canvasSectionGroups = useMemo(
    () =>
      karaokeMakerSectionGroups(
        project.lyrics.lines.flatMap((line) =>
          karaokeMakerLineIsSection(line) && line.startMs !== undefined
            ? [
                {
                  id: line.id,
                  text: line.tokens
                    .map((token) => token.text.trim())
                    .filter(Boolean)
                    .join(' '),
                  startMs: line.startMs,
                },
              ]
            : [],
        ),
        effectiveDurationMs,
      ),
    [effectiveDurationMs, project.lyrics.lines],
  );
  const lyricSectionTop =
    BASE_LYRIC_SECTION_TOP +
    (canvasSectionGroups.length ? SECTION_GROUP_HEIGHT : 0);
  const headerHeight = lyricSectionTop + LYRIC_SECTION_HEIGHT + 10;
  const lyricLines = useMemo(
    () =>
      project.lyrics.lines.filter(
        (line) => !karaokeMakerLineIsSection(line) && line.tokens.length > 0,
      ),
    [project.lyrics.lines],
  );
  const selectedLyricLineId = useMemo(() => {
    if (selection?.kind !== 'word') {
      return undefined;
    }
    return lyricLines.find((line) =>
      line.tokens.some((token) => token.id === selection.id),
    )?.id;
  }, [lyricLines, selection]);
  const userTouchedWordCount = useMemo(
    () => tokens.filter(karaokeMakerTokenWasUserTouched).length,
    [tokens],
  );
  const canvasLyricTokens = useMemo(
    () =>
      project.lyrics.lines
        .flatMap((line, lineIndex): ICanvasLyricToken[] => {
          const isSection = karaokeMakerLineIsSection(line);
          if (isSection) {
            return [];
          }
          const timedTokens = line.tokens.filter(
            (token) => token.startMs !== undefined && token.endMs !== undefined,
          );
          const lineStartMs = timedTokens.length
            ? Math.min(...timedTokens.map((token) => token.startMs as number))
            : (line.startMs ?? Number.POSITIVE_INFINITY);
          const lineEndMs = timedTokens.length
            ? Math.max(...timedTokens.map((token) => token.endMs as number))
            : (line.endMs ?? line.startMs ?? Number.NEGATIVE_INFINITY);
          return line.tokens.map((originalToken, tokenIndex) => ({
            token: originalToken,
            lineIndex,
            tokenIndex,
            lineStartMs,
            lineEndMs,
            isSection,
          }));
        })
        .sort(
          (left, right) =>
            (left.token.startMs ?? Number.POSITIVE_INFINITY) -
            (right.token.startMs ?? Number.POSITIVE_INFINITY),
        ),
    [project.lyrics.lines],
  );
  const canvasLyricWords = useMemo(() => {
    const tokensByLine = new Map<number, ICanvasLyricToken[]>();
    canvasLyricTokens.forEach((entry) => {
      const lineTokens = tokensByLine.get(entry.lineIndex) ?? [];
      lineTokens.push(entry);
      tokensByLine.set(entry.lineIndex, lineTokens);
    });
    return [...tokensByLine.values()]
      .flatMap((lineTokens): ICanvasLyricWord[] => {
        if (!lineTokens.length) {
          return [];
        }
        const orderedLineTokens = [...lineTokens].sort(
          (left, right) => left.tokenIndex - right.tokenIndex,
        );
        const [{ isSection }] = orderedLineTokens;
        const groups: ICanvasLyricToken[][] = groupKaraokeMakerWordSyllables(
          orderedLineTokens
            .filter(
              ({ token }) =>
                token.startMs !== undefined && token.endMs !== undefined,
            )
            .map((entry) => ({
              ...entry,
              startsWord: entry.token.startsWord,
            })),
        );
        return groups.flatMap((syllables, wordIndex): ICanvasLyricWord[] => {
          const timed = syllables.filter(
            ({ token }) =>
              token.startMs !== undefined && token.endMs !== undefined,
          );
          if (!timed.length) {
            return [];
          }
          return [
            {
              id: timed[0].token.id,
              text: timed.map(({ token }) => token.text.trim()).join(''),
              syllables: timed,
              lineIndex: timed[0].lineIndex,
              wordIndex,
              lineStartMs: timed[0].lineStartMs,
              lineEndMs: timed[0].lineEndMs,
              startMs: Math.min(
                ...timed.map(({ token }) => token.startMs as number),
              ),
              endMs: Math.max(
                ...timed.map(({ token }) => token.endMs as number),
              ),
              isSection,
            },
          ];
        });
      })
      .sort(
        (left, right) =>
          left.startMs - right.startMs || left.lineIndex - right.lineIndex,
      );
  }, [canvasLyricTokens]);
  const activeLyricFocus = useMemo(
    () =>
      karaokeMakerLyricFocus(
        canvasLyricTokens.flatMap(
          ({ token, lineIndex, lineStartMs, lineEndMs, isSection }) =>
            isSection ||
            token.startMs === undefined ||
            token.endMs === undefined
              ? []
              : [
                  {
                    id: token.id,
                    lineIndex,
                    lineStartMs,
                    lineEndMs,
                    startMs: token.startMs,
                    endMs: token.endMs,
                  },
                ],
        ),
        visualPlayheadMs,
      ),
    [canvasLyricTokens, visualPlayheadMs],
  );
  const activeLyricWordId = useMemo(
    () =>
      activeLyricFocus?.tokenId
        ? canvasLyricWords.find((word) =>
            word.syllables.some(
              ({ token }) => token.id === activeLyricFocus.tokenId,
            ),
          )?.id
        : undefined,
    [activeLyricFocus?.tokenId, canvasLyricWords],
  );
  if (wordFocusAnimationRef.current.tokenId !== activeLyricWordId) {
    wordFocusAnimationRef.current = {
      tokenId: activeLyricWordId,
      startedAt: performance.now(),
    };
  }

  return {
    activeLyricFocus,
    activeLyricWordId,
    canvasLyricTokens,
    canvasLyricWords,
    canvasSectionGroups,
    effectiveDurationMs,
    headerHeight,
    lyricLines,
    lyricSectionTop,
    maximumViewDurationMs,
    maximumViewStartMs,
    minimumViewDurationMs,
    selectedLyricLineId,
    userTouchedWordCount,
    visibleViewDurationMs,
  };
};
