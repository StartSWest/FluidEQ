/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';

/**
 * Read again each time `isShown` turns true, and not when it starts so: the
 * caller's mount already reads.
 *
 * For what moves without anything announcing it — a headset's battery — and
 * is only worth knowing while it is on screen (Ivan, 2026-10-02: "just when
 * opening the output pane or the second output pane, no need to watch
 * constantly").
 */
const useReadWhenShown = (isShown: boolean, read: () => unknown): void => {
  const wasShown = useRef(isShown);
  useEffect(() => {
    if (isShown && !wasShown.current) {
      read();
    }
    wasShown.current = isShown;
  }, [isShown, read]);
};

export default useReadWhenShown;
