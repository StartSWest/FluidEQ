/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IStudioChat, TStudioChatRestore } from '../../common/studioChat';
import type createChatWindow from './chatWindow';

interface IAnimatorHandlersDeps {
  handle: ReturnType<typeof createChatWindow>['handle'];
  /** An animation's animator chat in the open project, by the animation's name. */
  load(name: unknown): IStudioChat | undefined;
  send(raw: unknown): Promise<void>;
  retry(raw: unknown): Promise<void>;
  sendNow(raw: unknown): Promise<void>;
  stop(name: unknown): void;
  unqueue(name: unknown, id: string): void;
  /** One of the animator's replies' versions brought back. */
  restore(name: unknown, entryId: string): TStudioChatRestore;
}

/**
 * What the window asks of an animation's animator: its own channels beside
 * the scene chat's, so a message for one can never reach the other. Each
 * names the animation; the project is always the open one.
 */
const registerAnimatorHandlers = ({
  handle,
  load,
  send,
  retry,
  sendNow,
  stop,
  unqueue,
  restore,
}: IAnimatorHandlersDeps) => {
  handle('studio-animator-load', undefined, load);
  handle('studio-animator-send', undefined, send);
  handle('studio-animator-retry', undefined, retry);
  handle('studio-animator-send-now', undefined, sendNow);
  handle('studio-animator-stop', undefined, stop);
  handle<TStudioChatRestore>(
    'studio-animator-restore',
    { ok: false, reason: 'no-project' },
    (raw) => {
      const { animation, entryId } =
        typeof raw === 'object' && raw !== null
          ? (raw as { animation?: unknown; entryId?: unknown })
          : {};
      return typeof entryId === 'string'
        ? restore(animation, entryId)
        : { ok: false, reason: 'failed' };
    },
  );
  // One argument, as every handler here takes: the animation and the message.
  handle('studio-animator-unqueue', undefined, (raw) => {
    const { animation, id } =
      typeof raw === 'object' && raw !== null
        ? (raw as { animation?: unknown; id?: unknown })
        : {};
    if (typeof id === 'string') {
      unqueue(animation, id);
    }
  });
};

export default registerAnimatorHandlers;
