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

import { useCallback, useEffect, useRef, useState } from 'react';
import { getStreakJoy } from 'common/rhythmGame';
import { forEachGraphPoint, graphPointCount } from '../graph/EditablePoint';
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
 * One band's share of the spectrum, as a stepped level.
 *
 * The single thing that decides what the music is doing at a band, and shared
 * by both readers of it: the slider row publishes one of these per band, and
 * the graph asks for one for whichever handle is selected. Two copies of this
 * arithmetic would be two answers to "how loud is this band", and the two would
 * be sitting one above the other on screen where the disagreement is visible.
 *
 * The spectrum runs low to high and so do the bands, so a band's share of the
 * row is its share of the spectrum. Exact frequencies would be better; this
 * needs no reach into the EQ state and is right to within a band.
 *
 * Callers guarantee there is a spectrum and at least one band; there is nothing
 * useful to return otherwise and a guard here would only move the decision.
 */
const getBandLevel = (
  points: readonly { x: number; y: number }[],
  index: number,
  bandCount: number,
) => {
  const perBand = points.length / bandCount;
  const from = Math.floor(index * perBand);
  const to = Math.max(from + 1, Math.floor((index + 1) * perBand));
  let peak = -Infinity;
  for (let point = from; point < to; point += 1) {
    if (points[point].y > peak) {
      peak = points[point].y;
    }
  }
  // The curve is plotted in dB against the track's own peak, so the top of the
  // scale is 0 and useful signal lives in the twenty below it.
  const level = Math.max(0, Math.min(1, (peak + 20) / 20));
  return Math.round(level * LEVEL_STEPS) / LEVEL_STEPS;
};

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
  for (let index = 0; index < bands.length; index += 1) {
    const stepped = getBandLevel(points, index, bands.length);
    if (stepped !== published[index]) {
      published[index] = stepped;
      bands[index].style.setProperty('--band-level', String(stepped));
    }
  }
};

/**
 * Where a handle sits in frequency order among all the handles on the graph.
 *
 * The chart builds its handles from `Object.values(filters)` and sorts only the
 * colours, so the order they mount in is the order the EQ state happens to hold
 * them and says nothing about the axis. The band division above is by index in
 * frequency order, so the index has to be worked out rather than assumed.
 *
 * Counted rather than sorted, because sorting would allocate an array on every
 * frame to answer a question about one handle. This is a pass over a handful of
 * numbers, run only for the handle that is actually selected — which is
 * normally one, and at the extreme is a few dozen comparisons against a band
 * count that cannot exceed thirty-one.
 */
const getFrequencyRank = (frequency: number) => {
  let rank = 0;
  forEachGraphPoint((_element, other) => {
    if (other.frequency < frequency) {
      rank += 1;
    }
  });
  return rank;
};

/**
 * Light the selected handles from their own frequencies, and only those.
 *
 * Only the selected ones, which is the design and not an optimisation that
 * happened to be available — though it is that as well. Every other handle on
 * the graph is a target waiting to be grabbed, and a row of thirty-one flashing
 * targets is both harder to aim at and a blurrier copy of what the live trace
 * behind them already says properly. The handle in hand answers the music; the
 * rest hold still.
 *
 * What falls out of that is the cost. There is normally exactly one selected
 * handle, so a frame writes at most one custom property and usually none —
 * against the ten to thirty-one a whole lit row would have cost. The guard is
 * per handle rather than shared, so the arithmetic that decides not to write is
 * as cheap as the write it avoids.
 *
 * An unselected handle is actively cleared rather than left holding its last
 * value. Nothing reads it — the euphoric rule selects on `--selected` — so this
 * changes no pixels, but a stale number on an element is a thing the next
 * person to inspect one has to disprove. The same clearing is what makes the
 * spectrum going away safe: the analyser publishes an empty frame when the
 * capture stops, and a handle left as it was would sit glowing at whatever the
 * music was doing when it ended.
 */
const publishSelectedPointLevels = (
  points: readonly { x: number; y: number }[],
) => {
  const bandCount = graphPointCount();
  if (bandCount === 0) {
    return;
  }
  const hasSpectrum = points.length > 0;
  forEachGraphPoint((element, state) => {
    if (!state.selected || !hasSpectrum) {
      if (state.published !== -1) {
        state.published = -1;
        element.style.removeProperty('--point-level');
      }
      return;
    }
    const stepped = getBandLevel(
      points,
      getFrequencyRank(state.frequency),
      bandCount,
    );
    if (stepped === state.published) {
      return;
    }
    state.published = stepped;
    element.style.setProperty('--point-level', String(stepped));
  });
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
 * It publishes to the bands and to the graph's handles, and to nothing else.
 * There was a third half that wrote a whole-window `--euphoria-level` to the
 * document root, and it has been removed rather than tuned, because no
 * stylesheet ever read it. An inherited custom property set on `<html>`
 * invalidates the computed style of every element beneath it, and with no
 * `contain` anywhere in this application that is the entire tree rebuilt
 * several times a second to publish a number nobody asked for. Quantising it to
 * twelve steps only reduced how often that happened; the value still had no
 * reader.
 *
 * The handles are written to individually for the same reason. Their only
 * common ancestor is the chart's `<svg>`, which is equally the ancestor of both
 * axes, every gridline, every curve and the whole `<defs>` block — so publishing
 * one value there to save writes would be the same mistake in a smaller room,
 * and would invalidate far more elements than reaching the readers directly
 * does. It does not even save writes worth having: only the selected handle
 * takes a value, so a frame writes one property or none.
 */
const EuphoriaLevel = () => {
  const { points } = useLiveAudioFrame();
  // The row is rebuilt when the band count changes and at no other time, so
  // that is what the re-query below keys on. Keying it on the frame would
  // re-query every frame and undo the saving entirely.
  const bandCount = Object.keys(useFluidEqContext().filters).length;
  const bandsRef = useRef<HTMLElement[]>([]);
  const bandLevelsRef = useRef<number[]>([]);

  const readBands = useCallback(() => {
    const bands = Array.from(
      document.querySelectorAll<HTMLElement>('.bandWrapper'),
    );
    bandsRef.current = bands;
    // Every level forgotten, so the next frame writes all of them. Without
    // this, a band whose energy has not crossed a step boundary since the row
    // was rebuilt keeps the value it was last *told* it had and never receives
    // one, so it sits unlit while its neighbours dance.
    bandLevelsRef.current = new Array<number>(bands.length).fill(-1);
    return bands;
  }, []);

  // Re-read when the band count changes, which is one of the two times the row
  // is rebuilt. Querying every frame would undo the saving this is here for.
  useEffect(() => {
    readBands();
    const bands = bandsRef.current;
    return () => {
      bands.forEach((band) => band.style.removeProperty('--band-level'));
    };
  }, [bandCount, readBands]);

  useEffect(() => {
    // The other time the row is rebuilt, and the reason the glow used to come
    // back dead: leaving the EQ tab unmounts every band, and returning mounts
    // fresh elements with the *same count* — so the effect above never fires,
    // and these references are to nodes that are no longer in the document.
    // Levels were still being written, faithfully, to elements nobody could
    // see.
    //
    // `isConnected` on the first one answers it: the row is built and torn down
    // whole, so one detached element means all of them are. A single property
    // read per frame is nothing against re-querying the document.
    const bands = bandsRef.current;
    if (bandCount > 0 && (bands.length === 0 || !bands[0].isConnected)) {
      readBands();
    }
    publishBandLevels(points, bandsRef.current, bandLevelsRef.current);
  }, [bandCount, points, readBands]);

  // The graph's selected handles, each lit by its own band.
  //
  // No re-query and no staleness check, unlike the row above: the handles put
  // themselves into a registry as they mount, so the set is correct by
  // construction whether the graph is showing, hidden behind a spinner, or has
  // just been switched off entirely. That is the same bug the row fixed with
  // `isConnected`, answered a step earlier — and it is why a handle that mounts
  // mid-track needs nothing special done for it. It arrives with its own
  // "never been told anything" and is written to on the next frame.
  //
  // Driven by the frame and not by the selection, which is the same thing here:
  // a selection made while music is playing is picked up within one frame of
  // being made, and a selection made in silence has nothing to be lit by.
  useEffect(() => {
    publishSelectedPointLevels(points);
  }, [points]);

  // Off means off. The stylesheet's rules go with the root class, but the
  // property is an inline style and would sit on the handle until it happened
  // to be rebuilt — invisible, and a lie the next person to read the element
  // would have to work out. The record goes back to "never told" with it, or a
  // handle still selected when the mode returns would be skipped for as long as
  // its band stayed on the step it went out on.
  useEffect(
    () => () => {
      forEachGraphPoint((element, state) => {
        state.published = -1;
        element.style.removeProperty('--point-level');
      });
    },
    [],
  );

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
