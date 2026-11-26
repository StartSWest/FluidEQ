/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The 2D context every Cover Flow picture is painted with: one kept in
 * memory, so reading it back never stops the window.
 *
 * Chromium puts a 2D canvas on the graphics card unless it is told the
 * canvas will be read, and every `getImageData` on one is then a
 * synchronous round trip to the GPU process — which, with the row's WebGL
 * frames queued in front of it, waits for them; so does drawing such a
 * canvas into one that is read. Each cover's light (`glowOf`) was read that
 * way: turning the row through 300 albums spent 27.9 s of 37.7 s of the main
 * thread in those reads, frames came every 54 ms and 267 tasks ran past
 * 50 ms (software GL, 2026-11-26; Ivan, the same day: "the cover art scroll
 * seems slow and slows down the app while scrolling"). In memory, a canvas
 * of a cover's size paints and reads in microseconds, and still uploads to
 * the row's texture in one copy.
 */
const readableContext = (
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D | null =>
  canvas.getContext('2d', { willReadFrequently: true });

export default readableContext;
