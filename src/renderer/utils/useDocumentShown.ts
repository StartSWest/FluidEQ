/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
};

const isShown = () => !document.hidden;

/**
 * Whether the window can be seen at all: false while it is minimised or
 * hidden in the tray, from the browser's own `visibilitychange`. For what
 * is only decoration - an animation nobody can see is work for nothing,
 * and one left running behind a minimised window was paid for by the scenes.
 */
export default function useDocumentShown(): boolean {
  return useSyncExternalStore(subscribe, isShown, () => true);
}
