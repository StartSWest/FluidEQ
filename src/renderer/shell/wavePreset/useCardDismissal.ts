/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type FocusEvent,
  type KeyboardEvent,
  useCallback,
  useState,
} from 'react';

/**
 * The plate's card put away until the plate is left: by Escape, and by any
 * of its own presses, which have done what they were for.
 *
 * The card is shown by the stylesheet while the plate is pointed at or has
 * the keyboard's focus, so without this a press on "Open the Preset tab"
 * left it standing over the page it had just opened, and Escape could not
 * take it away from somebody who reached it with Tab. Leaving — the pointer
 * going, or the focus moving out of the plate and its card — brings it back
 * for the next time.
 */
const useCardDismissal = () => {
  const [isDismissed, setIsDismissed] = useState(false);
  const dismiss = useCallback(() => setIsDismissed(true), []);
  return {
    isDismissed,
    dismiss,
    /** For the element round the plate and its card. */
    onPointerLeave: () => setIsDismissed(false),
    onBlur: (event: FocusEvent<HTMLElement>) => {
      const next = event.relatedTarget;
      if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
        setIsDismissed(false);
      }
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Escape') {
        setIsDismissed(true);
      }
    },
  };
};

export default useCardDismissal;
