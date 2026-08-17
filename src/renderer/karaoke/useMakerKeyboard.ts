/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MutableRefObject, useEffect } from 'react';
import {
  IKaraokeMakerProject,
  karaokeMakerLineIsSection,
  karaokeMakerTimedLineRange,
} from '../../common/karaoke/makerProject';
import { TSelection } from './useKaraokeMakerSelection';

/** A sentence being played back on a loop, so a line can be checked by ear. */
export interface ISentenceAuditionState {
  startMs: number;
  endMs: number;
  timerId: number;
}

/**
 * The keyboard shortcuts that play things back.
 *
 * One effect, and it stays one: every binding here is a variation on "play this
 * much of the song", and they share the audition that has to be stopped before
 * the next one starts. Split into a listener each, the stopping would be
 * duplicated four times and would eventually be forgotten once.
 *
 * Reads the playhead and the project through refs rather than values. The
 * listener is attached once and would otherwise close over whatever they were
 * at the time — pressing a key would audition the line that was selected when
 * the editor opened.
 */
export interface IMakerKeyboardParams {
  selection: TSelection;
  /** Bindings are off during a guided capture; the keys mean something else. */
  lineEntryMode: boolean;

  onPlay: () => void;
  onPause: () => void;
  onSeek: (positionMs: number) => void;
  readPlayheadMs?: () => number;
  cancelAudibleInteractions: (pause?: boolean) => void;

  projectRef: MutableRefObject<IKaraokeMakerProject>;
  playheadMsRef: MutableRefObject<number>;
  sentenceAuditionRef: MutableRefObject<ISentenceAuditionState | undefined>;
}

export const useMakerKeyboard = ({
  cancelAudibleInteractions,
  lineEntryMode,
  onPause,
  onPlay,
  onSeek,
  playheadMsRef,
  projectRef,
  readPlayheadMs,
  selection,
  sentenceAuditionRef,
}: IMakerKeyboardParams) => {
  useEffect(() => {
    const stopSentenceAudition = () => {
      const audition = sentenceAuditionRef.current;
      if (!audition) {
        return;
      }
      window.clearInterval(audition.timerId);
      sentenceAuditionRef.current = undefined;
      onPause();
      onSeek(audition.startMs);
    };
    const startSentenceAudition = (event: KeyboardEvent) => {
      const isControl =
        event.code === 'ControlLeft' ||
        event.code === 'ControlRight' ||
        event.key === 'Control';
      if (
        !isControl ||
        event.repeat ||
        event.defaultPrevented ||
        lineEntryMode ||
        sentenceAuditionRef.current ||
        selection?.kind === 'note' ||
        document.querySelector(
          '.karaoke-maker__modal-backdrop, .dropdown--open',
        )
      ) {
        return;
      }
      const { target } = event;
      if (
        target instanceof HTMLElement &&
        target.matches('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      const contentLines = projectRef.current.lyrics.lines.filter(
        (line) => !karaokeMakerLineIsSection(line) && line.tokens.length > 0,
      );
      const selectedLine =
        selection?.kind === 'word'
          ? contentLines.find((line) =>
              line.tokens.some((token) => token.id === selection.id),
            )
          : undefined;
      const now = Math.max(0, readPlayheadMs?.() ?? playheadMsRef.current);
      const playheadLine = contentLines.find((line) => {
        const range = karaokeMakerTimedLineRange(line);
        return range && now >= range.startMs && now <= range.endMs;
      });
      const auditionLine = selectedLine ?? playheadLine;
      if (!auditionLine) {
        return;
      }
      const range = karaokeMakerTimedLineRange(auditionLine);
      if (!range) {
        return;
      }
      event.preventDefault();
      cancelAudibleInteractions();
      onSeek(range.startMs);
      Promise.resolve(onPlay()).catch(() => undefined);
      const timerId = window.setInterval(() => {
        const audition = sentenceAuditionRef.current;
        if (!audition) {
          return;
        }
        const currentMs = readPlayheadMs?.() ?? playheadMsRef.current;
        if (currentMs >= audition.endMs || currentMs < audition.startMs) {
          onSeek(audition.startMs);
          Promise.resolve(onPlay()).catch(() => undefined);
        }
      }, 25);
      sentenceAuditionRef.current = {
        startMs: range.startMs,
        endMs: range.endMs,
        timerId,
      };
    };
    const stopSentenceAuditionOnControlUp = (event: KeyboardEvent) => {
      if (
        event.code === 'ControlLeft' ||
        event.code === 'ControlRight' ||
        event.key === 'Control'
      ) {
        stopSentenceAudition();
      }
    };
    window.addEventListener('keydown', startSentenceAudition, true);
    window.addEventListener('keyup', stopSentenceAuditionOnControlUp, true);
    window.addEventListener('blur', stopSentenceAudition);
    return () => {
      window.removeEventListener('keydown', startSentenceAudition, true);
      window.removeEventListener(
        'keyup',
        stopSentenceAuditionOnControlUp,
        true,
      );
      window.removeEventListener('blur', stopSentenceAudition);
      stopSentenceAudition();
    };
  }, [
    playheadMsRef,
    sentenceAuditionRef,
    cancelAudibleInteractions,
    lineEntryMode,
    onPause,
    onPlay,
    onSeek,
    projectRef,
    readPlayheadMs,
    selection,
  ]);
};
