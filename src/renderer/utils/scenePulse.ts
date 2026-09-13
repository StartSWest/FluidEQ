/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The beats of the scene on screen, for the window to glow along with
 * (`ScenePulse.tsx`).
 *
 * The scene's own frames report here — the graph's and the Studio stage's,
 * from the frame they have just drawn — so the window moves on exactly the
 * beats the picture is reacting to, and only while a picture is being drawn:
 * a graph on another tab, a hidden window, a paused song all draw nothing and
 * send nothing.
 *
 * Beats are told apart by the beat itself rather than by time: the detector's
 * value jumps to 1 on a beat and falls away over its flash, so a beat counts
 * as it crosses `ONSET` and the next can only count once it has fallen below
 * `REARM`. Nothing counts milliseconds, and a song with no beats sends nothing
 * at all.
 *
 * The window answers one beat in `BEATS_PER_PULSE`, not every one. Every beat
 * was too much to live with — at 120 BPM the whole window throbbed twice a
 * second — and one in four is about once a bar, which reads as the room
 * breathing with the song rather than flickering to it.
 */

export type TScenePulseSource = 'graph' | 'studio';

/** Which part of the music carried the beat, and so which colour answers it. */
export type TScenePulseVoice = 'bass' | 'mid' | 'treble';

export interface IScenePulse {
  source: TScenePulseSource;
  /** How hard, 0.35 to 1: a quiet passage glows faintly. */
  strength: number;
  voice: TScenePulseVoice;
  /**
   * Where on the screen the scene drawing it stands, measured once per pulse
   * rather than per frame; absent when it has no size.
   */
  origin: DOMRect | undefined;
}

export type TScenePulseListener = (pulse: IScenePulse) => void;

/** What the pulse needs from a drawn frame. */
export interface IScenePulseFrame {
  beat: number;
  level: number;
  bands: readonly [number, number, number];
}

const ONSET = 0.9;
const REARM = 0.25;
export const BEATS_PER_PULSE = 4;
/**
 * The music's level where a pulse reaches full strength. The eased level of
 * ordinary loud music sits around 0.2 to 0.45 (measured for the Studio's
 * scenes); a quiet passage's beats glow faintly rather than as hard.
 */
const FULL_LEVEL = 0.42;
const VOICES: readonly TScenePulseVoice[] = ['bass', 'mid', 'treble'];

const armed: Record<TScenePulseSource, boolean> = { graph: true, studio: true };
/** Beats counted since the last pulse; the first beat heard pulses. */
const counted: Record<TScenePulseSource, number> = { graph: 0, studio: 0 };
const listeners = new Set<TScenePulseListener>();

/** The band that is loudest on the beat; the bass when they tie. */
const voiceOf = (bands: readonly [number, number, number]) =>
  VOICES[bands.indexOf(Math.max(...bands))] ?? 'bass';

/**
 * From a scene's drawn frame, as the scene got it, and the element it draws
 * in.
 */
export const reportSceneBeat = (
  source: TScenePulseSource,
  frame: IScenePulseFrame,
  scene: Element | null | undefined,
) => {
  if (armed[source] && frame.beat >= ONSET) {
    armed[source] = false;
    const pulses = counted[source] === 0;
    counted[source] = (counted[source] + 1) % BEATS_PER_PULSE;
    if (pulses && listeners.size > 0) {
      const box = scene?.getBoundingClientRect();
      const pulse: IScenePulse = {
        source,
        strength: Math.min(1, Math.max(0.35, frame.level / FULL_LEVEL)),
        voice: voiceOf(frame.bands),
        origin: box && box.width > 0 ? box : undefined,
      };
      listeners.forEach((listener) => listener(pulse));
    }
  } else if (!armed[source] && frame.beat <= REARM) {
    armed[source] = true;
  }
};

export const subscribeScenePulse = (listener: TScenePulseListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** For tests: a clean module between runs. */
export const resetScenePulse = () => {
  listeners.clear();
  armed.graph = true;
  armed.studio = true;
  counted.graph = 0;
  counted.studio = 0;
};
