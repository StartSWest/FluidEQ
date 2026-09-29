/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
} from 'react';
import {
  type IKaraokeMakerProject,
  karaokeMakerLineIsSection,
  karaokeMakerRecordedLineRange,
} from '../../common/karaoke/makerProject';
import {
  type IGuidedLineCapture,
  type TLineEntrySession,
} from './useMakerLineCapture';
import { type IKaraokeAudioClock } from './karaokeAudioClock';
import { type TSelection } from './useKaraokeMakerSelection';

interface IMakerLineEntryCountdownInput {
  cancelLineEntryCountdownRef: RefObject<(() => void) | undefined>;
  setLineEntryCountdown: Dispatch<SetStateAction<string | undefined>>;
  cancelAudibleInteractions: (pause?: boolean) => void;
  isPlaying: boolean;
  onPause: () => void;
  projectRef: RefObject<IKaraokeMakerProject>;
  onSeek: (timeMs: number) => void;
  setViewStartMs: Dispatch<SetStateAction<number>>;
  lineEntryIndexRef: RefObject<number>;
  setLineEntryIndex: Dispatch<SetStateAction<number>>;
  setSelection: Dispatch<SetStateAction<TSelection>>;
  setLyricFollowRequestKey: Dispatch<SetStateAction<number>>;
  setLineEntryCapture: Dispatch<SetStateAction<IGuidedLineCapture | undefined>>;
  setLineEntrySession: Dispatch<SetStateAction<TLineEntrySession>>;
  audioClock: IKaraokeAudioClock;
  onPlay: () => Promise<void> | void;
  lineEntryMode: boolean;
}

/**
 * The count-in before recording lines: 1, 2, 3, GO on the sound card's
 * clock, the song starting on GO, from the top when nothing has been
 * recorded yet. Leaving recording, or the editor, cancels a count in
 * progress.
 */
const useMakerLineEntryCountdown = ({
  cancelLineEntryCountdownRef,
  setLineEntryCountdown,
  cancelAudibleInteractions,
  isPlaying,
  onPause,
  projectRef,
  onSeek,
  setViewStartMs,
  lineEntryIndexRef,
  setLineEntryIndex,
  setSelection,
  setLyricFollowRequestKey,
  setLineEntryCapture,
  setLineEntrySession,
  audioClock,
  onPlay,
  lineEntryMode,
}: IMakerLineEntryCountdownInput) => {
  const clearLineEntryCountdown = useCallback(() => {
    cancelLineEntryCountdownRef.current?.();
    cancelLineEntryCountdownRef.current = undefined;
    setLineEntryCountdown(undefined);
  }, [cancelLineEntryCountdownRef, setLineEntryCountdown]);

  const startLineEntryCountdown = useCallback(() => {
    clearLineEntryCountdown();
    cancelAudibleInteractions(false);
    if (isPlaying) {
      onPause();
    }
    const contentLines = projectRef.current.lyrics.lines.filter(
      (line) => !karaokeMakerLineIsSection(line) && line.tokens.length > 0,
    );
    const hasRecordedMarks = contentLines.some(
      (line) => karaokeMakerRecordedLineRange(line) !== undefined,
    );
    if (!hasRecordedMarks) {
      const firstLine = contentLines[0];
      onSeek(0);
      setViewStartMs(0);
      lineEntryIndexRef.current = 0;
      setLineEntryIndex(0);
      if (firstLine) {
        setSelection({ kind: 'word', id: firstLine.tokens[0].id });
      }
      setLyricFollowRequestKey((key) => key + 1);
    }
    setLineEntryCapture(undefined);
    setLineEntrySession('countdown');
    setLineEntryCountdown('1');
    // On the sound card's clock, every beat a time past one origin: the
    // song starts on "GO", and whoever is about to press Enter on the first
    // word is counting towards it. Timers put each beat wherever the thread
    // happened to be free; see `karaokeAudioClock`.
    cancelLineEntryCountdownRef.current = audioClock.schedule(() => [
      { atSeconds: 0.65, run: () => setLineEntryCountdown('2') },
      { atSeconds: 1.3, run: () => setLineEntryCountdown('3') },
      {
        atSeconds: 1.95,
        run: () => {
          setLineEntryCountdown('GO');
          setLineEntrySession('active');
          Promise.resolve(onPlay()).catch(() => undefined);
        },
      },
      {
        atSeconds: 2.5,
        run: () => {
          cancelLineEntryCountdownRef.current = undefined;
          setLineEntryCountdown(undefined);
        },
      },
    ]);
  }, [
    clearLineEntryCountdown,
    cancelAudibleInteractions,
    isPlaying,
    projectRef,
    setLineEntryCapture,
    setLineEntrySession,
    setLineEntryCountdown,
    cancelLineEntryCountdownRef,
    audioClock,
    onPause,
    onSeek,
    setViewStartMs,
    lineEntryIndexRef,
    setLineEntryIndex,
    setLyricFollowRequestKey,
    setSelection,
    onPlay,
  ]);

  useEffect(
    () => () => cancelLineEntryCountdownRef.current?.(),
    [cancelLineEntryCountdownRef],
  );

  useEffect(() => {
    if (lineEntryMode) {
      return;
    }
    clearLineEntryCountdown();
    setLineEntrySession('setup');
  }, [clearLineEntryCountdown, lineEntryMode, setLineEntrySession]);

  return { clearLineEntryCountdown, startLineEntryCountdown };
};

export default useMakerLineEntryCountdown;
