/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { WebContents } from 'electron';

/**
 * Work only a page can do, asked of FluidEQ's window for a chat's tool: the
 * artwork encoded as WebP (pack_artwork), a video's frames drawn
 * (video_frames). Each ask goes out on `channel` with an id and comes back
 * through `answer`, read by `read` so nothing but what was asked is taken.
 *
 * The member's Stop, or the page going away, answers 'no-window' at once:
 * an ask waits on the page and on nothing else.
 */
const createWindowAsks = <TAsk extends { id: number }, TAnswer>({
  channel,
  pageOf,
  signalOf,
  read,
}: {
  channel: string;
  pageOf(): WebContents | undefined;
  signalOf(projectId: string): AbortSignal;
  /** The page's answer, as nothing unless it is what was asked. */
  read(raw: unknown, ask: TAsk): TAnswer;
}) => {
  let next = 0;
  const pending = new Map<
    number,
    { ask: TAsk; resolve: (answer: TAnswer | 'no-window') => void }
  >();

  return {
    ask: (
      projectId: string,
      what: Omit<TAsk, 'id'>,
    ): Promise<TAnswer | 'no-window'> => {
      const page = pageOf();
      if (!page) {
        return Promise.resolve('no-window');
      }
      next += 1;
      const ask = { ...what, id: next } as TAsk;
      const signal = signalOf(projectId);
      return new Promise((resolve) => {
        const settle = (answer: TAnswer | 'no-window') => {
          signal.removeEventListener('abort', gone);
          page.removeListener('destroyed', gone);
          pending.delete(ask.id);
          resolve(answer);
        };
        // Stopped, or the page that was asked going away, answers nothing.
        function gone() {
          settle('no-window');
        }
        signal.addEventListener('abort', gone, { once: true });
        page.once('destroyed', gone);
        pending.set(ask.id, { ask, resolve: settle });
        page.send(channel, ask);
      });
    },
    /** The page's answer to the ask `id`; anything else is ignored. */
    answer: (id: unknown, raw: unknown) => {
      const waiting = typeof id === 'number' ? pending.get(id) : undefined;
      if (!waiting) {
        return;
      }
      waiting.resolve(read(raw, waiting.ask));
    },
    dispose: () => {
      [...pending.values()].forEach(({ resolve }) => resolve('no-window'));
      pending.clear();
    },
  };
};

export default createWindowAsks;
