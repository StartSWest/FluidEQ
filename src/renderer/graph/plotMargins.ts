/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * How much room the plot leaves above itself: almost none.
 *
 * The controls strip floats INSIDE the graph, over the top of the plot (Ivan,
 * 2026-09-25: "move the graph a bit up and make the option pane appear inside
 * the graph"). It used to have a band of its own: the plot kept out from under
 * the strip by the strip's measured height, so the band handles at the top of
 * a boosted curve could never land under a button. The price was that band —
 * 54px of graph with nothing drawn in it, and every visualizer cut off in a
 * hard straight line along its foot ("some standard viz getting cutted").
 *
 * Handles under the strip stay reachable wherever the strip is not a control:
 * its container and its hint text let a press through to the plot
 * (`.live-output-controls`, `.graph-edit-hint`), and the pane sits against
 * the right, clear of the gain scale.
 */

/**
 * Air either side of a ruled plot, so a curve running off the edge of the
 * plot is not cut flush against the column's edge. A gridless plot has none.
 *
 * It was 30 while the plot stood in a rounded card; on the open floor (layout
 * A, Ivan 2026-09-25: "the grid padding on the graph be less on the side")
 * there is no card edge to keep off, only the hairline between the columns,
 * and the gain and level labels already have gutters of their own inside
 * this (`getAxisPadding`).
 */
export const GRID_SIDE_MARGIN = 8;

/**
 * Under a ruled plot: nothing. The frequency labels live inside the plot's
 * own bottom gutter (`getAxisPadding`), and this margin was a second band of
 * empty picture under them, between the graph and the divider below it.
 */
export const GRID_BOTTOM_MARGIN = 0;

/**
 * Above a ruled plot: enough that the "+20 dB" label, centred on the top rule,
 * is not cut by the graph's own top edge. The rule itself is a further 14px
 * down, inside the plot's padding, which is what keeps a handle at +20 dB
 * whole (`getAxisPadding`).
 */
export const RULED_TOP_MARGIN = 6;

/**
 * A gridless plot gives the headroom up entirely. With no scale left to read,
 * the pane is a visual stage and the height slider must be able to reach its
 * real top edge.
 */
export const EDGE_TO_EDGE_TOP_MARGIN = 4;

/** Headroom above the plot, in pixels. */
export const plotTopMargin = (isEdgeToEdge: boolean): number =>
  isEdgeToEdge ? EDGE_TO_EDGE_TOP_MARGIN : RULED_TOP_MARGIN;
