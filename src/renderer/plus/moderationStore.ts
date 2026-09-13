import { useSyncExternalStore } from 'react';
import type { TranslationKey } from 'common/i18n';
import type {
  IModerationStatus,
  IReportedScene,
  TModerationAction,
} from 'common/plusModeration';
import type { TModerationActOutcome } from 'main/ipc/plusModeration';
import { setGalleryNotice } from './galleryActions';
import { markGalleryStale } from './galleryStore';

/**
 * Whether this account is the admin, and how many reported scenes wait —
 * what the gallery needs to offer the queue at all, with its count.
 *
 * Kept per account, like the profile: an answer for one account is never
 * shown for another, and one arriving after a different account signed in is
 * dropped. A member is simply never offered the queue; the server would
 * refuse it anyway.
 */

interface IModerationState extends IModerationStatus {
  accountId?: string;
}

const NONE: IModerationState = { admin: false, open: 0 };

let state: IModerationState = NONE;
const listeners = new Set<() => void>();

const bridge = () => window.electron?.ipcRenderer;

const publish = (next: IModerationState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): IModerationState => state;

export const useModeration = (): IModerationState =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/**
 * Asks again for this account. What is on screen stays while it asks; a
 * failure keeps the last answer for the same account rather than taking the
 * queue away because the network blinked.
 */
export const refreshModeration = async (accountId: string | undefined) => {
  if (!accountId) {
    if (state !== NONE) {
      publish(NONE);
    }
    return;
  }
  if (state.accountId !== accountId) {
    publish({ ...NONE, accountId });
  }
  try {
    const outcome = await bridge()?.moderationStatus?.();
    if (outcome?.ok && state.accountId === accountId) {
      publish({ ...outcome.status, accountId });
    }
  } catch {
    // Offline or no handler: the account keeps whatever it was last told.
  }
};

/** The queue's own list answered with its length; the badge follows it. */
export const setOpenReports = (accountId: string | undefined, open: number) => {
  if (state.admin && state.accountId === accountId && state.open !== open) {
    publish({ ...state, open });
  }
};

const DONE: Record<TModerationAction, TranslationKey> = {
  'take-down': 'plus.moderation.done.takenDown',
  dismiss: 'plus.moderation.done.dismissed',
  restore: 'plus.moderation.done.restored',
};

/**
 * Sends one answer about a reported scene and says how it went on the
 * gallery's own line. Resolves whether the server accepted it. The same from
 * the queue and from the scene's own page, so the two can never word it or
 * follow it up differently.
 */
export const moderateReportedScene = async (
  entry: IReportedScene,
  action: TModerationAction,
  name: string,
): Promise<boolean> => {
  setGalleryNotice(undefined);
  let outcome: TModerationActOutcome | undefined;
  try {
    outcome = await bridge()?.moderateScene?.(
      action,
      entry.scene.authorId,
      entry.scene.sceneId,
    );
  } catch {
    outcome = undefined;
  }
  if (!outcome?.ok) {
    setGalleryNotice({
      ok: false,
      key:
        outcome?.reason === 'forbidden'
          ? 'plus.moderation.forbidden'
          : 'plus.moderation.failed',
    });
    return false;
  }
  setGalleryNotice({ ok: true, key: DONE[action], vars: { name } });
  if (action !== 'dismiss') {
    // The gallery's lists no longer match the server; the next look asks.
    markGalleryStale();
  }
  if (action !== 'restore' && state.admin && state.open > 0) {
    publish({ ...state, open: state.open - 1 });
  }
  return true;
};

/** For tests: a clean module between runs. */
export const resetModerationStore = () => {
  state = NONE;
  listeners.clear();
};
