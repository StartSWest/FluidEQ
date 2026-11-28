/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { randomUUID } from 'crypto';
import { mayPlayLook } from '../../common/sceneStore';
import type { ILapsedScene, ILapseOffer } from '../../common/subscription';
import type { ISceneOwnership } from '../plus/sceneOwnership';
import type { ISubscriptionAccount } from './subscriptionAccount';
import type { ISubscriptionRecords } from './subscriptionRecord';

/**
 * What happens on this computer when Plus ends (ported from FluidWallpapers,
 * the coordinator's rulings there).
 *
 * Playing stops on its own, at once: `mayPlayLook` no longer plays a scene
 * the account had only through Plus, so the graph, the desktop and the
 * lights each let it go the moment the row says so (`sceneOwnership.ts`).
 * This acts on the ending itself, and only once the server has confirmed
 * it, or the offline grace ran out with the server unreachable
 * (`ISubscriptionAccount.endConfirmed`), never on a missing, late or failed
 * read. Nothing at all is done for a suspended account: its store plays
 * nothing, not even what it bought, so it cannot say what was bought. Then:
 *
 * - their downloads are deleted from this computer: the ones it added
 *   through Plus (`subscriptionRecord.ts`), less every one the account owns
 *   now (got with a credit since, or its own). Nothing else is touched;
 * - an offer lists them (keep one with a credit, or Plus again) until it is
 *   put away or the account has Plus again;
 * - the log says what stopped and what was deleted.
 *
 * Plus again plays them again; each is added again from Scenes. Checked
 * whenever the account's Plus changes, one check at a time; nothing waits
 * on a clock. The deletion is made in the same turn as the confirmation it
 * rests on, with nothing awaited between them, so no answer can land in
 * between: Plus back meanwhile keeps its downloads.
 */

export interface ISubscriptionLapse {
  /** Acts on an ending if one is confirmed and not acted on yet. Never throws. */
  check(): Promise<void>;
  dispose(): void;
}

export interface ISubscriptionLapseDeps {
  accountId: () => string | undefined;
  ownership: Pick<ISceneOwnership, 'known'>;
  subscription: Pick<
    ISubscriptionAccount,
    'subscribed' | 'endConfirmed' | 'onChange'
  >;
  /**
   * Deletes these downloads from the looks, as removing them by hand does,
   * and names each one deleted.
   */
  remove: (lookIds: readonly string[]) => ILapsedScene[];
  records: ISubscriptionRecords;
  now?: () => number;
  newId?: () => string;
  logger?: { info(message: string): void; warn(message: string): void };
}

export const createSubscriptionLapse = ({
  accountId: signedIn,
  ownership,
  subscription,
  remove,
  records,
  now = Date.now,
  newId = randomUUID,
  logger,
}: ISubscriptionLapseDeps): ISubscriptionLapse => {
  /** The last check asked for; each starts once the one before it ended. */
  let running: Promise<void> = Promise.resolve();
  /**
   * A check asked for that has not started yet: what it reads is still to
   * come, so a later ask is answered by it rather than by one more.
   */
  let queued: Promise<void> | undefined;
  let disposed = false;

  const act = () => {
    const accountId = signedIn();
    const store = ownership.known();
    if (!accountId || store?.suspension) {
      return;
    }
    if (subscription.subscribed()) {
      if (records.lapse(accountId)) {
        records.setLapse(accountId, undefined);
        logger?.info('Plus again: the offer made when it ended is put away');
      }
      return;
    }
    const downloads = records.downloads(accountId);
    if (downloads.length === 0 || !subscription.endConfirmed()) {
      return;
    }
    const stopped = downloads.filter(
      (lookId) => !mayPlayLook({ lookId, accountId, plus: false, store }),
    );
    const kept = downloads.length - stopped.length;
    const deleted = stopped.length > 0 ? remove(stopped) : [];
    records.dropDownloads(accountId, downloads);
    if (deleted.length > 0) {
      const shown = records.lapse(accountId)?.scenes ?? [];
      const fresh = new Set(deleted.map((scene) => scene.lookId));
      const offer: ILapseOffer = {
        id: newId(),
        at: new Date(now()).toISOString(),
        scenes: [
          ...shown.filter((scene) => !fresh.has(scene.lookId)),
          ...deleted,
        ],
      };
      records.setLapse(accountId, offer);
    }
    logger?.info(
      `Plus ended: ${stopped.length} scene(s) it played stopped (${stopped.join(', ') || 'none'}); ${deleted.length} download(s) deleted; ${kept} got with a credit or own since, kept`,
    );
  };

  const check = (): Promise<void> => {
    if (disposed) {
      return Promise.resolve();
    }
    if (queued) {
      return queued;
    }
    const before = running;
    const run = (async () => {
      await before;
      // Started: from here on, a change asks for one more check.
      queued = undefined;
      if (disposed) {
        return;
      }
      try {
        act();
      } catch (error) {
        logger?.warn(`The end of Plus could not be acted on: ${String(error)}`);
      }
    })();
    queued = run;
    running = run;
    return run;
  };

  const offChange = subscription.onChange(() => {
    check().catch(() => undefined);
  });

  return {
    check,
    dispose: () => {
      disposed = true;
      offChange();
    },
  };
};
