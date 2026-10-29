/* FluidEQ — GPL-3.0-or-later */

/** Control requests may overlap while a native device is opening. Share its
 * actual owner, and finish its close before a replacement can open: closing
 * an old UI session must never send reset/close to a newer native player. */
export const createAudioLeasePool = <T>(
  start: (ids: () => readonly number[]) => Promise<T>,
  close: (value: T) => void | Promise<void>,
) => {
  interface ISession {
    ids: Set<number>;
    ready: Promise<T>;
    value?: T;
  }
  let current: ISession | undefined;
  let closing = Promise.resolve();
  const release = (id: number): Promise<void> => {
    const session = current;
    if (!session || !session.ids.delete(id) || session.ids.size > 0) {
      return Promise.resolve();
    }
    current = undefined;
    const finished = session.ready.then(close, () => undefined);
    // The caller still receives a close failure. Sequencing the next owner
    // must not leave a recoverable device permanently poisoned by that error.
    closing = finished.catch(() => undefined);
    return finished;
  };
  return {
    async acquire(id: number): Promise<void> {
      if ((current?.ids.size ?? 0) >= 16) {
        throw new Error('Share Audio lease limit reached.');
      }
      if (!current) {
        const ids = new Set<number>();
        const session: ISession = {
          ids,
          ready: closing.then(() => start(() => [...ids])),
        };
        current = session;
        session.ready = session.ready.then((value) => {
          session.value = value;
          return value;
        });
      }
      const session = current;
      session.ids.add(id);
      try {
        await session.ready;
        // A failure/close may arrive while native startup is resolving. Do
        // not acknowledge an already released owner as a successful open.
        if (!session.ids.has(id)) {
          throw new Error('Share Audio owner is closed.');
        }
      } catch (error) {
        session.ids.delete(id);
        if (current === session && session.ids.size === 0) {
          current = undefined;
        }
        throw error;
      }
    },
    get(id: number): T {
      if (!current?.ids.has(id) || current.value === undefined) {
        throw new Error('Share Audio owner is closed.');
      }
      return current.value;
    },
    release,
  };
};
