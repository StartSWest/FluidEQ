/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject } from 'react';
import { IKaraokeMakerProject } from '../../common/karaoke/makerProject';
import { IKaraokeSong } from '../../common/karaoke/types';
import { IKaraokeAudioClock } from './karaokeAudioClock';
import useKaraokeMakerEditor from './useKaraokeMakerEditor';
import useKaraokeMakerTools from './useKaraokeMakerTools';
import KaraokeMakerView from './KaraokeMakerView';

export interface IKaraokeMakerProps {
  song: IKaraokeSong;
  audioFile: File;
  playheadMs: number;
  durationMs: number;
  isPlaying: boolean;
  restoreSavedDraft: boolean;
  readPlayheadMs?: () => number;
  /**
   * The element the song plays in, and the sound card's clock: what the
   * countdown and every audition are timed against. The workspace's own, so
   * the count-in and the Maker share one clock rather than open two.
   */
  audioRef: RefObject<HTMLMediaElement | null>;
  audioClock: IKaraokeAudioClock;
  /**
   * The player's guide-vocal level, passed down rather than duplicated.
   *
   * The Maker previews through the same audio element the player uses, so a
   * second level here would be a slider that moved nothing. One value, two
   * places to reach it.
   */
  vocalLevel?: number;
  onVocalLevel?: (level: number) => void;
  /** The backing track's own level, master times this. */
  stemFocus?: 'backing' | 'voice';
  onFocusStem?: (row: 'backing' | 'voice') => void;
  backingBlend?: number;
  onBackingBlend?: (blend: number) => void;
  /** Receives both stems when a split succeeds, so the player can use them. */
  onStems?: (stems: { vocals: File; instrumental: File }) => void;
  onSeek: (timeMs: number) => void;
  onPlay: () => Promise<void> | void;
  onPause: () => void;
  onApply: (project: IKaraokeMakerProject) => void;
  onClose: () => void;
  /**
   * Told whenever a local model starts or stops running here.
   *
   * The workspace owns the other doors out of this editor — importing a song
   * from the Library tab closes the Maker — and it cannot see this hook state
   * from outside. One answer, reported up, rather than two guesses.
   */
  onModelWorkChange: (working: boolean) => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
}

const KaraokeMaker = ({
  song,
  audioFile,
  playheadMs,
  durationMs,
  isPlaying,
  restoreSavedDraft,
  readPlayheadMs,
  audioRef,
  audioClock,
  vocalLevel,
  onVocalLevel,
  onStems,
  stemFocus,
  onFocusStem,
  backingBlend,
  onBackingBlend,
  onSeek,
  onPlay,
  onPause,
  onApply,
  onClose,
  onModelWorkChange,
  isFullScreen,
  onToggleFullScreen,
}: IKaraokeMakerProps) => {
  // The editing surface's hooks, then the tools', in the order they have
  // always run; the markup reads both and holds nothing of its own.
  const editor = useKaraokeMakerEditor({
    audioClock,
    audioFile,
    audioRef,
    durationMs,
    isPlaying,
    onPause,
    onPlay,
    onSeek,
    playheadMs,
    readPlayheadMs,
    restoreSavedDraft,
    song,
  });
  const tools = useKaraokeMakerTools(editor, {
    audioFile,
    isPlaying,
    onModelWorkChange,
    onPause,
    onPlay,
    onSeek,
    onStems,
    playheadMs,
    readPlayheadMs,
    song,
  });
  return (
    <KaraokeMakerView
      editor={editor}
      tools={tools}
      audioFile={audioFile}
      backingBlend={backingBlend}
      isFullScreen={isFullScreen}
      isPlaying={isPlaying}
      onApply={onApply}
      onBackingBlend={onBackingBlend}
      onClose={onClose}
      onFocusStem={onFocusStem}
      onPause={onPause}
      onPlay={onPlay}
      onSeek={onSeek}
      onToggleFullScreen={onToggleFullScreen}
      onVocalLevel={onVocalLevel}
      playheadMs={playheadMs}
      stemFocus={stemFocus}
      vocalLevel={vocalLevel}
    />
  );
};

export default KaraokeMaker;
