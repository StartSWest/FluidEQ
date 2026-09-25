/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import type { ILampSound } from './lightingListener';

/**
 * A silent sound of the lamps' own, for while there is no capture to follow.
 *
 * The lamps are drawn on the audio clock, and the clock was the capture's: no
 * capture, no frames, and a desk that stays dark. There is none while one is
 * being opened, while Windows restarts one, while one is refused — which a
 * hidden FluidEQ saw attempt after attempt, backing off for minutes — or when
 * the output cannot be listened to at all. Ivan (2026-09-25): the lights show
 * whenever the option is on and a Plus look is chosen, music or not. So the
 * lamps listen to this instead: a context of their own playing nothing, whose
 * silence the listener hears as silence, and the scene flows at the member's
 * idle settings until the music can be heard.
 *
 * A stand-in, never the thing itself. Silence holds no media stream, and a
 * hidden window holding none runs at Windows' idle priority (measured: 4,
 * against 8 while the capture is held), where a busy machine can hold the
 * page back for seconds. The capture is what the lamps want; this only lights
 * the desk until it comes.
 *
 * On the default output, not `sinkId: { type: 'none' }`: a context with no
 * device renders on a clock the page drives, and it stopped altogether while
 * the window was hidden — exactly when this is needed.
 */
export default function useLampIdleClock(
  wanted: boolean,
): ILampSound | undefined {
  const [clock, setClock] = useState<ILampSound>();
  useEffect(() => {
    if (!wanted) {
      return undefined;
    }
    let context: AudioContext;
    try {
      context = new AudioContext();
    } catch (error) {
      // Mounted at the root: a throw here would take the whole window with
      // it. With no audio at all the desk keeps its last frame.
      console.error('The desk lights could not open an audio clock:', error);
      return undefined;
    }
    const source = context.createConstantSource();
    source.offset.value = 0;
    source.start();
    // A suspended context stops its clock and the desk with it; Windows
    // suspends one on its own when an output changes underneath it, so it is
    // resumed whenever it says it stopped (`useLiveOutputSpectrum.ts`).
    const resume = () => {
      if (context.state === 'suspended') {
        context.resume().catch(() => undefined);
      }
    };
    context.addEventListener('statechange', resume);
    resume();
    setClock({ context, source });
    return () => {
      context.removeEventListener('statechange', resume);
      setClock(undefined);
      source.stop();
      context.close().catch(() => undefined);
    };
  }, [wanted]);
  return clock;
}
