/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dispatch, MutableRefObject, SetStateAction, useCallback } from 'react';
import {
  IKaraokeMakerNote,
  IKaraokeMakerToken,
  karaokeMakerTimedLineRange,
  resizeKaraokeMakerTokenBoundary,
} from '../../common/karaoke/makerProject';
import { useTranslation } from '../utils/I18nContext';
import { useKaraokeMakerProject } from './useKaraokeMakerProject';
import { TSelection } from './useKaraokeMakerSelection';
import { flattenTokens, replaceToken } from './makerProjectEdits';

/**
 * Editing one word: its text, its timing, and moving between words.
 *
 * Small and deliberately so. These are the operations the lyrics dialog and the
 * selection inspector both need, and they were sitting between the note editing
 * and the render helpers with nothing marking them as a group.
 *
 * Auditioning a word belongs here rather than with playback: it is how the user
 * checks the edit they just made, and it is only ever reached from one of these.
 */
export interface IMakerLyricsEditingParams extends Pick<
  ReturnType<typeof useKaraokeMakerProject>,
  'commit'
> {
  tokens: IKaraokeMakerToken[];
  selectedToken: IKaraokeMakerToken | undefined;
  t: ReturnType<typeof useTranslation>['t'];
  setSelection: Dispatch<SetStateAction<TSelection>>;

  /** Transport, for auditioning the word that was just changed. */
  playheadMs: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (positionMs: number) => void;
  cancelAudibleInteractions: (pause?: boolean) => void;
  /**
   * Stops the audition after one word.
   *
   * Owned by the component because cancelAudibleInteractions clears it too, and
   * that runs on unmount as well as from here.
   */
  wordAuditionTimerRef: MutableRefObject<number | undefined>;

  /** The view follows the word being edited. */
  effectiveDurationMs: number;
  visibleViewDurationMs: number;
  maximumViewStartMs: number;
  setViewStartMs: Dispatch<SetStateAction<number>>;
}

export const useMakerLyricsEditing = ({
  cancelAudibleInteractions,
  commit,
  effectiveDurationMs,
  maximumViewStartMs,
  onPause,
  onPlay,
  onSeek,
  playheadMs,
  selectedToken,
  setSelection,
  setViewStartMs,
  t,
  tokens,
  visibleViewDurationMs,
  wordAuditionTimerRef,
}: IMakerLyricsEditingParams) => {
  const noteKindLabel = (kind: IKaraokeMakerNote['kind']): string => {
    if (kind === 'normal') {
      return t('karaoke.maker.noteNormal');
    }
    if (kind === 'golden') {
      return t('karaoke.maker.noteGolden');
    }
    return t('karaoke.maker.noteFree');
  };

  const updateSelectedTokenTiming = (update: {
    text?: string;
    startMs?: number;
    durationMs?: number;
  }) => {
    if (!selectedToken) {
      return;
    }
    commit((current) => {
      let nextProject = current;
      if (update.text !== undefined && update.text.trim()) {
        nextProject = replaceToken(nextProject, selectedToken.id, (token) => ({
          ...token,
          text: update.text?.trim().slice(0, 2_000) ?? token.text,
          source: 'manual',
        }));
      }
      let currentToken = flattenTokens(nextProject).find(
        (token) => token.id === selectedToken.id,
      );
      if (
        currentToken?.startMs !== undefined &&
        currentToken.endMs !== undefined
      ) {
        if (Number.isFinite(update.startMs)) {
          nextProject = resizeKaraokeMakerTokenBoundary(
            nextProject,
            currentToken.id,
            'start',
            update.startMs as number,
          );
          currentToken = flattenTokens(nextProject).find(
            (token) => token.id === selectedToken.id,
          );
        }
        if (
          Number.isFinite(update.durationMs) &&
          currentToken?.startMs !== undefined
        ) {
          nextProject = resizeKaraokeMakerTokenBoundary(
            nextProject,
            currentToken.id,
            'end',
            currentToken.startMs + (update.durationMs as number),
          );
        }
        return nextProject;
      }

      const line = nextProject.lyrics.lines.find((candidate) =>
        candidate.tokens.some((token) => token.id === selectedToken.id),
      );
      const tokenIndex =
        line?.tokens.findIndex((token) => token.id === selectedToken.id) ?? -1;
      const previousToken =
        tokenIndex > 0 ? line?.tokens[tokenIndex - 1] : undefined;
      const nextToken =
        line && tokenIndex >= 0 && tokenIndex + 1 < line.tokens.length
          ? line.tokens[tokenIndex + 1]
          : undefined;
      const lineRange = line ? karaokeMakerTimedLineRange(line) : undefined;
      return replaceToken(nextProject, selectedToken.id, (token) => {
        const currentStart = token.startMs ?? Math.max(0, playheadMs);
        const currentEnd = token.endMs ?? currentStart + 400;
        const requestedStart = Number.isFinite(update.startMs)
          ? update.startMs
          : currentStart;
        const requestedDuration = Number.isFinite(update.durationMs)
          ? update.durationMs
          : currentEnd - currentStart;
        const minimumStart = Math.max(
          lineRange?.startMs ?? 0,
          previousToken?.endMs ?? previousToken?.startMs ?? 0,
        );
        const maximumEnd = Math.min(
          lineRange?.endMs ?? effectiveDurationMs,
          nextToken?.startMs ?? nextToken?.endMs ?? effectiveDurationMs,
        );
        const nextStart = Math.max(
          minimumStart,
          Math.min(maximumEnd - 20, requestedStart ?? currentStart),
        );
        const nextDuration = Math.min(
          Math.max(20, maximumEnd - nextStart),
          Math.max(20, requestedDuration ?? currentEnd - currentStart),
        );
        return {
          ...token,
          startMs: nextStart,
          endMs: Math.min(maximumEnd, nextStart + nextDuration),
          source: 'manual',
          timingLocked: true,
        };
      });
    });
  };

  const auditionLyricsToken = useCallback(
    (token: IKaraokeMakerToken) => {
      if (token.startMs === undefined) {
        return;
      }
      cancelAudibleInteractions();
      const startMs = Math.max(0, Math.min(effectiveDurationMs, token.startMs));
      const endMs = Math.max(
        startMs + 20,
        Math.min(effectiveDurationMs, token.endMs ?? startMs + 400),
      );
      onSeek(startMs);
      Promise.resolve(onPlay()).catch(() => undefined);
      wordAuditionTimerRef.current = window.setTimeout(() => {
        wordAuditionTimerRef.current = undefined;
        onPause();
      }, endMs - startMs);
    },
    [
      cancelAudibleInteractions,
      effectiveDurationMs,
      onPause,
      onPlay,
      onSeek,
      wordAuditionTimerRef,
    ],
  );

  const selectLyricsEditorToken = (token: IKaraokeMakerToken) => {
    setSelection({ kind: 'word', id: token.id });
    if (token.startMs !== undefined) {
      setViewStartMs(
        Math.max(
          0,
          Math.min(
            maximumViewStartMs,
            token.startMs - visibleViewDurationMs * 0.3,
          ),
        ),
      );
      auditionLyricsToken(token);
    }
  };

  const moveLyricsEditorSelection = (direction: -1 | 1) => {
    const currentIndex = selectedToken
      ? tokens.findIndex((token) => token.id === selectedToken.id)
      : -1;
    const nextIndex = Math.max(
      0,
      Math.min(tokens.length - 1, currentIndex + direction),
    );
    const nextToken = tokens[nextIndex];
    if (nextToken) {
      selectLyricsEditorToken(nextToken);
    }
  };

  return {
    auditionLyricsToken,
    moveLyricsEditorSelection,
    noteKindLabel,
    selectLyricsEditorToken,
    updateSelectedTokenTiming,
  };
};
