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

import { useEffect, useLayoutEffect, useRef } from 'react';
import { forEachGraphPoint } from '../graph/EditablePoint';
import { useLiveAudioFrameListener } from '../audio/LiveAudioContext';
import type { IChartPointData } from '../graph/ChartController';
import { getBandLevel } from '../utils/bandLevel';
import { forgetColourfulModeSwitch } from '../utils/euphoriaMode';
import '../styles/Euphoria.scss';

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
  //
  // Handed each frame without rendering: as a render it was this component
  // thirty times a second, to write one property or none.
  const lastPointsRef = useRef<IChartPointData[] | undefined>(undefined);
  useLiveAudioFrameListener(({ graphPoints }) => {
    if (graphPoints !== lastPointsRef.current) {
      lastPointsRef.current = graphPoints;
      publishSelectedPointLevels(graphPoints);
    }
  });

  // Gone means gone. The property is an inline style and would sit on the
  // handle until it happened to be rebuilt — invisible, and a lie the next
  // person to read the element would have to work out. The record goes back
  // to "never told" with it, or a handle still selected when this mounts
  // again would be skipped for as long as its band stayed on the step it went
  // out on.
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

/**
 * The look on the root, for good: `is-euphoric`, which the stylesheets and
 * the canvas painters key on, and the creature at full joy (`--pet-joy`,
 * `has-pet-joy`, `SupportPet.scss`). The look used to follow a switch and,
 * before that, the rhythm game's streak; it has neither now
 * (`euphoriaMode.ts`), so the streak no longer reaches the window at all.
 * A layout effect, so the first frame is already drawn in it.
 */
const EuphoriaGlow = () => {
  useLayoutEffect(() => {
    forgetColourfulModeSwitch();
    const root = document.documentElement;
    root.style.setProperty('--pet-joy', '1');
    root.classList.add('has-pet-joy', 'is-euphoric');
    return () => {
      root.classList.remove('is-euphoric', 'has-pet-joy');
      root.style.removeProperty('--pet-joy');
    };
  }, []);

  return <EuphoriaLevel />;
};

export default EuphoriaGlow;
