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
} from 'react';
import { TWhenPlayheadReaches, whenMediaReaches } from './karaokeMediaCue';
import { type IKaraokeAudioClock } from './karaokeAudioClock';
import { type ISentenceAuditionState } from './useMakerKeyboard';
import { type IMakerCanvasGesture } from './useMakerCanvasGesture';

interface IMakerAuditionsInput {
  audioRef: RefObject<HTMLMediaElement | null>;
  audioClock: IKaraokeAudioClock;
  gesture: IMakerCanvasGesture;
  sentenceAuditionRef: RefObject<ISentenceAuditionState | undefined>;
  wordAuditionRef: RefObject<(() => void) | undefined>;
  setScrubAuditionAnchorMs: Dispatch<SetStateAction<number | undefined>>;
  setIsCanvasScrubbing: Dispatch<SetStateAction<boolean>>;
  onPause: () => void;
  onSeek: (timeMs: number) => void;
}

/**
 * How the editor's auditions end: each is told when its stretch has been
 * heard on the song's own clock, and one call silences every audition in
 * flight — a scrub grain, a sentence, a word, a dragged note — and puts
 * the playhead back where the audition began.
 */
const useMakerAuditions = ({
  audioRef,
  audioClock,
  gesture,
  sentenceAuditionRef,
  wordAuditionRef,
  setScrubAuditionAnchorMs,
  setIsCanvasScrubbing,
  onPause,
  onSeek,
}: IMakerAuditionsInput) => {
  // How every audition knows its stretch has been heard: the song's own
  // element, timed on the sound card's clock (`karaokeMediaCue`).
  const whenPlayheadReaches = useCallback<TWhenPlayheadReaches>(
    (endMs, onReached) => {
      const media = audioRef.current;
      return media
        ? whenMediaReaches(audioClock, media, endMs, onReached)
        : () => undefined;
    },
    [audioClock, audioRef],
  );

  const cancelAudibleInteractions = useCallback(
    (pause = true) => {
      const scrub = gesture.scrub.current;
      const sentenceAudition = sentenceAuditionRef.current;
      scrub?.cancelGrain?.();
      sentenceAudition?.cancel();
      wordAuditionRef.current?.();
      const drag = gesture.drag.current;
      drag?.cancelAudition?.();
      const hadAudibleInteraction =
        scrub?.auditionWordGrain === true ||
        sentenceAudition !== undefined ||
        drag?.auditionStarted === true ||
        wordAuditionRef.current !== undefined;
      wordAuditionRef.current = undefined;
      gesture.scrub.current = undefined;
      sentenceAuditionRef.current = undefined;
      setScrubAuditionAnchorMs(undefined);
      if (drag) {
        drag.cancelAudition = undefined;
        drag.auditionStarted = false;
      }
      setIsCanvasScrubbing(false);
      if (pause && hadAudibleInteraction) {
        onPause();
        if (sentenceAudition) {
          onSeek(sentenceAudition.startMs);
        } else if (drag?.audioAnchorMs !== undefined) {
          onSeek(drag.audioAnchorMs);
        } else if (scrub) {
          onSeek(scrub.anchorMs);
        }
      }
    },
    [
      gesture.drag,
      gesture.scrub,
      onPause,
      onSeek,
      sentenceAuditionRef,
      setIsCanvasScrubbing,
      setScrubAuditionAnchorMs,
      wordAuditionRef,
    ],
  );

  return { whenPlayheadReaches, cancelAudibleInteractions };
};

export default useMakerAuditions;
