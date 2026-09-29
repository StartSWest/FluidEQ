/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useRef, useState, type RefObject } from 'react';
import type { GraphStyle } from 'common/graphStyles';
import type { IScenePack } from 'common/scenePacks';
import type { TEngineLookPhase } from './EngineLookLayer';

/** One engine layer on the plot: the look chosen, or the one being left. */
export interface IEngineLayer {
  /** New for every choice, so a look chosen again is a new layer. */
  key: string;
  style: GraphStyle;
  pack: IScenePack;
  leaving: boolean;
}

interface IEngineLook {
  style: GraphStyle;
  /** Absent while the engine does not draw the look. */
  pack: IScenePack | undefined;
}

interface ILeavingEngineLook {
  /** The layers to mount, the look being left first so it lies under. */
  layers: readonly IEngineLayer[];
  /** Handed the leaving layer's box by the layer itself. */
  onLeavingHost: (host: HTMLDivElement | null) => void;
  /**
   * Called by the frame loop on every frame, before it paints, with how far
   * the page's crossfade has brought the new look in (1 once there is none),
   * so the old picture goes out in the same frames the new one comes in.
   */
  fade: (mix: number) => void;
}

/**
 * The engine's picture of the look just left, kept on screen while the next
 * one comes in.
 *
 * The engine draws a look on a canvas of its own, which the trace canvas
 * never holds, so a change of look had nothing of it to crossfade from
 * (`graphLookTransition.ts`): the old look's canvas went with its worker the
 * moment another was chosen, the plot stood empty until the page had drawn
 * the new one — a tenth to four tenths of a second, measured frame by frame,
 * while React and the next worker started — and that was then faded in from
 * nothing. A flash on every change (Ivan, 2026-09-28: "still doing the
 * flashing when switching viz").
 *
 * Now the layer showing the look being left stays mounted, asleep — its
 * worker keeps the last picture on its canvas and draws nothing more — goes
 * out as the new look comes in, and is taken away once it is gone. Only a
 * look the engine was SHOWING: one still being built or handed over is still
 * on the page's canvas, and the page's own crossfade takes it.
 *
 * Read and written during the render, like the phase it reads: the style
 * changing is seen there, before the trace canvas sends its phase back to
 * the start for the new look.
 */
export default function useLeavingEngineLook(
  look: IEngineLook,
  phaseRef: RefObject<TEngineLookPhase>,
): ILeavingEngineLook {
  const serialRef = useRef(0);
  const currentRef = useRef<{ key: string; style: GraphStyle } | undefined>(
    undefined,
  );
  const shownPackRef = useRef<IScenePack | undefined>(undefined);
  const leavingRef = useRef<IEngineLayer | undefined>(undefined);
  /** The leaving picture's strength, which only ever falls. */
  const strengthRef = useRef(1);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [, setGone] = useState(0);

  const { current } = currentRef;
  if (!current || current.style !== look.style) {
    const shownPack = shownPackRef.current;
    if (current && shownPack && phaseRef.current === 'showing') {
      leavingRef.current = {
        key: current.key,
        style: current.style,
        pack: shownPack,
        leaving: true,
      };
      strengthRef.current = 1;
    }
    serialRef.current += 1;
    currentRef.current = {
      key: `look-${serialRef.current}`,
      style: look.style,
    };
  }
  shownPackRef.current = look.pack;

  const onLeavingHost = useCallback((host: HTMLDivElement | null) => {
    hostRef.current = host;
    if (host) {
      host.style.opacity = String(strengthRef.current);
    }
  }, []);

  const fade = useCallback((mix: number) => {
    if (!leavingRef.current) {
      return;
    }
    // Squared, and not the plain 1 - mix, because the two pictures are
    // stacked, not added: the new one over the old at `mix` covers what it
    // overlaps by that much, so where both have a bar the plain fade sank to
    // three quarters of either halfway through. Squared, the deepest is 85%
    // (at two thirds of the way), and the old picture is still gone exactly
    // when the new one is whole.
    const strength = Math.min(strengthRef.current, 1 - mix * mix);
    strengthRef.current = strength;
    if (hostRef.current) {
      hostRef.current.style.opacity = String(strength);
    }
    if (strength <= 0) {
      leavingRef.current = undefined;
      setGone((count) => count + 1);
    }
  }, []);

  const layers: IEngineLayer[] = [];
  const leaving = leavingRef.current;
  if (leaving) {
    layers.push(leaving);
  }
  const chosen = currentRef.current;
  if (chosen && look.pack) {
    layers.push({
      key: chosen.key,
      style: chosen.style,
      pack: look.pack,
      leaving: false,
    });
  }
  return { layers, onLeavingHost, fade };
}
