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

import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { getStreakJoy } from 'common/rhythmGame';
import { forEachGraphPoint } from '../graph/EditablePoint';
import { useLiveAudioFrame } from '../audio/LiveAudioContext';
import { getBandLevel } from '../utils/bandLevel';
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

/** One blade per slice of the activation sweep; static so renders allocate none. */
const EUPHORIA_BLADES = Array.from({ length: 14 }, (_, index) => index);

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
  graphPoints: readonly { x: number; y: number }[],
) => {
  const hasSpectrum = graphPoints.length > 0;
  forEachGraphPoint((element, state) => {
    if (!state.selected || !hasSpectrum) {
      if (state.published !== -1) {
        state.published = -1;
        element.style.removeProperty('--point-level');
      }
      return;
    }
    const stepped = getBandLevel(graphPoints, state.frequency);
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
 * It publishes to the graph's handles and to nothing else. The bands' own
 * levels are the slider row's now, written whether or not the mode is on
 * (`BandLevels`). There was a half that wrote a whole-window
 * `--euphoria-level` to the
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
  const { graphPoints } = useLiveAudioFrame();

  // The graph's selected handles, each lit by its own band.
  //
  // No re-query and no staleness check: the handles put themselves into a
  // registry as they mount, so the set is correct by construction whether the
  // graph is showing, hidden behind a spinner, or has just been switched off
  // entirely — and it is why a handle that mounts mid-track needs nothing
  // special done for it. It arrives with its own "never been told anything"
  // and is written to on the next frame.
  //
  // Driven by the frame and not by the selection, which is the same thing here:
  // a selection made while music is playing is picked up within one frame of
  // being made, and a selection made in silence has nothing to be lit by.
  useEffect(() => {
    publishSelectedPointLevels(graphPoints);
  }, [graphPoints]);

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
  // From the state the window opens in. The mode is always on now, and
  // starting from false fired the arrival's burst over every launch.
  const wasEuphoricRef = useRef(isEuphoric);

  // On the way IN only. Thirty-six perfect taps deserve a bang; the way out is
  // a mistake, and nobody wants confetti for that.
  useEffect(() => {
    if (isEuphoric && !wasEuphoricRef.current) {
      setBurst((count) => count + 1);
    }
    wasEuphoricRef.current = isEuphoric;
  }, [isEuphoric]);

  // The class follows `isEuphoric`, and the variable follows `joy`. They are
  // two different questions and deriving both from `joy` got one of them wrong.
  //
  // `isOn` used to be `joy >= EUPHORIA_AT`, and `joy` falls back to `earnedJoy`
  // whenever the switch is off — so with the switch off and the streak still at
  // the ceiling, the class stayed on. That is not a corner: it is the state the
  // app is in for the whole of the first session, because winning is what turns
  // the mode on for the first time and a streak does not reset when somebody
  // stops playing. Turning it off then cleared everything gated on `isEuphoric`
  // in React and nothing at all gated on `.is-euphoric` in the stylesheets —
  // half a rainbow — and it came right after a restart only because the run
  // lives in memory, so the streak was gone and the two agreed again.
  //
  // `useIsEuphoric` is the single answer for whether the app is in euphoria.
  // Asking it directly is the fix; `joy` stays the creature's own 0-to-1
  // intensity, which is about the run and legitimately outlives the switch.
  //
  // `has-pet-joy` says there is any joy at all, for what the creature draws
  // only with some (`SupportPet.scss`): at zero the waves in her eyes were
  // fully transparent and still scrolled every frame, in the titlebar, for
  // everybody who had never played.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--pet-joy', String(joy));
    root.classList.toggle('has-pet-joy', joy > 0);
    root.classList.toggle('is-euphoric', isEuphoric);
  }, [isEuphoric, joy]);

  useEffect(
    () => () => {
      const root = document.documentElement;
      root.classList.remove('is-euphoric', 'has-pet-joy');
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
          onAnimationEnd={(event) => {
            // Children finish first. The overlay owns a deliberately longest
            // life animation; only that event removes the whole temporary FX.
            if (event.animationName === 'euphoria-burst-life') {
              setBurst(0);
            }
          }}
        >
          {EUPHORIA_BLADES.map((index) => (
            <span
              key={index}
              className="euphoria-burst__blade"
              style={
                {
                  '--euphoria-blade-index': index,
                  '--euphoria-blade-hue': `${(index * 360) / EUPHORIA_BLADES.length}deg`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      )}
    </>
  );
};

export default EuphoriaGlow;
