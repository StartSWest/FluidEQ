/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { IScenePack } from 'common/scenePacks';
import type { ISceneTuning } from '../graph/sceneTuner';
import observeShown from '../utils/observeShown';
import {
  sceneAppColourStops,
  setStudioAppColours,
} from '../utils/sceneAppColours';

/**
 * Hands the window's Colourful palette to the project on the Studio's bench
 * while it has a palette or a colour showing (`sceneAppColours.ts`), as the
 * member has them this moment: a stop dragged on the strip, a preset picked,
 * a choice that swaps the palette for a single colour — the titlebar's wave
 * and the meters follow at once, before anything is saved.
 *
 * Only while the bench is on screen, as the Studio's tint (`useStudioTint`):
 * the Studio stays mounted behind every other page and behind the player,
 * and those wear the graph's visualizer's colours, not the project's.
 */
export default function useStudioAppColours(
  pack: IScenePack | undefined,
  tuning: ISceneTuning,
  bench: RefObject<HTMLElement | null>,
) {
  const [isShown, setIsShown] = useState(false);

  useEffect(() => {
    const element = bench.current;
    return element ? observeShown(element, setIsShown) : undefined;
  }, [bench]);

  const stops = useMemo(
    () => (pack && isShown ? sceneAppColourStops(pack, tuning) : undefined),
    [pack, isShown, tuning],
  );

  useEffect(() => {
    setStudioAppColours(stops);
  }, [stops]);

  // Apart from the effect above, so moving from one edit to the next is one
  // change rather than a clear and a set.
  useEffect(() => () => setStudioAppColours(undefined), []);
}
