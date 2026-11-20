/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, useState } from 'react';

/**
 * Whether `value` has changed since the component mounted: a state that
 * swaps (Saved to Changed, Save to Saved) animates in when it swaps, and not
 * when the menu it is in opens, which arrives on its own.
 */
const useHasChanged = (value: string): boolean => {
  const first = useRef(value);
  const [hasChanged, setHasChanged] = useState(false);
  // Set during render, so the first frame of the new state already wears it.
  if (!hasChanged && value !== first.current) {
    setHasChanged(true);
  }
  return hasChanged;
};

export default useHasChanged;
