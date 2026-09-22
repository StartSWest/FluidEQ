/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject, useEffect } from 'react';
import { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';

/**
 * Closes one of the player's menus on a press elsewhere and on Escape, like
 * every other menu in the app. The menu itself is portalled out of the
 * player, so a press inside it is asked about separately.
 */
const useMenuDismiss = (
  isOpen: boolean,
  holder: RefObject<HTMLElement | null>,
  close: () => void,
) => {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        !holder.current?.contains(event.target as Node) &&
        !isInsideAnchoredMenu(event.target)
      ) {
        close();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [close, holder, isOpen]);
};

export default useMenuDismiss;
