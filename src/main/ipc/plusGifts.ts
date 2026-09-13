import { ipcMain } from 'electron';
import {
  isGiftEmail,
  PLUS_GIFT_NOTE_MAX,
  type IPlusGift,
} from '../../common/plusGifts';
import type { IGalleryAccess } from '../plus/galleryAccess';
import {
  givePlus,
  listPlusGifts,
  takeBackPlus,
  type TPlusGiftFailure,
} from '../plus/plusGiftsApi';

/**
 * The admin's Plus gifts, over IPC: the list, giving, and taking back.
 *
 * Offering the page is a courtesy and nothing more: a member who rebuilt the
 * app without the admin check still gets `admin_required` from the server on
 * every call, because that is where the rule lives. What the page sends is
 * checked here the way the server checks it, so a mistyped address is said
 * on the page rather than as a server failure.
 */

export type TPlusGiftsListOutcome =
  { ok: true; gifts: IPlusGift[] } | { ok: false; reason: TPlusGiftFailure };

export type TPlusGiftActOutcome =
  { ok: true } | { ok: false; reason: TPlusGiftFailure };

const CHANNELS = [
  'plus-gifts-list',
  'plus-gifts-give',
  'plus-gifts-take-back',
] as const;

/** A gift from the page, rebuilt from only the parts that check out. */
const readGift = (value: unknown, now: number) => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.email !== 'string' || !isGiftEmail(raw.email)) {
    return undefined;
  }
  const note = typeof raw.note === 'string' ? raw.note.trim() : '';
  if (note.length > PLUS_GIFT_NOTE_MAX) {
    return undefined;
  }
  const until =
    typeof raw.until === 'number' && Number.isFinite(raw.until)
      ? raw.until
      : undefined;
  if (raw.until !== undefined && (until === undefined || until <= now)) {
    return undefined;
  }
  return {
    email: raw.email.trim().toLowerCase(),
    ...(note ? { note } : {}),
    ...(until !== undefined ? { until } : {}),
  };
};

export const registerPlusGiftsIpc = ({
  access,
  now = Date.now,
}: {
  access: IGalleryAccess;
  now?: () => number;
}) => {
  /** The token for this account, and nothing once a different one signs in. */
  const authFor = async (me: string | undefined) => {
    const auth = me ? await access.auth() : undefined;
    return auth && access.accountId() === me ? auth : undefined;
  };

  ipcMain.handle(
    'plus-gifts-list',
    async (): Promise<TPlusGiftsListOutcome> => {
      const me = access.accountId();
      const auth = await authFor(me);
      if (!auth) {
        return { ok: false, reason: 'signed-out' };
      }
      const outcome = await listPlusGifts(auth);
      return access.accountId() === me
        ? outcome
        : { ok: false, reason: 'signed-out' };
    },
  );

  ipcMain.handle(
    'plus-gifts-give',
    async (_event, rawGift: unknown): Promise<TPlusGiftActOutcome> => {
      const gift = readGift(rawGift, now());
      if (!gift) {
        return { ok: false, reason: 'invalid' };
      }
      const auth = await authFor(access.accountId());
      return auth ? givePlus(auth, gift) : { ok: false, reason: 'signed-out' };
    },
  );

  ipcMain.handle(
    'plus-gifts-take-back',
    async (_event, email: unknown): Promise<TPlusGiftActOutcome> => {
      if (typeof email !== 'string' || !isGiftEmail(email)) {
        return { ok: false, reason: 'invalid' };
      }
      const auth = await authFor(access.accountId());
      return auth
        ? takeBackPlus(auth, email.trim().toLowerCase())
        : { ok: false, reason: 'signed-out' };
    },
  );

  return {
    dispose: () => {
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
