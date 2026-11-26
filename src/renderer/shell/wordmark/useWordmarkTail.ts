/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { easeTowards, getEaseFactor } from 'common/smoothing';
import { useLiveAudioFrameListener } from '../../audio/LiveAudioContext';
import useSmoothFrames from '../../utils/useSmoothFrames';
import {
  TAIL_POINTS,
  TAIL_SWAY_PX,
  calmSignal,
  tailAnchors,
  tailOffsets,
  tailOutline,
  tailSignal,
} from './wordmarkTail';

/** Half-lives of the tail's easing: sound arrives fast and dies away slower. */
const RISE_HALF_LIFE_MS = 28;
const FALL_HALF_LIFE_MS = 90;

export interface ITailGeometry {
  /** The tail's length, px. */
  length: number;
  /** The pen's width where the tail leaves the Q, px. */
  startWidth: number;
}

/**
 * The Q's tail, drawn from the capture's waveform as it arrives.
 *
 * Nothing goes through React: each block of audio sets where the tail is
 * heading, and the shared frame loop eases it there and writes the outline
 * straight into the path, stopping once it has arrived (`useSmoothFrames`).
 * It listens to the frames the header's meter already receives and claims no
 * capture of its own, so it costs nothing while nothing is being captured —
 * and then it rests on its still curve. Reduced motion draws that curve and
 * nothing else.
 */
const useWordmarkTail = (
  pathRef: RefObject<SVGPathElement | null>,
  geometry: ITailGeometry,
  isStill: boolean,
) => {
  const currentRef = useRef<number[]>(new Array<number>(TAIL_POINTS).fill(0));
  const targetRef = useRef<number[]>(new Array<number>(TAIL_POINTS).fill(0));
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;

  const draw = useCallback(() => {
    const path = pathRef.current;
    if (!path) {
      return;
    }
    const { length, startWidth } = geometryRef.current;
    // A short flourish sways in proportion to its length: its full sway
    // across 22px read as a scribble in the window.
    const sway = Math.min(TAIL_SWAY_PX, length * 0.12);
    path.setAttribute(
      'd',
      tailOutline(
        tailOffsets(currentRef.current, sway),
        length,
        12,
        startWidth,
      ),
    );
  }, [pathRef]);

  const onFrame = useCallback(
    (deltaMs: number) => {
      const moving = easeTowards(
        currentRef.current,
        targetRef.current,
        getEaseFactor(deltaMs, RISE_HALF_LIFE_MS),
        getEaseFactor(deltaMs, FALL_HALF_LIFE_MS),
      );
      draw();
      return moving;
    },
    [draw],
  );

  const kick = useSmoothFrames(onFrame, {
    isEnabled: !isStill,
    target: pathRef,
  });

  useLiveAudioFrameListener(({ waveform }) => {
    if (isStill) {
      return;
    }
    targetRef.current = calmSignal(
      tailSignal(waveform),
      tailAnchors(geometryRef.current.length),
    );
    kick();
  });

  // A new size, motion turned down: the tail is drawn again where it is, at
  // rest when motion is down.
  useEffect(() => {
    if (isStill) {
      currentRef.current.fill(0);
      targetRef.current.fill(0);
    }
    draw();
  }, [draw, isStill, geometry.length, geometry.startWidth]);
};

export default useWordmarkTail;
