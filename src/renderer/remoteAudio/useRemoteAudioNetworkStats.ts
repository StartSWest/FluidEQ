/* FluidEQ — GPL-3.0-or-later */

import { useCallback, useEffect, useState } from 'react';
import type { ILanRemoteAudioNetworkStats } from '../../common/remoteAudio';

const useRemoteAudioNetworkStats = (active: boolean) => {
  const [networkStats, setNetworkStats] = useState<
    ILanRemoteAudioNetworkStats[]
  >([]);

  useEffect(() => {
    if (!active) {
      setNetworkStats([]);
      return undefined;
    }
    return window.electron?.ipcRenderer.onRemoteAudioLanNetwork?.((stats) => {
      setNetworkStats((current) => [
        ...current.filter(
          (entry) =>
            entry.peerId !== stats.peerId ||
            entry.direction !== stats.direction,
        ),
        stats,
      ]);
    });
  }, [active]);

  const clearNetworkStats = useCallback(() => setNetworkStats([]), []);
  const removeNetworkPeer = useCallback(
    (peerId: string) =>
      setNetworkStats((current) =>
        current.filter((stats) => stats.peerId !== peerId),
      ),
    [],
  );
  return { clearNetworkStats, networkStats, removeNetworkPeer };
};

export default useRemoteAudioNetworkStats;
