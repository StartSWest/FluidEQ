/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import {
  useLiveAudioCapture,
  useLiveAudioFrame,
} from '../audio/LiveAudioContext';
import { getBandLevel } from '../utils/bandLevel';

interface IBand {
  element: HTMLElement;
  frequency: number;
  /** What it was last told; -1 until it has been told anything. */
  published: number;
}

/**
 * Each band's slider lit by its own frequency (Ivan, 2026-09-26: "no need
 * for the meters next to slider just blink the freq inside the slider").
 *
 * Every band in the row gets `--band-level`, the music at its frequency
 * (`getBandLevel`), and its track's core takes its light from that
 * (`.range__glow`). It used to be written only in euphoria, for a glow round
 * the track; it is the sliders' own now, so it is written whenever the bands
 * are on screen.
 *
 * Its own component for the reason `EuphoriaGlow` split its audio half out:
 * the live frame re-renders its subscriber about twenty times a second, and
 * this renders nothing, where the page that owns the bands renders a great
 * deal. The writes go straight to the elements, and only when a band's
 * stepped level changes.
 *
 * It holds the capture open while it is mounted, like anything else that
 * draws the live sound: the tracks are that drawing, whether or not the graph
 * above them is showing its trace.
 */
const BandLevels = ({
  row,
}: {
  /** The bands' row, once it is drawn. */
  row: HTMLElement | null;
}) => {
  useLiveAudioCapture();
  const { graphPoints } = useLiveAudioFrame();
  const bands = useRef<IBand[]>([]);

  // Read again whenever the row's bands change — one added or removed, a new
  // layout putting new elements where the old ones were with the same count,
  // or a band moved to another frequency, none of which a prop here would
  // say. Every level is forgotten with it, so the next frame writes all of
  // them: a band whose energy has not crossed a step since would otherwise
  // keep the value it was last told and sit unlit while its neighbours move.
  useEffect(() => {
    if (!row) {
      bands.current = [];
      return undefined;
    }
    const readRow = () => {
      bands.current = Array.from(
        row.querySelectorAll<HTMLElement>('.bandWrapper'),
      ).map((element) => ({
        element,
        frequency: Number(element.dataset.frequency),
        published: -1,
      }));
    };
    readRow();
    const watch = new MutationObserver(readRow);
    watch.observe(row, {
      childList: true,
      subtree: true,
      attributeFilter: ['data-frequency'],
    });
    return () => {
      watch.disconnect();
      bands.current.forEach(({ element }) =>
        element.style.removeProperty('--band-level'),
      );
    };
  }, [row]);

  useEffect(() => {
    // No spectrum is silence, or no capture: every core goes back to its
    // resting light rather than holding whatever the music was doing when
    // it stopped.
    const hasSpectrum = graphPoints.length > 0;
    for (let index = 0; index < bands.current.length; index += 1) {
      const band = bands.current[index];
      const level =
        hasSpectrum && Number.isFinite(band.frequency)
          ? getBandLevel(graphPoints, band.frequency)
          : 0;
      if (level !== band.published) {
        band.published = level;
        band.element.style.setProperty('--band-level', String(level));
      }
    }
  }, [graphPoints]);

  return null;
};

export default BandLevels;
