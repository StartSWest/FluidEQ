/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState, type RefObject } from 'react';
import observeShown from './observeShown';

/**
 * Whether anybody can see the element the returned ref is put on, as
 * `observeShown` answers it: scrolled out of its column, its tab hidden, the
 * window minimised or covered by something in full screen all count as not
 * seen. For decoration that moves on its own - a drift, a coin turning - so it
 * stands still while nobody is looking instead of animating for no one.
 *
 * True until the first answer, so what is on screen when it mounts never
 * starts still and then jumps into motion.
 */
export default function useShown<T extends Element>(): [
  RefObject<T | null>,
  boolean,
] {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const element = ref.current;
    return element ? observeShown(element, setShown) : undefined;
  }, []);
  return [ref, shown];
}
