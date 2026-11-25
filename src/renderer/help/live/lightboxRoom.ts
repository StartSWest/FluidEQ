/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The room the lightbox gives an enlarged live figure, worked out from the
 * lightbox's own frame and never from what is drawn in it.
 *
 * WHY: the figure in the lightbox pulsed between two sizes, frame after frame,
 * at some window sizes (Ivan, 2026-11-25: "zooming in and out by 1 px makes it
 * glitch"), because its width was read inside the scroll area, which loses
 * its scrollbar's width when the drawing runs past the bottom — so the
 * scrollbar arriving shrank the figure until it fitted, the scrollbar left,
 * the width came back, and the figure grew past the bottom again. It ran
 * past the bottom in the first place because its height was a share of the
 * window (82%) rather than what the lightbox has under its title: at
 * 930 x 700 that share was 574px against 565px of room.
 *
 * So the width is the scroll area's whole width, scrollbar or not, and the
 * height is the lightbox's tallest less its edges, its title, the seam under
 * the title and the drawing's own padding: neither moves with the drawing,
 * so a fitted drawing never overflows and nothing feeds back.
 */
export interface ILightboxFrame {
  /** The scroll area's border-box width, which a scrollbar does not change. */
  readonly areaWidth: number;
  /** The scroll area's side borders, together. */
  readonly areaBordersX: number;
  /** The lightbox's resolved `max-height`. */
  readonly maxHeight: number;
  /** The lightbox's top and bottom borders, together. */
  readonly sheetBordersY: number;
  /** The title row's height. */
  readonly titleHeight: number;
  /** The seam between the title and the scroll area. */
  readonly seam: number;
  /** The drawing's padding, each axis's two sides together. */
  readonly paddingX: number;
  readonly paddingY: number;
}

export interface ILightboxRoom {
  readonly width: number;
  readonly height: number;
}

export const lightboxRoom = (frame: ILightboxFrame): ILightboxRoom => ({
  width: Math.max(0, frame.areaWidth - frame.areaBordersX - frame.paddingX),
  height: Math.max(
    0,
    frame.maxHeight -
      frame.sheetBordersY -
      frame.titleHeight -
      frame.seam -
      frame.paddingY,
  ),
});

/** Up to this many times its own size; past that a key is a poster. */
export const LIGHTBOX_MAX_ZOOM = 2.5;

/** How large a drawing of `width` x `height` is drawn in `room`. */
export const lightboxZoom = (
  room: ILightboxRoom | undefined,
  width: number,
  height: number,
): number =>
  room && room.width > 0 && room.height > 0
    ? Math.min(LIGHTBOX_MAX_ZOOM, room.width / width, room.height / height)
    : 1;
