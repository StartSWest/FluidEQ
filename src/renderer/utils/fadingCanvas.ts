/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Chromium's high-precision canvas, asked for by name.
 *
 * `colorType` is not in TypeScript's DOM types yet, so it is written on an
 * ordinary object first and that object is then taken as the settings type,
 * which it satisfies through `alpha`; handed to `getContext` as a literal,
 * the call resolves to the untyped overload instead. A browser that does not
 * know the option ignores it and hands back the usual 8-bit canvas.
 */
const WITH_COLOR_TYPE = { alpha: true, colorType: 'float16' };
const PRECISE: CanvasRenderingContext2DSettings = WITH_COLOR_TYPE;

/**
 * A 2D context for a picture that leaves a trail — a scope that fades the
 * last frame a little instead of clearing it.
 *
 * On an 8-bit canvas that fade never finishes. Taking 16% off a pixel a few
 * steps from where it is going rounds straight back to where it was, so every
 * pixel stops short, each by however much its own history left: the trace's
 * ghost, and whatever was drawn there before — the phase meter's dial, before
 * a switch to the scope — stay on for good (Ivan, 2026-09-22: "I can see the
 * meter behind"). Measured in the running window, 16% a frame: faded toward
 * the card's colour, 8 bits stopped 5 steps off it in green; faded toward
 * transparent, 8 bits stuck at 3/255 for good, while this canvas was clear
 * after 40 frames.
 *
 * Fade such a canvas toward TRANSPARENT (`fadeTrail`), never toward a colour:
 * even with the fraction kept, a colour is rounded before it is blended, and
 * the fade toward it settled 3 steps off the card — a rectangle of its own. A
 * canvas that fades away lets the card behind it show through, whatever that
 * card's colour is and whatever a scene has tinted it to.
 *
 * Only the first `getContext` on a canvas decides its kind, so this has to be
 * the first one.
 */
export const fadingContext = (
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D | null => canvas.getContext('2d', PRECISE);

/** Takes `amount` (0-1) of the last frame away, toward transparent. */
export const fadeTrail = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number,
) => {
  const operation = context.globalCompositeOperation;
  context.globalCompositeOperation = 'destination-out';
  context.fillStyle = `rgba(0, 0, 0, ${amount})`;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = operation;
};
