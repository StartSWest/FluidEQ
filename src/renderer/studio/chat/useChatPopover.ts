/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import { isInsideAnchoredMenu } from '../../widgets/AnchoredMenu';

/**
 * One of the chat's small panels hung off a control (`AnchoredMenu`): open
 * on the control's press, shut by a press anywhere else, by Escape, or by
 * the control again. The anchor is state rather than a ref, because the menu
 * places itself from it in an effect that a ref's arrival would not re-run.
 */
const useChatPopover = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      // The control's own press toggles it; counting it as outside would
      // shut the panel on mousedown and open it again on click.
      if (!isInsideAnchoredMenu(event.target) && !anchor?.contains(target)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        anchor?.focus();
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, anchor]);

  return {
    isOpen,
    anchor,
    setAnchor,
    toggle: () => setIsOpen((open) => !open),
    close: () => setIsOpen(false),
  };
};

export default useChatPopover;
