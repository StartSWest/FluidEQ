/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The taskbar icon in the window's colours, between the window that draws it
 * (`renderer/utils/taskbarIconArt.ts`) and main, which sets it
 * (`main/taskbarIcon.ts`).
 */

export const TASKBAR_ICON_CHANNEL = 'taskbar-icon-set';

/**
 * Every size the icon is drawn at: the taskbar's and the window corner's at
 * each display scale (16 and 32 at 100%, up to 48 and 96 at 300%), and 256
 * for Alt+Tab's large view.
 */
export const TASKBAR_ICON_SIZES = [
  16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 256,
] as const;

/** One drawing: `size` × `size` pixels, RGBA, not premultiplied. */
export interface ITaskbarIconImage {
  size: number;
  rgba: Uint8Array;
}

/**
 * The installed icon, while the window wears the app's own colours; or the
 * icon drawn in the colours it wears now, one drawing per size.
 */
export type TTaskbarIconRequest =
  { kind: 'stock' } | { kind: 'drawn'; images: ITaskbarIconImage[] };
