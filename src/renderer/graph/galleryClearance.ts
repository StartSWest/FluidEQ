/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';

/** Air between a gallery piece and what keeps clear of it, in pixels. */
const CLEARANCE_GAP = 4;

/**
 * The graph's own gallery pieces (`GraphGallery`) and the curves' legend in
 * the top corner (`GraphCornerLegend`), and the strip they hang in.
 */
const PIECES = '.graph-gallery-reel, .graph-gallery-keys, .graph-corner-legend';
const STRIP = '.live-output-controls';

/**
 * Keeps a layer laid over the graph clear of the looks' gallery: the corner
 * (View, full screen) and the curves' legend at the plot's top, and the reel
 * at its foot. The layer
 * gets `--gallery-clear-top` and `--gallery-clear-bottom`, how far each
 * reaches into it, for its own padding; where it is not on a graph (the
 * player's stage) nothing is written.
 *
 * Measured, never assumed: the reel's height changes with the strip's width
 * (its switches wrap under the credit when narrow) and its foot with what the
 * plot paints (`App.scss`). Read again when the layer, a piece or the strip
 * changes size, as their ResizeObserver says.
 *
 * Written for the card a scene that cannot be drawn leaves on the graph
 * (`SceneTroubleState`), which stood centred over the whole plot and so over
 * the reel at its foot (session 0's review, 2026-11-19).
 */
const useGalleryClearance = <T extends HTMLElement>() => {
  const [layer, setLayer] = useState<T | null>(null);

  useEffect(() => {
    const wrapper = layer?.closest('.graph-wrapper');
    if (!layer || !wrapper || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const fit = () => {
      const box = layer.getBoundingClientRect();
      let top = 0;
      let bottom = 0;
      wrapper.querySelectorAll(PIECES).forEach((piece) => {
        const at = piece.getBoundingClientRect();
        if (at.width <= 0 || at.height <= 0) {
          return;
        }
        // A piece in the layer's upper half is cleared from the top, one in
        // its lower half from the bottom.
        if (at.top + at.height / 2 < box.top + box.height / 2) {
          top = Math.max(top, at.bottom - box.top + CLEARANCE_GAP);
        } else {
          bottom = Math.max(bottom, box.bottom - at.top + CLEARANCE_GAP);
        }
      });
      layer.style.setProperty('--gallery-clear-top', `${Math.round(top)}px`);
      layer.style.setProperty(
        '--gallery-clear-bottom',
        `${Math.round(bottom)}px`,
      );
    };
    const observer = new ResizeObserver(fit);
    observer.observe(layer);
    wrapper
      .querySelectorAll(`${PIECES}, ${STRIP}`)
      .forEach((piece) => observer.observe(piece));
    fit();
    return () => {
      observer.disconnect();
      layer.style.removeProperty('--gallery-clear-top');
      layer.style.removeProperty('--gallery-clear-bottom');
    };
  }, [layer]);

  return setLayer;
};

export default useGalleryClearance;
