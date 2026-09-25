/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLiveAudioControl } from './LiveAudioContext';

/**
 * Keeps a running live capture open through the one commit in which
 * `switchKey` changes, when its owners trade places.
 *
 * The capture exists while something claims it and closes the moment nothing
 * does (`useLiveAudioCapture`). Going into the amp, everything behind it
 * sleeps (`<Activity>` in `App.tsx`) and lets go of its claim while the amp's
 * decks take theirs, and coming back is the same the other way round — all in
 * one commit, in which React runs every effect clean-up before any effect. So
 * the claims touched zero in between: the loopback closed and a new one was
 * negotiated, the amp's analyser starting blank each time.
 *
 * The bridge's claim is taken in a layout effect, which runs before any of
 * that commit's effects, and let go in an effect of the component calling
 * this — which React runs after every effect of the components below it, so
 * after the new owners have claimed. Call it from the component that renders
 * both sides of the switch, and nowhere lower.
 *
 * Only a capture already running is held. One that nothing wanted is not
 * started for a moment by a switch.
 */
export default function useCaptureBridge(switchKey: string): void {
  const { claim, isActive } = useLiveAudioControl();
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const heldRef = useRef<(() => void) | undefined>(undefined);

  useLayoutEffect(() => {
    if (isActiveRef.current) {
      heldRef.current?.();
      heldRef.current = claim('display');
    }
  }, [claim, switchKey]);

  useEffect(() => {
    const release = heldRef.current;
    heldRef.current = undefined;
    release?.();
  }, [claim, switchKey]);

  // Unmounted between the two (the whole tree failing): nothing is left held.
  useEffect(
    () => () => {
      heldRef.current?.();
      heldRef.current = undefined;
    },
    [],
  );
}
