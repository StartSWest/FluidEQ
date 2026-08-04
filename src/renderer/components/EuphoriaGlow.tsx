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
import { useLiveAudioFrame } from '../audio/LiveAudioContext';
import '../styles/Euphoria.scss';

/** At x10 the whole application celebrates. Below it, nothing happens. */
const EUPHORIA_AT = 1;

/**
 * Puts the streak on the document root, where the rest of the interface can
 * see it.
 *
 * The support dialog is a modal, but the streak is meant to reach the EQ, the
 * graph and the titlebar behind it — so the value cannot live on the dialog. It
 * goes on `documentElement` as a custom property and everything inherits it,
 * which also means the titlebar creature lights up from the same number as the
 * one in the dialog rather than from a second copy.
 *
 * Renders nothing. It exists to own two variables and a class, and it cleans
 * both up when the dialog closes, because a game that has ended must not leave
 * the application glowing.
 */
const EuphoriaGlow = ({ joy }: { joy: number }) => {
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
