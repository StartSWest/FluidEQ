/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import type { TRemoteAudioMeterListener } from './meter';

/**
 * Above this peak, a computer's sound is somebody's sound: about -70 dBFS,
 * under any recording's own floor and over the zeros a quiet stream carries.
 */
const SOUNDING_PEAK = 0.0003;

/**
 * How long a computer's sound may be silent and still be called playing: the
 * gap between two songs, a pause in speech. Measured between the readings
 * themselves — a stream keeps arriving through silence, as zeros, so the
 * silence is read off the stream, never waited for.
 */
const SILENCE_HOLD_MS = 4000;

/**
 * Which of the arriving computers is sending sound right now, by id.
 *
 * A computer that is linked and streaming is not necessarily playing
 * anything — its stream goes on, silent, between songs and with nothing
 * open — and a lag shown for it then describes no sound at all (Ivan,
 * 2026-10-02: "don't show the network lag if the audio is not coming from
 * the network"). Each one counts as sounding from the first reading over
 * the floor until it has been under it for `SILENCE_HOLD_MS`. Only a change
 * is published, so the readings, many a second, redraw nothing.
 */
const useIncomingSounding = (
  subscribeMeter: (listener: TRemoteAudioMeterListener) => () => void,
  arrivingIds: readonly string[],
): Readonly<Record<string, boolean>> => {
  const [sounding, setSounding] = useState<Readonly<Record<string, boolean>>>(
    {},
  );
  const lastSound = useRef(new Map<string, number>());
  // Peer ids never contain a newline: they are the transport's own tokens.
  const key = [...arrivingIds].sort().join('\n');
  const arrivingRef = useRef<readonly string[]>([]);

  useEffect(() => {
    const ids = key === '' ? [] : key.split('\n');
    arrivingRef.current = ids;
    [...lastSound.current.keys()].forEach((id) => {
      if (!ids.includes(id)) {
        lastSound.current.delete(id);
      }
    });
    setSounding((previous) =>
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
        if (id === undefined || !arrivingRef.current.includes(id)) {
          return;
        }
        const now = performance.now();
        if (meter.peak > SOUNDING_PEAK) {
          lastSound.current.set(id, now);
        }
        const heard = lastSound.current.get(id);
        const isSounding = heard !== undefined && now - heard < SILENCE_HOLD_MS;
        setSounding((previous) =>
          (previous[id] ?? false) === isSounding
            ? previous
            : { ...previous, [id]: isSounding },
        );
      }),
    [subscribeMeter],
  );

  return sounding;
};

export default useIncomingSounding;
