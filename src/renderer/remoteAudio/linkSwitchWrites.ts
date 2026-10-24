/* FluidEQ — GPL-3.0-or-later */
import type { ILinkSwitches } from '../../common/remoteAudio';

interface IWaiter {
  resolve(): void;
  reject(reason: unknown): void;
}
interface ILane {
  pending?: ILinkSwitches;
  waiters: IWaiter[];
}

/** Keep the UI immediate while IPC applies one update per PC at a time.
 * Intermediate drag positions coalesce; a later toggle keeps the complete
 * latest switch snapshot, so a queued volume cannot undo it. */
const createLinkSwitchWrites = (
  write: (key: string, value: ILinkSwitches) => Promise<void>,
) => {
  const lanes = new Map<string, ILane>();
  const drain = async (key: string, lane: ILane) => {
    while (lane.pending) {
      const value = lane.pending;
      const { waiters } = lane;
      lane.pending = undefined;
      lane.waiters = [];
      try {
        await write(key, value);
        waiters.forEach((waiter) => waiter.resolve());
      } catch (error) {
        waiters.forEach((waiter) => waiter.reject(error));
      }
    }
    lanes.delete(key);
  };
  return (key: string, value: ILinkSwitches) =>
    new Promise<void>((resolve, reject) => {
      const previous = lanes.get(key);
      const lane = previous ?? { waiters: [] };
      lane.pending = value;
      lane.waiters.push({ resolve, reject });
      if (!previous) {
        lanes.set(key, lane);
        // drain owns and reports every write failure to the waiting callers.
        drain(key, lane).catch(reject);
      }
    });
};
export default createLinkSwitchWrites;
