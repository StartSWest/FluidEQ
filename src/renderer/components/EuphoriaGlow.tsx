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
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useRhythmRun } from '../utils/rhythmRun';
import {
  markEuphoriaReached,
  useIsEuphoriaForced,
} from '../utils/euphoriaMode';
import '../styles/Euphoria.scss';

/** At x10 the whole application celebrates. Below it, nothing happens. */
const EUPHORIA_AT = 1;

/**
 * How many values the level is allowed to take.
 *
 * Quantising it is the whole performance trick. Every element reading
 * `--euphoria-level` has its style recalculated when that property changes, and
 * a continuous value changes on literally every frame — up to thirty-one bands,
 * the graph points and the meters, invalidated twenty-two times a second for
 * differences of a thousandth that nobody can see.
 *
 * Rounded to twelve steps it only changes when the music moves enough to be
 * visible, which in practice is a few times a second rather than twenty-two.
 * The motion is very slightly stepped, and that reads as a meter responding
 * rather than as something smoothed — it is not a compromise so much as the
 * more honest look.
 */
const LEVEL_STEPS = 12;

/**
 * Give every band its own level, taken from its own frequency.
 *
 * A single number for the whole window made thirty-one sliders pulse in
 * lockstep, which says nothing about the music — the point of an equaliser is
 * that the bass and the top end are doing different things. Each band reads the
 * spectrum around the frequency it controls instead, so the low sliders move on
 * the kick and the high ones move on the hats.
 *
 * The same quantising applies per band, and it matters more here: each write is
 * a style invalidation on that band's subtree, and with thirty-one of them a
 * continuous value would be thirty-one invalidations every frame. Stepped, only
 * the bands whose own energy actually moved get written.
 */
const publishBandLevels = (
  points: readonly { x: number; y: number }[],
  bands: readonly HTMLElement[],
  published: number[],
) => {
  if (points.length === 0 || bands.length === 0) {
    return;
  }
  // The spectrum runs low to high and so does the slider row, so a band's share
  // of the row is its share of the spectrum. Exact frequencies would be better;
  // this needs no reach into the EQ state and is right to within a slider.
  const perBand = points.length / bands.length;
  for (let index = 0; index < bands.length; index += 1) {
    const from = Math.floor(index * perBand);
    const to = Math.max(from + 1, Math.floor((index + 1) * perBand));
    let peak = -Infinity;
    for (let point = from; point < to; point += 1) {
      if (points[point].y > peak) {
        peak = points[point].y;
      }
    }
    // The curve is plotted in dB against the track's own peak, so the top of
    // the scale is 0 and useful signal lives in the twenty below it.
    const level = Math.max(0, Math.min(1, (peak + 20) / 20));
    const stepped = Math.round(level * LEVEL_STEPS) / LEVEL_STEPS;
    if (stepped !== published[index]) {
      published[index] = stepped;
      bands[index].style.setProperty('--band-level', String(stepped));
    }
  }
};

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
  const { points, waveform } = useLiveAudioFrame();
  // The row is rebuilt when the band count changes and at no other time, so
  // that is what the re-query below keys on. Keying it on the frame would
  // re-query every frame and undo the saving entirely.
  const bandCount = Object.keys(useFluidEqContext().filters).length;
  const levelRef = useRef(0);
  const publishedRef = useRef(-1);
  const bandsRef = useRef<HTMLElement[]>([]);
  const bandLevelsRef = useRef<number[]>([]);

  // Re-read when the band count changes, which is the only time the row is
  // rebuilt. Querying every frame would undo the saving this is here for.
  useEffect(() => {
    const bands = Array.from(
      document.querySelectorAll<HTMLElement>('.bandWrapper'),
    );
    bandsRef.current = bands;
    bandLevelsRef.current = new Array<number>(bands.length).fill(-1);
    return () => {
      bands.forEach((band) => band.style.removeProperty('--band-level'));
    };
  }, [bandCount]);

  useEffect(() => {
    publishBandLevels(points, bandsRef.current, bandLevelsRef.current);
  }, [points]);

  useEffect(() => {
    let peak = 0;
    for (let index = 0; index < waveform.length; index += 1) {
      if (waveform[index] > peak) {
        peak = waveform[index];
      }
    }
    const level = Math.min(1, peak * 1.6);
    // Instant attack, slow release, so the shell swells with the music instead
    // of flickering between every transient.
    levelRef.current =
      level > levelRef.current
        ? level
        : levelRef.current + (level - levelRef.current) * 0.2;

    const stepped = Math.round(levelRef.current * LEVEL_STEPS) / LEVEL_STEPS;
    if (stepped === publishedRef.current) {
      // Nothing visible changed. Writing it anyway would invalidate the style
      // of every element reading it, for no difference on screen — which is
      // the entire cost this is here to avoid.
      return;
    }
    publishedRef.current = stepped;
    // Written straight to the property rather than held in state: re-rendering
    // anything at this rate to animate a glow would cost more than the glow is
    // worth.
    document.documentElement.style.setProperty(
      '--euphoria-level',
      String(stepped),
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
  const earnedJoy = getStreakJoy(useRhythmRun().streak);
  // And the switch, for anyone who has already reached the ceiling once.
  const isForced = useIsEuphoriaForced();
  const isEarned = earnedJoy >= EUPHORIA_AT;
  const isEuphoric = isEarned || isForced;
  // Forced euphoria shows the whole look, including the creature's face — the
  // point of the switch is to have the mode, not a muted version of it. What it
  // must never do is touch the score, and it does not: this drives appearance
  // only, and the streak that produces the multiplier is untouched.
  const joy = isEuphoric ? 1 : earnedJoy;

  // The moment it is genuinely earned, remembered forever. Only a real run
  // unlocks it — forcing it cannot, or the first click would bootstrap itself.
  useEffect(() => {
    if (isEarned) {
      markEuphoriaReached();
    }
  }, [isEarned]);
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
