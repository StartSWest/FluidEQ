/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ITrayView, TTrayMark, TTraySurfaceFactory } from '../trayView';
import type { ITrayHost } from './trayHostProcess';
import type { ITrayHostState } from './trayHostWire';

/**
 * The .ico itself for every mark: the tray picks the drawing made for the
 * scale the menu opens at, as the notification area's icon does.
 */
const markIcon = (
  mark: TTrayMark | undefined,
  marks: ITrayView['marks'],
): string | undefined => {
  if (mark === 'update') {
    return marks.update;
  }
  if (mark === 'app') {
    return marks.tinted?.file ?? marks.plain;
  }
  return undefined;
};

/** What `tray.ts` decided, in the words FluidEQ-Tray reads. */
export const trayHostStateOf = (view: ITrayView): ITrayHostState => ({
  tooltip: view.tooltip,
  icon: view.icon,
  menu: view.menu.map(({ id, label, mark, separatorAfter }) => {
    const icon = markIcon(mark, view.marks);
    return {
      id,
      label,
      ...(icon ? { icon } : {}),
      ...(separatorAfter ? { separatorAfter } : {}),
    };
  }),
});

/** FluidEQ-Tray as the surface `tray.ts` draws on. */
export const nativeTraySurface =
  (host: ITrayHost): TTraySurfaceFactory =>
  (pressed) => {
    host.onPressed(pressed);
    return {
      show: (view) => host.show(trayHostStateOf(view)),
      destroy: () => host.close(),
    };
  };
