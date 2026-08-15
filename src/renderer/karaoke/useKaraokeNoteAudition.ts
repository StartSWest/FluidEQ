/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef } from 'react';
import { midiToFrequency } from '../../common/karaoke/pitch';

interface IKaraokeNoteAuditionVoice {
  fundamental: OscillatorNode;
  overtone: OscillatorNode;
  output: GainNode;
}

const audioContextConstructor = () =>
  window.AudioContext ??
  (
    window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }
  ).webkitAudioContext;

/**
 * A local reference tone for editing melody notes. A held note may use its
 * complete authored duration; re-triggering still releases the old voice
 * first, so vertical dragging sounds like one changing guide instead of a
 * pile of overlapping tones.
 */
const useKaraokeNoteAudition = () => {
  const contextRef = useRef<AudioContext | undefined>(undefined);
  const voiceRef = useRef<IKaraokeNoteAuditionVoice | undefined>(undefined);

  const stop = useCallback((releaseSeconds = 0.018) => {
    const context = contextRef.current;
    const voice = voiceRef.current;
    if (!context || !voice) {
      return;
    }
    voiceRef.current = undefined;
    const now = context.currentTime;
    const release = Math.max(0.001, releaseSeconds);
    voice.output.gain.cancelScheduledValues(now);
    voice.output.gain.setTargetAtTime(0, now, release);
    const stopAt = now + release * 5;
    try {
      voice.fundamental.stop(stopAt);
      voice.overtone.stop(stopAt);
    } catch {
      // The scheduled voice may already have ended.
    }
  }, []);

  const play = useCallback(
    (midi: number, durationMs = 420) => {
      if (!Number.isFinite(midi)) {
        return;
      }
      const Context = audioContextConstructor();
      if (!Context) {
        return;
      }
      let context = contextRef.current;
      if (!context || context.state === 'closed') {
        context = new Context({ latencyHint: 'interactive' });
        contextRef.current = context;
      }
      context.resume().catch(() => undefined);
      stop(0.009);

      const fundamental = context.createOscillator();
      const overtone = context.createOscillator();
      const fundamentalGain = context.createGain();
      const overtoneGain = context.createGain();
      const output = context.createGain();
      const frequency = midiToFrequency(midi);
      const now = context.currentTime;
      const authoredDurationMs = Number.isFinite(durationMs)
        ? Math.max(36, durationMs)
        : 420;
      const end = now + authoredDurationMs / 1_000;

      fundamental.type = 'triangle';
      overtone.type = 'sine';
      fundamental.frequency.setValueAtTime(frequency, now);
      overtone.frequency.setValueAtTime(frequency * 2, now);
      fundamentalGain.gain.value = 0.82;
      overtoneGain.gain.value = 0.12;
      output.gain.setValueAtTime(0.0001, now);
      output.gain.exponentialRampToValueAtTime(0.13, now + 0.012);
      output.gain.setValueAtTime(0.13, Math.max(now + 0.013, end - 0.055));
      output.gain.exponentialRampToValueAtTime(0.0001, end);

      fundamental.connect(fundamentalGain);
      overtone.connect(overtoneGain);
      fundamentalGain.connect(output);
      overtoneGain.connect(output);
      output.connect(context.destination);
      voiceRef.current = { fundamental, overtone, output };
      fundamental.start(now);
      overtone.start(now);
      fundamental.stop(end + 0.02);
      overtone.stop(end + 0.02);
      fundamental.onended = () => {
        fundamental.disconnect();
        overtone.disconnect();
        fundamentalGain.disconnect();
        overtoneGain.disconnect();
        output.disconnect();
        if (voiceRef.current?.fundamental === fundamental) {
          voiceRef.current = undefined;
        }
      };
    },
    [stop],
  );

  useEffect(
    () => () => {
      stop(0);
      contextRef.current?.close().catch(() => undefined);
      contextRef.current = undefined;
    },
    [stop],
  );

  return { play, stop };
};

export default useKaraokeNoteAudition;
