/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  Dispatch,
  MutableRefObject,
  SetStateAction,
  useCallback,
  useEffect,
} from 'react';
import {
  IKaraokeMakerLine,
  karaokeMakerRecordedLineRange,
  karaokeMakerTimedLineRange,
  recordKaraokeMakerLineRange,
} from '../../common/karaoke/makerProject';
import { useTranslation } from '../utils/I18nContext';
import useKaraokeMakerProject from './useKaraokeMakerProject';
import { TSelection } from './useKaraokeMakerSelection';

/** How far through arming a guided capture the user is. */
export type TLineEntrySession = 'setup' | 'countdown' | 'active';

/**
 * One line being timed by ear, mid-capture.
 *
 * The end is an estimate until the user marks it: a line has to be drawn on the
 * canvas the moment recording starts, and guessing its length from the words is
 * better than drawing nothing.
 */
export interface IGuidedLineCapture {
  lineId: string;
  startMs: number;
  estimatedEndMs: number;
  wordBoundariesMs?: number[];
  automaticStart?: boolean;
}

/**
 * Timing lyrics by ear, one line at a time, against playback.
 *
 * Four hundred lines of one component and a mode of its own: the song plays,
 * the user taps a line in and taps it out, and the editor walks forward to the
 * next one. Everything here is about that walk — where the playhead should be,
 * which line is armed, what a tap means, and how to skip a line that has no
 * words worth timing.
 *
 * The capture state itself stays in the component rather than moving in here.
 * The toolbar reads it to decide what the record button says, and the canvas
 * reads it to draw the line being timed, so it has more readers than this hook
 * and is not this hook's to own.
 */
export interface IMakerLineCaptureParams extends Pick<
  ReturnType<typeof useKaraokeMakerProject>,
  'commit' | 'undo'
> {
  lyricLines: IKaraokeMakerLine[];
  selectedLyricLineId: string | undefined;
  t: ReturnType<typeof useTranslation>['t'];

  /** Where the capture has got to, owned by the component. */
  lineEntryMode: boolean;
  lineEntrySession: TLineEntrySession;
  lineEntryCapture: IGuidedLineCapture | undefined;
  lineEntryIndex: number;
  /**
   * The index a callback should read.
   *
   * A guided capture is driven by keystrokes and timers that were created
   * several lines ago; the state value they closed over is stale by the time
   * they fire, and stepping from a stale index skips or repeats a line.
   */
  lineEntryIndexRef: MutableRefObject<number>;
  setLineEntryMode: Dispatch<SetStateAction<boolean>>;
  setLineEntryCapture: Dispatch<SetStateAction<IGuidedLineCapture | undefined>>;
  setLineEntryIndex: Dispatch<SetStateAction<number>>;
  startLineEntryCountdown: () => void;
  clearLineEntryCountdown: () => void;

  /** Transport, because every decision here is made against the playhead. */
  isPlaying: boolean;
  playheadMs: number;
  readPlayheadMs?: () => number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (positionMs: number) => void;

  /** The view, which follows the line being timed. */
  effectiveDurationMs: number;
  visibleViewDurationMs: number;
  maximumViewStartMs: number;
  setViewStartMs: Dispatch<SetStateAction<number>>;
  setFollowViewport: Dispatch<SetStateAction<boolean>>;
  setLyricFollowRequestKey: Dispatch<SetStateAction<number>>;

  setSelection: Dispatch<SetStateAction<TSelection>>;
  setSelectedNoteIds: Dispatch<SetStateAction<Set<string>>>;
  setPreviewOpen: Dispatch<SetStateAction<boolean>>;
  setNotice: (message?: string) => void;
}

export const useMakerLineCapture = ({
  clearLineEntryCountdown,
  commit,
  effectiveDurationMs,
  isPlaying,
  lineEntryCapture,
  lineEntryIndex,
  lineEntryIndexRef,
  lineEntryMode,
  lineEntrySession,
  lyricLines,
  maximumViewStartMs,
  onPause,
  onPlay,
  onSeek,
  playheadMs,
  readPlayheadMs,
  selectedLyricLineId,
  setFollowViewport,
  setLineEntryCapture,
  setLineEntryIndex,
  setLineEntryMode,
  setLyricFollowRequestKey,
  setNotice,
  setPreviewOpen,
  setSelectedNoteIds,
  setSelection,
  setViewStartMs,
  startLineEntryCountdown,
  t,
  undo,
  visibleViewDurationMs,
}: IMakerLineCaptureParams) => {
  const seekGuidedTimeline = useCallback(
    (requestedMs: number) => {
      const nextMs = Math.max(0, Math.min(effectiveDurationMs, requestedMs));
      onSeek(nextMs);
      setFollowViewport(true);
      setViewStartMs(
        Math.max(
          0,
          Math.min(maximumViewStartMs, nextMs - visibleViewDurationMs * 0.3),
        ),
      );
    },
    [
      effectiveDurationMs,
      maximumViewStartMs,
      onSeek,
      setFollowViewport,
      setViewStartMs,
      visibleViewDurationMs,
    ],
  );

  const selectGuidedLine = useCallback(
    (index: number) => {
      const nextIndex = Math.max(0, Math.min(lyricLines.length - 1, index));
      const line = lyricLines[nextIndex];
      if (!line) {
        return;
      }
      setLineEntryCapture(undefined);
      lineEntryIndexRef.current = nextIndex;
      setLineEntryIndex(nextIndex);
      setSelection({ kind: 'word', id: line.tokens[0].id });
      setLyricFollowRequestKey((key) => key + 1);
    },
    [
      lineEntryIndexRef,
      lyricLines,
      setLineEntryCapture,
      setLineEntryIndex,
      setLyricFollowRequestKey,
      setSelection,
    ],
  );

  const recordLineEntry = useCallback(() => {
    if (lineEntrySession !== 'active') {
      return;
    }
    const line = lyricLines[lineEntryIndex];
    if (!line) {
      setLineEntryMode(false);
      setNotice(t('karaoke.maker.lineTimingComplete'));
      return;
    }
    const now = Math.max(0, readPlayheadMs?.() ?? playheadMs);
    const timedTokens = line.tokens.filter(
      (token) => token.startMs !== undefined && token.endMs !== undefined,
    );
    const detectedStartMs = timedTokens.length
      ? Math.min(...timedTokens.map((token) => token.startMs as number))
      : undefined;
    const detectedEndMs = timedTokens.length
      ? Math.max(...timedTokens.map((token) => token.endMs as number))
      : undefined;
    const captureStartMs = lineEntryCapture?.startMs;
    if (!lineEntryCapture || lineEntryCapture.lineId !== line.id) {
      const estimatedSpanMs =
        detectedStartMs !== undefined && detectedEndMs !== undefined
          ? Math.max(600, detectedEndMs - detectedStartMs)
          : Math.min(8_000, Math.max(1_200, line.tokens.length * 420));
      setLineEntryCapture({
        lineId: line.id,
        startMs: now,
        estimatedEndMs: Math.min(effectiveDurationMs, now + estimatedSpanMs),
        wordBoundariesMs: [],
      });
      setFollowViewport(true);
      return;
    }
    if (captureStartMs === undefined) {
      return;
    }
    const minimumCaptureMs = Math.max(
      160,
      Math.min(700, line.tokens.length * 55),
    );
    if (now - captureStartMs < minimumCaptureMs) {
      return;
    }
    const previousLine = lyricLines[lineEntryIndex - 1];
    commit((current) =>
      recordKaraokeMakerLineRange(
        current,
        line.id,
        captureStartMs,
        now,
        previousLine?.id,
        lineEntryCapture.wordBoundariesMs,
      ),
    );
    const nextIndex = lineEntryIndex + 1;
    const nextLine = lyricLines[nextIndex];
    if (!nextLine) {
      setLineEntryCapture(undefined);
      setSelection({ kind: 'word', id: line.tokens[0].id });
      setLineEntryMode(false);
      setNotice(t('karaoke.maker.lineTimingComplete'));
      return;
    }
    // Merely revealing the next sentence must never invent its START. A pause
    // between phrases is meaningful karaoke timing, so the next Enter records
    // the exact playhead position and only a later Enter records its END.
    setLineEntryCapture(undefined);
    setLineEntryIndex(nextIndex);
    // Completing a line always previews the following sentence. Playback can
    // keep painting recorded timing progress, but must not steal this focus.
    setSelection({ kind: 'word', id: nextLine.tokens[0].id });
    setFollowViewport(true);
    setLyricFollowRequestKey((key) => key + 1);
    setViewStartMs(
      Math.max(
        0,
        Math.min(maximumViewStartMs, now - visibleViewDurationMs * 0.3),
      ),
    );
  }, [
    setLineEntryCapture,
    setLineEntryIndex,
    setLineEntryMode,
    setLyricFollowRequestKey,
    lineEntrySession,
    lyricLines,
    lineEntryIndex,
    readPlayheadMs,
    playheadMs,
    lineEntryCapture,
    commit,
    setSelection,
    setFollowViewport,
    setViewStartMs,
    maximumViewStartMs,
    visibleViewDurationMs,
    setNotice,
    t,
    effectiveDurationMs,
  ]);

  const markNextGuidedWord = useCallback(() => {
    const line = lyricLines[lineEntryIndex];
    if (
      lineEntrySession !== 'active' ||
      !line ||
      !lineEntryCapture ||
      lineEntryCapture.lineId !== line.id
    ) {
      return;
    }
    const boundaries = lineEntryCapture.wordBoundariesMs ?? [];
    if (boundaries.length >= line.tokens.length - 1) {
      return;
    }
    const now = Math.max(0, readPlayheadMs?.() ?? playheadMs);
    const previousBoundaryMs = boundaries[boundaries.length - 1];
    if (
      now <= lineEntryCapture.startMs + 20 ||
      (previousBoundaryMs !== undefined && now <= previousBoundaryMs + 20)
    ) {
      return;
    }
    const nextBoundaries = [...boundaries, now];
    setLineEntryCapture({
      ...lineEntryCapture,
      wordBoundariesMs: nextBoundaries,
    });
    const nextToken = line.tokens[nextBoundaries.length];
    if (nextToken) {
      setSelection({ kind: 'word', id: nextToken.id });
      setLyricFollowRequestKey((key) => key + 1);
    }
  }, [
    setLineEntryCapture,
    setLyricFollowRequestKey,
    lineEntryCapture,
    lineEntryIndex,
    lineEntrySession,
    lyricLines,
    playheadMs,
    readPlayheadMs,
    setSelection,
  ]);

  const ignoreGuidedLine = useCallback(() => {
    const nextIndex = lineEntryIndex + 1;
    const nextLine = lyricLines[nextIndex];
    setLineEntryCapture(undefined);
    if (!nextLine) {
      setLineEntryMode(false);
      setNotice(t('karaoke.maker.lineTimingComplete'));
      return;
    }
    lineEntryIndexRef.current = nextIndex;
    setLineEntryIndex(nextIndex);
    setSelection({ kind: 'word', id: nextLine.tokens[0].id });
    setFollowViewport(true);
    setLyricFollowRequestKey((key) => key + 1);
  }, [
    lineEntryIndexRef,
    setLineEntryCapture,
    setLineEntryIndex,
    setLineEntryMode,
    setLyricFollowRequestKey,
    lineEntryIndex,
    lyricLines,
    setFollowViewport,
    setNotice,
    setSelection,
    t,
  ]);

  useEffect(() => {
    if (!lineEntryMode) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const repeatsLineNavigation =
        event.code === 'ArrowUp' || event.code === 'ArrowDown';
      if (event.repeat && !repeatsLineNavigation) {
        return;
      }
      const target =
        event.target instanceof HTMLElement ? event.target : undefined;
      if (
        target?.matches('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      if (target?.closest('button') && event.code === 'Enter') {
        return;
      }
      if (lineEntrySession !== 'active') {
        if (lineEntrySession === 'setup' && event.code === 'Enter') {
          event.preventDefault();
          event.stopImmediatePropagation();
          startLineEntryCountdown();
          return;
        }
        if (event.code === 'Escape') {
          setLineEntryMode(false);
          clearLineEntryCountdown();
          setLineEntryCapture(undefined);
          return;
        }
        if (
          event.code === 'Enter' ||
          event.code === 'Space' ||
          event.code === 'Backspace' ||
          event.code.startsWith('Arrow')
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return;
      }
      if (event.code === 'Enter') {
        event.preventDefault();
        event.stopImmediatePropagation();
        recordLineEntry();
      } else if (event.code === 'Tab') {
        event.preventDefault();
        event.stopImmediatePropagation();
        markNextGuidedWord();
      } else if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
        event.preventDefault();
        event.stopImmediatePropagation();
        const direction = event.code === 'ArrowUp' ? -1 : 1;
        const currentIndex = lineEntryIndexRef.current;
        const nextIndex = Math.max(
          0,
          Math.min(lyricLines.length - 1, currentIndex + direction),
        );
        if (nextIndex === currentIndex) {
          return;
        }
        const nextLine = lyricLines[nextIndex];
        selectGuidedLine(nextIndex);
        if (event.code === 'ArrowUp' && nextLine) {
          const recordedRange = karaokeMakerRecordedLineRange(nextLine);
          if (recordedRange) {
            seekGuidedTimeline(recordedRange.startMs);
          }
        }
      } else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        event.preventDefault();
        event.stopImmediatePropagation();
        const now = readPlayheadMs?.() ?? playheadMs;
        const seekStepMs = event.shiftKey ? 1_000 : 2_000;
        const nextMs = Math.max(
          0,
          Math.min(
            effectiveDurationMs,
            now + (event.code === 'ArrowLeft' ? -seekStepMs : seekStepMs),
          ),
        );
        seekGuidedTimeline(nextMs);
      } else if (event.code === 'Space') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (isPlaying) {
          onPause();
        } else {
          Promise.resolve(onPlay()).catch(() => undefined);
        }
      } else if (event.code === 'Backspace') {
        event.preventDefault();
        event.stopImmediatePropagation();
        undo();
        selectGuidedLine(lineEntryIndexRef.current - 1);
      } else if (event.code === 'Escape') {
        setLineEntryMode(false);
        setLineEntryCapture(undefined);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    lineEntryIndexRef,
    setLineEntryCapture,
    setLineEntryMode,
    effectiveDurationMs,
    clearLineEntryCountdown,
    isPlaying,
    lineEntryMode,
    lineEntrySession,
    lyricLines,
    markNextGuidedWord,
    onPause,
    onPlay,
    playheadMs,
    readPlayheadMs,
    recordLineEntry,
    seekGuidedTimeline,
    selectGuidedLine,
    startLineEntryCountdown,
    undo,
  ]);

  useEffect(() => {
    if (lineEntryMode) {
      return undefined;
    }
    const navigatePreviewLyrics = (event: KeyboardEvent) => {
      if (
        (event.code !== 'ArrowUp' && event.code !== 'ArrowDown') ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        document.querySelector(
          '.karaoke-maker__modal-backdrop, .dropdown--open',
        )
      ) {
        return;
      }
      const target =
        event.target instanceof HTMLElement ? event.target : undefined;
      if (
        target?.matches('input, textarea, select, [contenteditable="true"]') ||
        target?.closest('button')
      ) {
        return;
      }
      let currentIndex = selectedLyricLineId
        ? lyricLines.findIndex((line) => line.id === selectedLyricLineId)
        : -1;
      if (currentIndex < 0) {
        const now = Math.max(0, readPlayheadMs?.() ?? playheadMs);
        currentIndex = lyricLines.findIndex((line) => {
          const range = karaokeMakerTimedLineRange(line);
          return range && now >= range.startMs && now <= range.endMs;
        });
        if (currentIndex < 0) {
          const nextTimedIndex = lyricLines.findIndex((line) => {
            const range = karaokeMakerTimedLineRange(line);
            return range !== undefined && range.startMs >= now;
          });
          if (event.code === 'ArrowDown') {
            currentIndex = Math.max(-1, nextTimedIndex - 1);
          } else {
            currentIndex =
              nextTimedIndex >= 0 ? nextTimedIndex : lyricLines.length;
          }
        }
      }
      const direction = event.code === 'ArrowUp' ? -1 : 1;
      const nextIndex = Math.max(
        0,
        Math.min(lyricLines.length - 1, currentIndex + direction),
      );
      const nextLine = lyricLines[nextIndex];
      if (!nextLine || nextIndex === currentIndex) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      setSelection({ kind: 'word', id: nextLine.tokens[0].id });
      setSelectedNoteIds(new Set());
      setPreviewOpen(true);
      setLyricFollowRequestKey((key) => key + 1);
    };
    window.addEventListener('keydown', navigatePreviewLyrics, true);
    return () =>
      window.removeEventListener('keydown', navigatePreviewLyrics, true);
  }, [
    setLyricFollowRequestKey,
    setPreviewOpen,
    lineEntryMode,
    lyricLines,
    playheadMs,
    readPlayheadMs,
    selectedLyricLineId,
    setSelection,
    setSelectedNoteIds,
  ]);

  return {
    ignoreGuidedLine,
    markNextGuidedWord,
    recordLineEntry,
    selectGuidedLine,
  };
};
