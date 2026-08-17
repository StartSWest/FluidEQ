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

/**
 * Show the look you just picked, when there is no sound to show it with.
 *
 * Choosing a visualiser against silence is choosing blind: the plot is a flat
 * line whichever of the hundred-odd looks is selected, so the only way to see
 * what "canyon" or "braid" actually draws was to put music on and come back.
 * The picker now has an icon beside every name, which answers the shape at a
 * glance and cannot answer how the thing moves.
 *
 * So changing look plays one frame of a plausible spectrum and then lets go.
 * The rise, the second it holds and the fall are not animated here — the canvas
 * already eases its points toward whatever it is handed, so handing it a shape
 * and later handing it silence again *is* the animation, and it decays exactly
 * the way a track ending decays because it is the same code path.
 *
 * ONLY WHEN THERE IS NOTHING PLAYING. With audio running the look is already on
 * screen doing the one thing this exists to demonstrate, and a second of frozen
 * synthetic spectrum dropped over a live trace would read as a glitch rather
 * than as a preview.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { IChartPointData } from './ChartController';

/** How long the frame stays up before it is allowed to fall away. */
const PREVIEW_HOLD_MS = 1000;

/**
 * How close to the floor every point must sit for the output to count as
 * silent.
 *
 * Not equality with `MIN_GAIN`. A capture that is running on a quiet passage
 * still reports a fraction of a dB of movement, and a preview that refused to
 * play because the room was not digitally silent would be a preview that
 * almost never played.
 */
const SILENT_HEADROOM_DB = 1.5;

/** Points to draw when there is no capture at all to borrow an axis from. */
const FALLBACK_POINT_COUNT = 320;
const FALLBACK_MIN_HZ = 20;
const FALLBACK_MAX_HZ = 20000;

/**
 * The shape the preview draws, as a fraction of the plot's depth.
 *
 * Written as a curve rather than as sampled data because it has to survive
 * being drawn by every look: a bar chart, a filled area, a scatter of dots and
 * a line all read it, and a shape with sharp steps in it looks like an artefact
 * in half of those. This is the broad tilt of recorded music — weight at the
 * bottom, a dip through the lower mids, presence around a few kHz and air
 * falling away above it — with enough ripple that neighbouring bars differ.
 */
const previewLevel = (position: number): number => {
  // The overall downward tilt. Most of the energy in most music is low.
  const tilt = (1 - position) ** 0.75;
  // Two gentle rises so it is not a ramp: one where a kick and bass sit, one
  // up where presence does.
  const body = 0.16 * Math.exp(-(((position - 0.12) / 0.1) ** 2));
  const presence = 0.13 * Math.exp(-(((position - 0.62) / 0.13) ** 2));
  // Fine detail, so a bar look has neighbours of different heights rather than
  // a smooth staircase.
  const ripple =
    0.045 * Math.sin(position * 37) + 0.03 * Math.sin(position * 91);
  return Math.min(1, Math.max(0, tilt * 0.86 + body + presence + ripple));
};

/** True when every point is on the floor, or when there are no points at all. */
const isSilent = (points: IChartPointData[]): boolean => {
  if (points.length === 0) {
    return true;
  }
  for (let index = 0; index < points.length; index += 1) {
    if (points[index].y > MIN_GAIN + SILENT_HEADROOM_DB) {
      return false;
    }
  }
  return true;
};

/**
 * One frame of preview, on the axis the capture is already using.
 *
 * The live points are borrowed for their `x` values rather than having a second
 * axis built here: they are log-spaced by the analyser and a preview drawn on a
 * subtly different spacing would sit slightly off from the trace that replaces
 * it. Only when there is no capture at all — nothing to borrow — is one made.
 */
const buildPreviewFrame = (live: IChartPointData[]): IChartPointData[] => {
  const depth = MAX_GAIN - MIN_GAIN;
  if (live.length > 0) {
    return live.map((point, index) => ({
      x: point.x,
      y: MIN_GAIN + previewLevel(index / (live.length - 1 || 1)) * depth,
    }));
  }
  const logMin = Math.log10(FALLBACK_MIN_HZ);
  const logMax = Math.log10(FALLBACK_MAX_HZ);
  return Array.from({ length: FALLBACK_POINT_COUNT }, (_value, index) => {
    const position = index / (FALLBACK_POINT_COUNT - 1);
    return {
      x: 10 ** (logMin + position * (logMax - logMin)),
      y: MIN_GAIN + previewLevel(position) * depth,
    };
  });
};

/**
 * The points the trace should draw: the live ones, or a preview standing in.
 *
 * @param live the analyser's current frame
 * @param lookId what is selected; a change is what triggers a preview
 */
export const useLookPreviewPoints = (
  live: IChartPointData[],
  lookId: string,
): IChartPointData[] => {
  const [preview, setPreview] = useState<IChartPointData[] | undefined>();
  /*
   * The live frame, on a ref.
   *
   * The effect below has to ask whether anything is playing, and it must not
   * re-run when the answer changes — it re-runs on a change of look and on
   * nothing else. Reading the frame through a dependency would restart the
   * hold timer thirty times a second and the preview would never expire.
   */
  const liveRef = useRef(live);
  liveRef.current = live;
  /** Skips the preview that would otherwise fire on the first render. */
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return undefined;
    }
    if (!isSilent(liveRef.current)) {
      return undefined;
    }
    setPreview(buildPreviewFrame(liveRef.current));
    const timer = setTimeout(() => setPreview(undefined), PREVIEW_HOLD_MS);
    return () => clearTimeout(timer);
  }, [lookId]);

  /*
   * Dropped the moment anything starts playing.
   *
   * Otherwise a preview begun in silence would sit frozen over the first second
   * of a track — the one moment the real trace is most worth seeing.
   */
  useEffect(() => {
    if (preview && !isSilent(live)) {
      setPreview(undefined);
    }
  }, [live, preview]);

  return useMemo(() => preview ?? live, [preview, live]);
};

export default useLookPreviewPoints;
