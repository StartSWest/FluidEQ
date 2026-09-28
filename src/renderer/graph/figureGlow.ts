/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The halo a figure throws: what the page's canvas strokes it with
 * (`LiveTraceCanvas`) and what the engine paints for the designed scenes
 * (`engineLooks/designed/`), so the two throw the same light.
 */

/**
 * The euphoria halo: two wide, faint copies of the figure behind itself.
 *
 * Three approaches were tried and two are recorded here so nobody spends an
 * afternoon rediscovering them.
 *
 * A *stack* of three widening strokes gives a proper falloff and is what light
 * actually looks like — and costs three tessellations of a figure that, on the
 * ornate forms, is hundreds of pieces, doubled again when a mirrored mode puts
 * a second live trace on the chart. Unaffordable.
 *
 * A cheap decimated *outline* fixes the cost and stops being light: it does not
 * follow the figure's geometry, so it reads as a second stray wave wandering
 * across the first.
 *
 * Swelling the trace itself is cheapest of all and is the wrong tool, because
 * it can only reach settings the look owns. A filled form has no stroke to
 * thicken; a look tuned to a light fill had that fill overridden to get the
 * effect. The mode ended up editing the drawing rather than lighting it.
 *
 * Two passes, widest and faintest underneath, which is what turns a hard edge
 * into a falloff. Affordable only because the halo is stroked from a silhouette
 * rather than the figure — see `getGlowStyle`.
 */
export const GLOW_LAYERS: readonly { widen: number; opacity: number }[] = [
  { widen: 17, opacity: 0.1 },
  { widen: 7, opacity: 0.16 },
];

/**
 * The halo is painted at this fraction of the canvas's resolution and
 * scaled up. It is two wide, faint, round-capped strokes — soft by nature —
 * so a third of the pixels look identical once stretched, and the raster
 * cost, which is width times length times pixels, falls by nine. Measured
 * on the five-strand braid at 2560 wide: 21ms a frame to 11.
 */
export const HALO_SCALE = 1 / 3;

/**
 * The sea is painted at a third of the resolution and stretched over the
 * frame, for the same reason the halo is — by the page's canvas, and by
 * the engine's bridge as the softness of what it draws there.
 *
 * Nine translucent strips the width of the scene are a full screen of
 * alpha blending every frame, and that alone held the bridge at three
 * times the frame budget on a 1440p display while the profile showed the
 * script idle — turning the strips off brought it back to the floor and
 * changing their count did nothing, because the cost is the area, not the
 * geometry. Water is smooth and the swells are tens of pixels apart, so a
 * third of the pixels is a ninth of the blending and nothing anyone can
 * see.
 */
export const SEA_SCALE = 1 / 3;
