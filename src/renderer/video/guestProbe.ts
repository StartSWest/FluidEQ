/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Navigation and title changes can ask the same question many times while
 * Electron is still waiting for the document to load. Each queued script
 * adds its own main-process load listener. Keep one read in flight, then
 * read the latest state once if another event arrived in the meantime.
 * A superseded answer must not describe a page we have already left.
 */
const createGuestProbe = (
  read: () => Promise<unknown>,
  accept: (answer: unknown) => void,
) => {
  let pending = false;
  let wanted = false;
  let disposed = false;
  const drain = async () => {
    pending = true;
    try {
      while (wanted && !disposed) {
        wanted = false;
        try {
          const answer = await read();
          if (!disposed && !wanted) {
            accept(answer);
          }
        } catch {
          // A guest can navigate or close while its script is in flight.
        }
      }
    } finally {
      pending = false;
    }
  };
  return {
    refresh: () => {
      if (disposed) {
        return;
      }
      wanted = true;
      if (!pending) {
        drain().catch(() => undefined);
      }
    },
    dispose: () => {
      disposed = true;
      wanted = false;
    },
  };
};

export default createGuestProbe;
