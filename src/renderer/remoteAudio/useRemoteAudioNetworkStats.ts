/* FluidEQ — GPL-3.0-or-later */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ILanRemoteAudioNetworkStats } from '../../common/remoteAudio';
import { createSteadyReadout, type ISteadyReadout } from './steadyReadout';

/** The rates are shown in tenths of a megabit; the readout works in those. */
const TENTHS_OF_MEGABIT = 100_000 / 8;

const keyOf = (stats: ILanRemoteAudioNetworkStats) =>
  `${stats.direction}\n${stats.peerId}`;

/**
 * What each link carries, each way, as the lanes show it.
 *
 * Main reports every quarter second, and over Wi-Fi a quarter second can
 * hold half a second of packets or none: the raw figure moved with every
 * burst, and the two computers could show different figures for the same
 * stream. Each direction now reads as an average
 * (`steadyReadout.ts`) that moves when the stream really does.
 */
const useRemoteAudioNetworkStats = (active: boolean) => {
  const [networkStats, setNetworkStats] = useState<
    ILanRemoteAudioNetworkStats[]
  >([]);
  const readouts = useRef(new Map<string, ISteadyReadout>());

  useEffect(() => {
    if (!active) {
      readouts.current.clear();
      setNetworkStats([]);
      return undefined;
    }
    return window.electron?.ipcRenderer.onRemoteAudioLanNetwork?.((stats) => {
      const key = keyOf(stats);
      let readout = readouts.current.get(key);
      if (!readout) {
        readout = createSteadyReadout();
        readouts.current.set(key, readout);
      }
      const tenths = readout.next(
        stats.bytesPerSecond / TENTHS_OF_MEGABIT,
        performance.now(),
      );
      setNetworkStats((current) => {
        const previous = current.find((entry) => keyOf(entry) === key);
        const bytesPerSecond =
          tenths === undefined
            ? (previous?.bytesPerSecond ?? stats.bytesPerSecond)
            : tenths * TENTHS_OF_MEGABIT;
        return [
          ...current.filter((entry) => keyOf(entry) !== key),
          { ...stats, bytesPerSecond },
        ];
      });
    });
  }, [active]);

  const clearNetworkStats = useCallback(() => {
    readouts.current.clear();
    setNetworkStats([]);
  }, []);
  const removeNetworkPeer = useCallback((peerId: string) => {
    [...readouts.current.keys()]
      .filter((key) => key.endsWith(`\n${peerId}`))
      .forEach((key) => readouts.current.delete(key));
    setNetworkStats((current) =>
      current.filter((stats) => stats.peerId !== peerId),
    );
  }, []);
  return { clearNetworkStats, networkStats, removeNetworkPeer };
};

export default useRemoteAudioNetworkStats;
