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
  isEuphoriaAchieved,
  toggleEuphoriaEnabled,
  useIsEuphoric,
  winEuphoria,
} from '../utils/euphoriaMode';
import '../styles/Euphoria.scss';

/** At x10 the whole application celebrates. Below it, nothing happens. */
const EUPHORIA_AT = 1;

/**
 * How many values a band's level is allowed to take.
 *
 * Quantising it is the whole performance trick. Every element reading
 * `--band-level` has its style recalculated when that property changes, and a
 * continuous value changes on literally every frame — thirty-one bands,
 * invalidated twenty-two times a second, for differences of a thousandth that
 * nobody can see.
 *
 * Rounded to twelve steps it only changes when the music moves enough to be
 * visible, which in practice is a few times a second rather than twenty-two.
 * The motion is very slightly stepped, and that reads as a meter responding
 * rather than as something smoothed — it is not a compromise so much as the
 * more honest look.
 */
const LEVEL_STEPS = 12;

/**
 * How long to wait for a burst to tell us it has finished before assuming it
 * never will. Comfortably past the 900ms ring and its 90ms-delayed sibling, so
 * this only fires when the event did not arrive at all.
 */
const BURST_GIVE_UP_MS = 1600;

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
 *
 * It publishes to the bands and to nothing else. There was a second half that
 * wrote a whole-window `--euphoria-level` to the document root, and it has been
 * removed rather than tuned, because no stylesheet ever read it. An inherited
 * custom property set on `<html>` invalidates the computed style of every
 * element beneath it, and with no `contain` anywhere in this application that
 * is the entire tree rebuilt several times a second to publish a number nobody
 * asked for. Quantising it to twelve steps only reduced how often that
 * happened; the value still had no reader.
 */
const EuphoriaLevel = () => {
  const { points } = useLiveAudioFrame();
  // The row is rebuilt when the band count changes and at no other time, so
  // that is what the re-query below keys on. Keying it on the frame would
  // re-query every frame and undo the saving entirely.
  const bandCount = Object.keys(useFluidEqContext().filters).length;
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

  return null;
};

const EuphoriaGlow = () => {
  // Only the run. This re-renders when the streak changes and at no other time,
  // which for most of the app's life is never.
  const earnedJoy = getStreakJoy(useRhythmRun().streak);
  const isEarned = earnedJoy >= EUPHORIA_AT;
  // Won once, the switch is the only thing that decides. See useIsEuphoric.
  const isEuphoric = useIsEuphoric(isEarned);
  // Forced euphoria shows the whole look, including the creature's face — the
  // point of the switch is to have the mode, not a muted version of it. What it
  // must never do is touch the score, and it does not: this drives appearance
  // only, and the streak that produces the multiplier is untouched.
  const joy = isEuphoric ? 1 : earnedJoy;

  // Winning is an event, not a condition.
  //
  // This fires on the transition into the ceiling and unlocks the mode
  // permanently while switching it on now. Reading it as a condition is what
  // made the switch impossible to turn off, because the streak that satisfies
  // it never goes away on its own.
  useEffect(() => {
    if (isEarned) {
      winEuphoria();
    }
  }, [isEarned]);

  // Ctrl+E, once it has been won.
  //
  // The pill on the titlebar is small and easy to miss, and the mode is the
  // sort of thing somebody flicks on and off while listening rather than
  // deliberately visits a control for. Deliberately silent before the mode is
  // won: the shortcut existing at all would give away that there is something
  // to find, and the surprise is most of what the mode is worth.
  //
  // Bound to the window so it works wherever the focus happens to be, which is
  // why it steps aside for anything that can be typed into — Ctrl+E is a real
  // shortcut inside a text field on some keyboard layouts, and hijacking it
  // there to recolour the app would be indefensible.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'KeyE' || !event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.closest('input, textarea, select, [contenteditable]')
      ) {
        return;
      }
      // Guarded in the store as well, which is what actually enforces it; this
      // is here so the keypress falls through to the browser untouched rather
      // than being swallowed by a shortcut that would do nothing.
      if (!isEuphoriaAchieved()) {
        return;
      }
      event.preventDefault();
      toggleEuphoriaEnabled();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
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

  // A backstop, because of what an unfinished burst leaves behind.
  //
  // The rings expand to ninety times their own size across a `position: fixed`
  // element at the top of the stacking order, so a burst that never clears
  // itself is a window-sized overlay the renderer has to keep drawing for —
  // invisible, since it ends fully transparent, and permanent. `animationend`
  // is the ordinary way out and it is not a guarantee: an animation that never
  // starts never ends either, which is one stylesheet rule or one hidden
  // ancestor away.
  useEffect(() => {
    if (burst === 0) {
      return undefined;
    }
    const timer = window.setTimeout(() => setBurst(0), BURST_GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, [burst]);

  useEffect(() => {
    const root = document.documentElement;
    const isOn = joy >= EUPHORIA_AT;
    root.style.setProperty('--pet-joy', String(joy));
    root.classList.toggle('is-euphoric', isOn);
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
