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

import { useCallback, useEffect, useRef, useState } from 'react';
import { midiToFrequency } from '../../common/karaoke/pitch';
import { IKaraokeToken, TKaraokePitchTarget } from '../../common/karaoke/types';

const MELODY_TONE_VOLUME_KEY = 'fluideq.karaoke.melody-tone-volume';
const DEFAULT_MELODY_TONE_VOLUME = 0.34;
const MAXIMUM_MELODY_TONE_GAIN = 0.18;
const MELODY_TONE_ATTACK_SECONDS = 0.012;
const MELODY_TONE_RELEASE_SECONDS = 0.018;

interface IKaraokeMelodyToneGraph {
  context: AudioContext;
  fundamental: OscillatorNode;
  overtone: OscillatorNode;
  fundamentalGain: GainNode;
  overtoneGain: GainNode;
  outputGain: GainNode;
  currentMidi?: number;
  resumePending?: Promise<void>;
}

interface IUseKaraokeMelodyToneOptions {
  isActive: boolean;
  isPlaying: boolean;
  target?: TKaraokePitchTarget;
  playheadMs: number;
  readPlayheadMs?: () => number;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const readMelodyToneVolume = (): number => {
  try {
    const stored = window.localStorage.getItem(MELODY_TONE_VOLUME_KEY);
    if (stored === null) {
      return DEFAULT_MELODY_TONE_VOLUME;
    }
    const value = Number(stored);
    return Number.isFinite(value)
      ? clamp(value, 0, 1)
      : DEFAULT_MELODY_TONE_VOLUME;
  } catch {
    return DEFAULT_MELODY_TONE_VOLUME;
  }
};

const audioContextConstructor = () =>
  window.AudioContext ??
  (
    window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }
  ).webkitAudioContext;

const isTimedToneNote = (
  note: IKaraokeToken,
): note is IKaraokeToken & {
  startMs: number;
  endMs: number;
  targetMidi: number;
} =>
  note.startMs !== undefined &&
  note.endMs !== undefined &&
  note.targetMidi !== undefined &&
  Number.isFinite(note.targetMidi);

/**
 * Return the canonical melody pitch for this instant. Import adapters already
 * normalize every provider to MIDI semitones, so the tone engine never needs
 * provider-specific branches.
 */
export const karaokeMelodyToneMidiAtTime = (
  notes: readonly IKaraokeToken[],
  timeMs: number,
): number | undefined => {
  let activeMidi: number | undefined;
  notes.forEach((note) => {
    if (
      isTimedToneNote(note) &&
      note.startMs <= timeMs &&
      note.endMs >= timeMs
    ) {
      // At a shared boundary, the later note wins instead of holding the note
      // that has just ended for one visual/audio frame.
      activeMidi = note.targetMidi;
    }
  });
  return activeMidi;
};

export const karaokeMelodyToneFrequencyAtTime = (
  notes: readonly IKaraokeToken[],
  timeMs: number,
): number | undefined => {
  const midi = karaokeMelodyToneMidiAtTime(notes, timeMs);
  return midi === undefined ? undefined : midiToFrequency(midi);
};

const silenceGraph = (graph: IKaraokeMelodyToneGraph) => {
  const now = graph.context.currentTime;
  graph.outputGain.gain.cancelScheduledValues(now);
  graph.outputGain.gain.setTargetAtTime(0, now, MELODY_TONE_RELEASE_SECONDS);
  graph.currentMidi = undefined;
};

const createToneGraph = (
  Context: typeof AudioContext,
): IKaraokeMelodyToneGraph => {
  const context = new Context({ latencyHint: 'interactive' });
  const fundamental = context.createOscillator();
  const overtone = context.createOscillator();
  const fundamentalGain = context.createGain();
  const overtoneGain = context.createGain();
  const outputGain = context.createGain();

  fundamental.type = 'triangle';
  overtone.type = 'sine';
  fundamentalGain.gain.value = 0.82;
  overtoneGain.gain.value = 0.16;
  outputGain.gain.value = 0;
  fundamental.connect(fundamentalGain);
  overtone.connect(overtoneGain);
  fundamentalGain.connect(outputGain);
  overtoneGain.connect(outputGain);
  outputGain.connect(context.destination);
  fundamental.start();
  overtone.start();

  return {
    context,
    fundamental,
    overtone,
    fundamentalGain,
    overtoneGain,
    outputGain,
  };
};

/** A local Web Audio lead-melody cue. It never records or uploads audio. */
export const useKaraokeMelodyTone = ({
  isActive,
  isPlaying,
  target,
  playheadMs,
  readPlayheadMs,
}: IUseKaraokeMelodyToneOptions) => {
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolumeState] = useState(readMelodyToneVolume);
  const [isAvailable, setIsAvailable] = useState(() =>
    Boolean(audioContextConstructor()),
  );
  const enabledRef = useRef(enabled);
  const volumeRef = useRef(volume);
  const graphRef = useRef<IKaraokeMelodyToneGraph | undefined>(undefined);
  const isForegroundRef = useRef(true);
  const runtimeRef = useRef({
    isActive,
    isPlaying,
    target,
    playheadMs,
    readPlayheadMs,
  });
  enabledRef.current = enabled;
  volumeRef.current = volume;
  runtimeRef.current = {
    isActive,
    isPlaying,
    target,
    playheadMs,
    readPlayheadMs,
  };

  const ensureGraph = useCallback(() => {
    const existing = graphRef.current;
    if (existing && existing.context.state !== 'closed') {
      return existing;
    }
    const Context = audioContextConstructor();
    if (!Context) {
      setIsAvailable(false);
      return undefined;
    }
    try {
      const graph = createToneGraph(Context);
      graphRef.current = graph;
      setIsAvailable(true);
      return graph;
    } catch {
      setIsAvailable(false);
      return undefined;
    }
  }, []);

  const resumeGraph = useCallback((graph: IKaraokeMelodyToneGraph) => {
    if (graph.context.state !== 'suspended' || graph.resumePending) {
      return;
    }
    try {
      const pending = graph.context.resume();
      graph.resumePending = pending;
      pending
        .catch(() => {
          setIsAvailable(false);
          silenceGraph(graph);
        })
        .finally(() => {
          if (graph.resumePending === pending) {
            graph.resumePending = undefined;
          }
        });
    } catch {
      setIsAvailable(false);
      silenceGraph(graph);
    }
  }, []);

  const toggle = useCallback(async () => {
    if (enabledRef.current) {
      enabledRef.current = false;
      setEnabled(false);
      if (graphRef.current) {
        silenceGraph(graphRef.current);
      }
      return;
    }

    const graph = ensureGraph();
    if (!graph) {
      return;
    }
    try {
      if (graph.context.state === 'suspended') {
        await graph.context.resume();
      }
      enabledRef.current = true;
      setEnabled(true);
    } catch {
      setIsAvailable(false);
      silenceGraph(graph);
    }
  }, [ensureGraph]);

  const setVolume = useCallback((nextVolume: number) => {
    const normalized = clamp(nextVolume, 0, 1);
    volumeRef.current = normalized;
    setVolumeState(normalized);
    try {
      window.localStorage.setItem(MELODY_TONE_VOLUME_KEY, String(normalized));
    } catch {
      // Keep the live control working when persistence is unavailable.
    }
  }, []);

  // A guide is allowed to accompany music; it is never allowed to become a
  // standalone oscillator. Pause/loading/end silence it synchronously, and a
  // newly loaded target explicitly wakes a context Chromium may have suspended
  // while the media element was changing songs.
  useEffect(() => {
    const graph = graphRef.current;
    const hasNotes = target?.kind === 'notes' && target.notes.length > 0;
    if (!enabled || !isActive || !isPlaying || !hasNotes) {
      if (graph) {
        silenceGraph(graph);
      }
      return;
    }
    if (isForegroundRef.current && graph) {
      resumeGraph(graph);
    }
  }, [enabled, isActive, isPlaying, resumeGraph, target]);

  // Electron may keep Web Audio alive while its window is minimized or behind
  // another app. The backing song may continue according to the user's media
  // choice, but the synthetic guide must not leak from a background window.
  // Focus restores it only when the song is still genuinely playing.
  useEffect(() => {
    const setForeground = (next: boolean) => {
      isForegroundRef.current = next;
      const graph = graphRef.current;
      if (!next) {
        if (graph) {
          silenceGraph(graph);
        }
        return;
      }
      const runtime = runtimeRef.current;
      if (
        enabledRef.current &&
        runtime.isActive &&
        runtime.isPlaying &&
        runtime.target?.kind === 'notes' &&
        graph
      ) {
        resumeGraph(graph);
      }
    };
    const onVisibilityChange = () => setForeground(!document.hidden);
    const onBlur = () => setForeground(false);
    const onFocus = () => setForeground(!document.hidden);
    isForegroundRef.current = !document.hidden;
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [resumeGraph]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let animationFrame = 0;
    const updateTone = () => {
      const graph = graphRef.current;
      const runtime = runtimeRef.current;
      const notes =
        runtime.target?.kind === 'notes' ? runtime.target.notes : undefined;
      const songTimeMs = runtime.readPlayheadMs?.() ?? runtime.playheadMs;
      const midi =
        graph &&
        isForegroundRef.current &&
        runtime.isActive &&
        runtime.isPlaying &&
        notes
          ? karaokeMelodyToneMidiAtTime(notes, songTimeMs)
          : undefined;

      if (graph) {
        const now = graph.context.currentTime;
        if (midi === undefined) {
          if (graph.currentMidi !== undefined) {
            silenceGraph(graph);
          }
        } else {
          resumeGraph(graph);
          const frequency = midiToFrequency(midi);
          if (graph.currentMidi !== midi) {
            graph.fundamental.frequency.setTargetAtTime(
              frequency,
              now,
              MELODY_TONE_ATTACK_SECONDS,
            );
            graph.overtone.frequency.setTargetAtTime(
              frequency * 2,
              now,
              MELODY_TONE_ATTACK_SECONDS,
            );
            graph.currentMidi = midi;
          }
          graph.outputGain.gain.setTargetAtTime(
            volumeRef.current * MAXIMUM_MELODY_TONE_GAIN,
            now,
            MELODY_TONE_ATTACK_SECONDS,
          );
        }
      }
      animationFrame = window.requestAnimationFrame(updateTone);
    };
    animationFrame = window.requestAnimationFrame(updateTone);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      if (graphRef.current) {
        silenceGraph(graphRef.current);
      }
    };
  }, [enabled, resumeGraph]);

  useEffect(
    () => () => {
      const graph = graphRef.current;
      graphRef.current = undefined;
      if (!graph) {
        return;
      }
      silenceGraph(graph);
      graph.fundamental.stop();
      graph.overtone.stop();
      graph.context.close().catch(() => undefined);
    },
    [],
  );

  return {
    enabled,
    isAvailable,
    volume,
    toggle,
    setVolume,
  };
};
