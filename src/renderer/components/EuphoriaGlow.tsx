/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import { useEffect, useRef } from 'react';
import { getStreakJoy } from 'common/rhythmGame';
import { useLiveAudioFrame } from '../audio/LiveAudioContext';
import { useRhythmRun } from '../utils/rhythmRun';
import '../styles/Euphoria.scss';

/** At x10 the whole application celebrates. Below it, nothing happens. */
const EUPHORIA_AT = 1;

/**
 * Puts the streak on the document root, where the rest of the interface can
 * see it.
 *
 * Mounted by the shell rather than by the support dialog, and reading the run
 * from the store rather than from a prop. The dialog is a modal that can be
 * closed and reopened, and a run at the ceiling has to keep glowing while it
 * is shut — a player who closes the panel has not stopped playing, they have
 * put the panel away.
 *
 * Renders nothing. It owns two custom properties and a class, so that the EQ,
 * the graph, the titlebar and the creature all light up from one number rather
 * than from copies that could drift.
 */
const EuphoriaGlow = () => {
  const run = useRhythmRun();
  const joy = getStreakJoy(run.streak);
  const { waveform } = useLiveAudioFrame();
  const levelRef = useRef(0);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--pet-joy', String(joy));
    root.classList.toggle('is-euphoric', joy >= EUPHORIA_AT);
  }, [joy]);

  // The audio, written straight to the property rather than held in state.
  // This runs about twenty times a second, and re-rendering the application
  // that often to animate a glow would cost more than the glow is worth.
  useEffect(() => {
    if (joy < EUPHORIA_AT) {
      return;
    }
    let peak = 0;
    for (let index = 0; index < waveform.length; index += 1) {
      if (waveform[index] > peak) {
        peak = waveform[index];
      }
    }
    const level = Math.min(1, peak * 1.6);
    // Slow release, so the shell swells with the music instead of flickering
    // between every transient.
    levelRef.current =
      level > levelRef.current
        ? level
        : levelRef.current + (level - levelRef.current) * 0.2;
    document.documentElement.style.setProperty(
      '--euphoria-level',
      levelRef.current.toFixed(3),
    );
  }, [joy, waveform]);

  useEffect(
    () => () => {
      const root = document.documentElement;
      root.classList.remove('is-euphoric');
      root.style.removeProperty('--pet-joy');
      root.style.removeProperty('--euphoria-level');
    },
    [],
  );

  return null;
};

export default EuphoriaGlow;
