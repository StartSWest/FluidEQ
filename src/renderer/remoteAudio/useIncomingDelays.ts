/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import type { TRemoteAudioMeterListener } from './meter';
import { createSteadyReadout, type ISteadyReadout } from './steadyReadout';

/**
 * How far behind each linked computer's sound plays here, in milliseconds —
 * one figure for the Share page's lane, the second output's panel and the
 * player bar, so the three never disagree.
 *
 * Read from the playback meters (the playback buffer and the output device's
 * own, `nativeRemoteAudioPlayback.ts`) as an average that moves only when the
 * delay really does (`steadyReadout.ts`): the raw figure swings by a packet
 * with every block. Kept only for the computers whose sound is arriving now;
 * one that stops is forgotten, and starts its average afresh when it comes
 * back.
 */
const useIncomingDelays = (
  subscribeMeter: (listener: TRemoteAudioMeterListener) => () => void,
  arrivingIds: readonly string[],
): Readonly<Record<string, number>> => {
  const [delays, setDelays] = useState<Readonly<Record<string, number>>>({});
  const readouts = useRef(new Map<string, ISteadyReadout>());
  // Peer ids never contain a newline: they are the transport's own tokens.
  const key = [...arrivingIds].sort().join('\n');
  const arrivingRef = useRef<readonly string[]>([]);

  useEffect(() => {
    const ids = key === '' ? [] : key.split('\n');
    arrivingRef.current = ids;
    [...readouts.current.keys()].forEach((id) => {
      if (!ids.includes(id)) {
        readouts.current.delete(id);
      }
    });
    setDelays((previous) =>
      Object.keys(previous).every((id) => ids.includes(id))
        ? previous
        : Object.fromEntries(
            Object.entries(previous).filter(([id]) => ids.includes(id)),
          ),
    );
  }, [key]);

  useEffect(
    () =>
      subscribeMeter((meter) => {
        const id = meter.sourceId;
        if (
          id === undefined ||
          meter.bufferedMs === undefined ||
          !arrivingRef.current.includes(id)
        ) {
          return;
        }
        let readout = readouts.current.get(id);
        if (!readout) {
          readout = createSteadyReadout();
          readouts.current.set(id, readout);
        }
        const shown = readout.next(meter.bufferedMs, performance.now());
        if (shown !== undefined) {
          setDelays((previous) => ({ ...previous, [id]: shown }));
        }
      }),
    [subscribeMeter],
  );

  return delays;
};

export default useIncomingDelays;
