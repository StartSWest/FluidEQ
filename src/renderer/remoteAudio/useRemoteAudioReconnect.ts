/* FluidEQ — GPL-3.0-or-later */
import { useCallback, useEffect, useState } from 'react';

/** A reconnect asked for by hand: still trying, or no address answered. */
export type TReconnectState = 'trying' | 'missed';

/**
 * Reconnect by hand, from a computer's options menu, with the code saved for
 * it: what each computer's row says while it is tried and when it was not
 * found. Main answers when the round it starts ends, so "Reconnecting…" is
 * true for exactly as long as something is being tried. A row that links
 * again forgets it was missed.
 */
const useRemoteAudioReconnect = (linked: readonly string[]) => {
  const bridge = window.electron?.ipcRenderer;
  const [states, setStates] = useState<ReadonlyMap<string, TReconnectState>>(
    () => new Map(),
  );
  const linkedKey = linked.join('\n');
  useEffect(() => {
    const now = new Set(linkedKey.split('\n'));
    setStates((current) => {
      const missed = [...current].filter(
        ([computerId, state]) => state === 'missed' && now.has(computerId),
      );
      if (missed.length === 0) {
        return current;
      }
      const next = new Map(current);
      missed.forEach(([computerId]) => next.delete(computerId));
      return next;
    });
  }, [linkedKey]);
  const reconnect = useCallback(
    (computerId: string, target: { peerId?: string; computerId?: string }) => {
      const settle = (state?: TReconnectState) =>
        setStates((current) => {
          const next = new Map(current);
          if (state) {
            next.set(computerId, state);
          } else {
            next.delete(computerId);
          }
          return next;
        });
      settle('trying');
      (bridge?.reconnectRemoteAudioLan?.(target) ?? Promise.resolve(false))
        .catch(() => false)
        .then((linkedAgain) => settle(linkedAgain ? undefined : 'missed'))
        .catch(() => undefined);
    },
    [bridge],
  );
  return { reconnecting: states, reconnect };
};

export default useRemoteAudioReconnect;
