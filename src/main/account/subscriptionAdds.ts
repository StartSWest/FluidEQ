/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { parseMemberLookId } from '../../common/memberScenes';
import { FLUIDEQ_CREATOR_ID } from '../../common/plusGallery';
import { isPremiumLookId } from '../../common/scenePacks';
import { mayPlayLook } from '../../common/sceneStore';
import type { IGalleryAuth } from '../plus/galleryAccess';
import { rpc } from '../plus/galleryApi';
import type { ISceneOwnership } from '../plus/sceneOwnership';
import type { ISubscriptionAccount } from './subscriptionAccount';
import type { ISubscriptionRecords } from './subscriptionRecord';
import { refusalOf } from './subscriptionService';

/**
 * What a scene added from Scenes means to Plus, once it is in the looks
 * (`ipc/plusGallery.ts`'s Add):
 *
 * - **A download of Plus's own**, when the account has the scene only
 *   through Plus: not got with a credit, not its own. These, and nothing
 *   else, are deleted from this computer when Plus ends
 *   (`subscriptionLapse.ts`).
 * - **The claim** (premium 0122, `claim_library_scene`): a subscriber's
 *   deliberate add of a member's scene earns its maker half a credit, once
 *   per subscriber and scene. Sent once; the server's `claimed` is kept on
 *   disk per account and never sent again. Nothing is claimed for FluidEQ's
 *   own scenes, its helper accounts' (filed under FluidEQ, 0121), or the
 *   account's own. The claim never holds the add up, and a failure is
 *   logged and asked again on the next add.
 */

export interface ISubscriptionAdds {
  /** A scene was added to this computer's looks. Never throws. */
  added(lookId: string): Promise<void>;
}

export interface ISubscriptionAddsDeps {
  accountId: () => string | undefined;
  subscription: Pick<ISubscriptionAccount, 'answer' | 'subscribed'>;
  ownership: Pick<ISceneOwnership, 'known'>;
  records: ISubscriptionRecords;
  auth: () => Promise<IGalleryAuth | undefined>;
  logger?: { info(message: string): void; warn(message: string): void };
}

export const createSubscriptionAdds = ({
  accountId,
  subscription,
  ownership,
  records,
  auth,
  logger,
}: ISubscriptionAddsDeps): ISubscriptionAdds => {
  /** Claims asked for in this run (in flight, or not recorded). */
  const asked = new Set<string>();

  /** The account plays this scene through Plus alone. */
  const throughPlusOnly = (id: string, lookId: string) =>
    subscription.subscribed() &&
    !mayPlayLook({
      lookId,
      accountId: id,
      plus: false,
      store: ownership.known(),
    });

  const claim = async (id: string, lookId: string): Promise<void> => {
    const member = parseMemberLookId(lookId);
    const helpers = ownership.known()?.fluideqHelpers ?? [];
    if (
      !member ||
      member.authorId === id.toLowerCase() ||
      member.authorId === FLUIDEQ_CREATOR_ID ||
      helpers.includes(member.authorId) ||
      subscription.answer()?.aware !== true
    ) {
      return;
    }
    const key = `${id}:${lookId}`;
    if (records.claimed(id, lookId) || asked.has(key)) {
      return;
    }
    // Held while this one is decided, so two adds at once send one claim.
    // Only a claim the server answered keeps it for the rest of the run: one
    // never sent is asked again on the next add.
    asked.add(key);
    let response: Response;
    try {
      const token = await auth();
      if (!token || accountId() !== id) {
        asked.delete(key);
        return;
      }
      response = await rpc(token, 'claim_library_scene', {
        p_author: member.authorId,
        p_scene: member.packId,
      });
    } catch (error) {
      asked.delete(key);
      logger?.warn(
        `The claim of ${lookId} could not be sent: ${String(error)}`,
      );
      return;
    }
    if (!response.ok) {
      const refusal = await refusalOf(response);
      logger?.warn(
        `The claim of ${lookId} was refused: ${response.status} ${refusal ?? 'without a word'}`,
      );
      return;
    }
    let answer: Record<string, unknown> | undefined;
    try {
      const body: unknown = await response.json();
      answer =
        typeof body === 'object' && body !== null
          ? (body as Record<string, unknown>)
          : undefined;
    } catch {
      answer = undefined;
    }
    if (answer?.claimed === true) {
      if (accountId() === id) {
        records.addClaim(id, lookId);
      }
      logger?.info(
        `Claimed ${lookId} for its maker${answer.earned === true ? ': half a credit earned' : ': nothing more to earn'}`,
      );
    } else {
      // Not recorded (an unpaid period): asked again in a later run.
      logger?.info(`The claim of ${lookId} was not recorded by the server`);
    }
  };

  return {
    added: async (lookId) => {
      const id = accountId();
      if (
        !id ||
        (!isPremiumLookId(lookId) && !parseMemberLookId(lookId)) ||
        !throughPlusOnly(id, lookId)
      ) {
        return;
      }
      records.addDownload(id, lookId);
      try {
        await claim(id, lookId);
      } catch (error) {
        logger?.warn(`The claim of ${lookId} failed: ${String(error)}`);
      }
    },
  };
};
