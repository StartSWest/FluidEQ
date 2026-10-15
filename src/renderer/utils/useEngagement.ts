/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FocusEvent, useRef } from 'react';

export interface IEngagementHandlers {
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onBlur?: () => void;
}

/**
 * Whether a control is being worked: under the pointer, or focused from the
 * keyboard. For a picture that shows what the control does while it does it.
 *
 * A drag needs nothing of its own: the knob captures the pointer, so the
 * pointer counts as over it until the drag ends, wherever that is. A click's
 * focus does not count — the knob keeps focus after a drag, and a picture
 * that stayed up until the next click elsewhere would outstay its use — so
 * focus counts only where the browser draws a focus ring for it.
 */
const useEngagement = (
  onEngage: ((engaged: boolean) => void) | undefined,
): IEngagementHandlers => {
  const hovered = useRef(false);
  const focused = useRef(false);
  if (onEngage === undefined) {
    return {};
  }
  const report = () => onEngage(hovered.current || focused.current);
  return {
    onPointerEnter: () => {
      hovered.current = true;
      report();
    },
    onPointerLeave: () => {
      hovered.current = false;
      report();
    },
    onFocus: (event) => {
      focused.current = event.target.matches(':focus-visible');
      report();
    },
    onBlur: () => {
      focused.current = false;
      report();
    },
  };
};

export default useEngagement;
