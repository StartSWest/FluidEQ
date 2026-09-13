import { parsePlusGiftRow, type IPlusGift } from '../../common/plusGifts';
import type { IGalleryAuth } from './galleryAccess';
import { rpc, type TGalleryFailure } from './galleryApi';

/**
 * The admin's Plus gifts, spoken to with the account's own token. Whether the
 * account is the admin is the server's to say on every call (`require_admin`,
 * premium migration 0021); nothing here decides it.
 */

export type TPlusGiftFailure =
  | TGalleryFailure
  | 'forbidden'
  /** The server refused what was sent: an address, a note or an end. */
  | 'invalid';

const failureOf = (status: number): TPlusGiftFailure => {
  if (status === 401) {
    return 'signed-out';
  }
  // `admin_required` is insufficient_privilege, answered 403; the checks on
  // the address, note and end are invalid_parameter_value, answered 400.
  if (status === 403) {
    return 'forbidden';
  }
  return status === 400 ? 'invalid' : 'server';
};

export const listPlusGifts = async (
  auth: IGalleryAuth,
): Promise<
  { ok: true; gifts: IPlusGift[] } | { ok: false; reason: TPlusGiftFailure }
> => {
  let response: Response;
  try {
    response = await rpc(auth, 'admin_plus_gifts', {});
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (!response.ok) {
    return { ok: false, reason: failureOf(response.status) };
  }
  try {
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) {
      return { ok: false, reason: 'server' };
    }
    return {
      ok: true,
      gifts: rows.flatMap((row) => {
        const gift = parsePlusGiftRow(row);
        return gift ? [gift] : [];
      }),
    };
  } catch {
    return { ok: false, reason: 'server' };
  }
};

/** Gives Plus to an address, or changes the note and end of its gift. */
export const givePlus = async (
  auth: IGalleryAuth,
  gift: { email: string; note?: string; until?: number },
): Promise<{ ok: true } | { ok: false; reason: TPlusGiftFailure }> => {
  let response: Response;
  try {
    response = await rpc(auth, 'admin_give_plus', {
      p_email: gift.email,
      p_note: gift.note ?? null,
      p_until:
        gift.until === undefined ? null : new Date(gift.until).toISOString(),
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  return response.ok
    ? { ok: true }
    : { ok: false, reason: failureOf(response.status) };
};

export const takeBackPlus = async (
  auth: IGalleryAuth,
  email: string,
): Promise<{ ok: true } | { ok: false; reason: TPlusGiftFailure }> => {
  let response: Response;
  try {
    response = await rpc(auth, 'admin_take_back_plus', { p_email: email });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  return response.ok
    ? { ok: true }
    : { ok: false, reason: failureOf(response.status) };
};
