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

import { useEffect, useRef, useState } from 'react';
import { getStreakJoy } from 'common/rhythmGame';
import { useLiveAudioFrame } from '../audio/LiveAudioContext';
import { useRhythmRun } from '../utils/rhythmRun';
import '../styles/Euphoria.scss';

/** At x10 the whole application celebrates. Below it, nothing happens. */
const EUPHORIA_AT = 1;

/**
 * The audio half, and it only exists while the mode is running.
 *
 * Split out for one reason: subscribing to the live frame re-renders the
 * subscriber about twenty times a second, forever. Kept in the component below
 * — which is mounted for the whole life of the app — that would have been a
 * constant twenty-two renders a second of the application shell whether anyone
 * was playing or not, and this app should cost nothing when nothing is
 * happening. Mounting it only at the ceiling means the subscription exists
 * exactly as long as something is using it.
 */
const EuphoriaLevel = () => {
  const { waveform } = useLiveAudioFrame();
  const levelRef = useRef(0);

  useEffect(() => {
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
    // Written straight to the property rather than held in state: this runs
    // about twenty times a second, and re-rendering anything at that rate to
    // animate a glow would cost more than the glow is worth.
    document.documentElement.style.setProperty(
      '--euphoria-level',
      levelRef.current.toFixed(3),
    );
  }, [waveform]);

  useEffect(
    () => () => {
      document.documentElement.style.removeProperty('--euphoria-level');
    },
    [],
  );

  return null;
};

const EuphoriaGlow = () => {
  // Only the run. This re-renders when the streak changes and at no other time,
  // which for most of the app's life is never.
  const joy = getStreakJoy(useRhythmRun().streak);
  const isEuphoric = joy >= EUPHORIA_AT;
  // Counted rather than a boolean, so a second arrival fires a second burst.
  // Re-applying a class an element already has does nothing at all.
  const [burst, setBurst] = useState(0);
  const wasEuphoricRef = useRef(false);

  // On the way IN only. Thirty-six perfect taps deserve a bang; the way out is
  // a mistake, and nobody wants confetti for that.
  useEffect(() => {
    if (isEuphoric && !wasEuphoricRef.current) {
      setBurst((count) => count + 1);
    }
    wasEuphoricRef.current = isEuphoric;
  }, [isEuphoric]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--pet-joy', String(joy));
    root.classList.toggle('is-euphoric', joy >= EUPHORIA_AT);
  }, [joy]);

  useEffect(
    () => () => {
      const root = document.documentElement;
      root.classList.remove('is-euphoric');
      root.style.removeProperty('--pet-joy');
    },
    [],
  );

  return (
    <>
      {isEuphoric && <EuphoriaLevel />}
      {/* Keyed on the count so each arrival mounts a fresh element and restarts
          the animation. It removes itself when the animation finishes rather
          than lingering as a permanent invisible overlay. */}
      {burst > 0 && (
        <span
          key={burst}
          className="euphoria-burst"
          onAnimationEnd={() => setBurst(0)}
        />
      )}
    </>
  );
};

export default EuphoriaGlow;
