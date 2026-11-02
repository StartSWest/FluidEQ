/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ITaskbarIconImage } from '../common/taskbarIcon';

/**
 * What the notification area shows, apart from what draws it.
 *
 * `tray.ts` decides the icon, the tooltip and the menu; a surface draws them
 * and reports presses back by id. There are two: FluidEQ-Tray, the C++
 * program that also holds the engine's line (`nativeTray/`), and Electron's
 * own `Tray` (`trayElectron.ts`) wherever that program is not there to run.
 */

/** Every press the tray reports: its menu's items, and "open" for the icon. */
export type TTrayAction =
  'open' | 'recover-window' | 'install-update' | 'check-updates' | 'quit';

/** Which mark a menu item wears. */
export type TTrayMark = 'app' | 'update';

export interface ITrayMenuEntry {
  id: TTrayAction;
  label: string;
  mark?: TTrayMark;
  /** A separator follows it. */
  separatorAfter?: boolean;
}

/** The taskbar button's drawn icon, worn while "Tint app icon" is on. */
export interface ITrayTintedIcon {
  /** The drawn .ico, every size, for the notification area. */
  file: string;
  /** The drawings in it, for the menu's icon. */
  drawings: readonly ITaskbarIconImage[];
}

export interface ITrayView {
  /** The .ico in the notification area. */
  icon: string;
  tooltip: string;
  menu: ITrayMenuEntry[];
  /** The installed mark, the badged one and the drawn one, for the menu. */
  marks: {
    plain: string;
    update: string;
    tinted?: ITrayTintedIcon;
  };
}

export interface ITraySurface {
  show: (view: ITrayView) => void;
  /** Takes the icon down for good. */
  destroy: () => void;
}

/** Builds a surface that reports presses to `pressed`. */
export type TTraySurfaceFactory = (
  pressed: (action: TTrayAction) => void,
) => ITraySurface | undefined;
