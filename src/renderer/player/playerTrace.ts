/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import { frequencyScale, gainScale } from '../graph/ChartController';
import liveTraceCurves from '../graph/liveTraceCurves';
import { useWaveOrientation } from '../utils/graphStyle';

/**
 * The span a standard look is drawn over in the amp, fixed: 20 Hz to 18 kHz
 * (Ivan, 2026-10-25). The graph's own 25 kHz left the top of the panel empty
 * on most records, its 16 kHz cut off air some of them carry ("cut at 18k
 * because still some info getting cut"), and a span that followed the grid
 * switch slid the whole drawing sideways.
 */
export const PLAYER_PLOT_SPAN: readonly [number, number] = [20, 18_000];

/**
 * How the amp draws a standard look in a box of this size: the top panel's
 * picture (`PlayerHero`) and the folded line's (`FoldTrace`) alike, so a look
 * is the same drawing folded and unfolded.
 */
const usePlayerTrace = (width: number, height: number) => {
  const orientation = useWaveOrientation();
  // THE GRAPH'S OWN RULE FOR A STANDARD LOOK IN ITS PANE: the whole plot,
  // from its foot, whatever the big views' height and position were left at
  // (`FrequencyResponseChart`, `isPlainPane`). The panel borrowed full
  // screen's instead, and somebody who had set full screen to a sliver in the
  // middle got a flat line across the panel (Ivan, 2026-10-25: "the standard
  // wave is just a line"; his full screen read 5% high, centred).
  const curves = useMemo(
    () =>
      liveTraceCurves({
        orientation,
        height: 1,
        position: 0,
        opacity: 1,
      }),
    [orientation],
  );
  // Edge to edge: the drawing runs to the box's sides and foot, with no
  // gutter for numbers it does not carry (`paperRules`), over one fixed span.
  const xScale = useMemo(
    () => frequencyScale(width, 0, 0, PLAYER_PLOT_SPAN),
    [width],
  );
  // EVERY LOOK REACHES THE TOP. Standard looks started under the look's name
  // (Ivan, 2026-10-25: "just below the analyzer button"); with the name gone
  // (`player-hero__top`) a band of nothing stood where it had been, over a
  // panel already made shorter to fit a laptop.
  const yScale = useMemo(() => gainScale(height, 0, 0), [height]);
  return { curves, xScale, yScale };
};

export default usePlayerTrace;
