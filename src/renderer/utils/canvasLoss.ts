/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A 2D canvas through a loss of the GPU.
 *
 * A 2D canvas the size of a graph lives on the GPU, and when Chromium's GPU
 * process goes — a crash, a driver reset, a laptop switching chips — every
 * such canvas loses its pixels at once. Chromium fires `contextlost`, makes
 * a new backing store once the GPU is back, and fires `contextrestored` on a
 * canvas that is now EMPTY, with its context reset to defaults. Whatever
 * drew it has to draw it again; a picture drawn once and kept (a print, a
 * sprite) is simply gone.
 *
 * NEVER PREVENT `contextlost` ON A 2D CANVAS. For WebGL, preventing it is how
 * a page asks for its context back; for a 2D context the HTML standard reads
 * it the other way round — a cancelled `contextlost` means "do not restore" —
 * and Chromium then never does. The graph's trace canvas prevented it, the
 * GPU process crashed on 2026-11-20, and the canvas stayed lost for good:
 * Chromium paints a lost 2D canvas solid white with a broken-picture mark in
 * its corner, so the whole plot turned white over the dark window and stayed
 * so until a reload. Reproduced in a scratch Electron 43.8.10 with a real GPU
 * process crash (chrome://gpucrash): the prevented canvas white for good, the
 * one beside it, not prevented, restored half a second later.
 *
 * While the context is lost the canvas is hidden, so what shows is the
 * surface under it — the plot's own ground — and never Chromium's white.
 */

type TPictureCanvas = HTMLCanvasElement | OffscreenCanvas;

/**
 * Watches a canvas on the screen: hidden from its loss to its restore, then
 * shown and `redraw` asked for, because it comes back empty. Answers the
 * function that stops watching.
 */
export const watchCanvasLoss = (
  canvas: HTMLCanvasElement,
  redraw: () => void,
): (() => void) => {
  const lost = () => {
    // eslint-disable-next-line no-param-reassign -- hiding the canvas is the point
    canvas.style.visibility = 'hidden';
  };
  const restored = () => {
    // eslint-disable-next-line no-param-reassign -- and showing it again
    canvas.style.visibility = '';
    redraw();
  };
  canvas.addEventListener('contextlost', lost);
  canvas.addEventListener('contextrestored', restored);
  return () => {
    canvas.removeEventListener('contextlost', lost);
    canvas.removeEventListener('contextrestored', restored);
  };
};

const watched = new WeakSet<TPictureCanvas>();
const emptied = new WeakSet<TPictureCanvas>();

/**
 * Marks a canvas kept off the screen as a picture drawn once and reused — a
 * print laid under every frame, a sprite. Answers the canvas.
 *
 * Only a canvas big enough to live on the GPU can lose its picture (Chromium
 * keeps a small one, under about 128 by 128, in memory), but marking a small
 * one costs nothing and keeps the rule simple: every kept picture is marked.
 */
export const keepCanvasPicture = <T extends TPictureCanvas>(canvas: T): T => {
  if (!watched.has(canvas)) {
    watched.add(canvas);
    // Typed per kind: the two canvases' event maps are not one type.
    (canvas as EventTarget).addEventListener('contextrestored', () => {
      emptied.add(canvas);
    });
  }
  return canvas;
};

/**
 * Whether a kept picture came back empty from a loss of the GPU since it was
 * last asked: true once per loss, and the picture is to be drawn again.
 */
export const takeCanvasEmptied = (canvas: TPictureCanvas): boolean =>
  emptied.delete(canvas);
