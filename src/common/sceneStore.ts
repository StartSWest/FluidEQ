/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { memberLookId, parseMemberLookId } from './memberScenes';
import { FLUIDEQ_CREATOR_ID } from './plusGallery';
import { PACK_ID } from './scenePackFields';
import { isPremiumLookId, packIdOfLook, premiumLookId } from './scenePacks';

/**
 * Credits and the scenes an account has bought (premium migrations 0055 and
 * 0057). Ivan, 2026-10-18: "o las hacen ellos mismos o las compran" — a scene
 * is made by its owner or bought once for one credit and kept for good;
 * credits come in packs.
 *
 * The balance and the scenes are the server's (`my_store`); this is only
 * their shape on the way to the window, with every owned scene as the look id
 * the rest of the app already knows it by.
 */

export interface ICreditPack {
  id: string;
  credits: number;
  priceCents: number;
}

export interface ISceneStore {
  balance: number;
  starterClaimed: boolean;
  /** Look ids: `premium:<id>` for FluidEQ's own, `member:<author>:<id>`. */
  owned: string[];
  packs: ICreditPack[];
  /**
   * Ids of this account's own scenes in the gallery now (premium 0060): the
   * ones it plays everywhere for free. Absent from a server before 0060,
   * which said nothing either way.
   */
  published?: string[];
  /**
   * FluidEQ's scenes the admin made free for every account (premium 0061),
   * by scene id. Absent from a server before 0061.
   */
  free?: string[];
  /** This account is the admin, who owns every scene there is (0061). */
  everything?: boolean;
}

/** Every pack id the server sells, as the checkout takes it. */
export const CREDIT_PACK_ID = /^pack-[0-9]{1,4}$/;

/** What every scene costs: one credit (Ivan: "5 USD por 5 escenas"). */
export const SCENE_PRICE_CREDITS = 1;

/**
 * The free credits every confirmed account gets once (premium 0055's
 * `claim_starter_credits`); the terms quote it, so keep the two in step.
 */
export const STARTER_CREDITS = 3;

/**
 * The least an account that paid for Plus gets when Plus members move to
 * credits (Ivan, 2026-10-21: "que tengan al menos 5"). The terms promise it,
 * so the server's move has to grant at least this many.
 */
export const PLUS_MOVE_CREDITS = 5;

/**
 * The earlier versions of an owned scene this computer kept, newest first,
 * and the one it plays while that is not the newest (main's
 * `keptVersions.ts`). Empty for a scene not owned.
 */
export interface IKeptSceneVersions {
  versions: number[];
  playing?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWhole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

/**
 * The look id a bought scene plays under, or undefined for ids that are not a
 * scene's: FluidEQ's own account names its official scenes.
 */
export const lookIdOfOwned = (
  authorId: string,
  sceneId: string,
): string | undefined => {
  const author = authorId.toLowerCase();
  if (author === FLUIDEQ_CREATOR_ID) {
    return PACK_ID.test(sceneId) ? premiumLookId(sceneId) : undefined;
  }
  const lookId = memberLookId(author, sceneId);
  return parseMemberLookId(lookId) ? lookId : undefined;
};

const isOwnedLookId = (id: unknown): id is string =>
  typeof id === 'string' &&
  (isPremiumLookId(id)
    ? PACK_ID.test(packIdOfLook(id))
    : parseMemberLookId(id) !== undefined);

const isSceneIdList = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((id: unknown) => typeof id === 'string' && PACK_ID.test(id));

const readPack = (row: unknown): ICreditPack | undefined =>
  isRecord(row) &&
  typeof row.id === 'string' &&
  CREDIT_PACK_ID.test(row.id) &&
  isWhole(row.credits) &&
  row.credits > 0 &&
  isWhole(row.priceCents) &&
  row.priceCents > 0
    ? { id: row.id, credits: row.credits, priceCents: row.priceCents }
    : undefined;

/**
 * `my_store`'s answer, or undefined when any part of it does not read: a
 * store half-read would show a balance or a scene that is not there, which is
 * the one thing a page that takes money must never do.
 */
export const parseSceneStore = (value: unknown): ISceneStore | undefined => {
  if (
    !isRecord(value) ||
    !isWhole(value.balance) ||
    typeof value.starterClaimed !== 'boolean' ||
    !Array.isArray(value.owned) ||
    !Array.isArray(value.packs)
  ) {
    return undefined;
  }
  const owned = value.owned.flatMap((row: unknown): string[] => {
    const lookId =
      isRecord(row) &&
      typeof row.authorId === 'string' &&
      typeof row.sceneId === 'string'
        ? lookIdOfOwned(row.authorId, row.sceneId)
        : undefined;
    return lookId ? [lookId] : [];
  });
  const packs = value.packs.flatMap((row: unknown): ICreditPack[] => {
    const pack = readPack(row);
    return pack ? [pack] : [];
  });
  const { published, free, everything } = value;
  if (
    owned.length !== value.owned.length ||
    packs.length !== value.packs.length ||
    (published !== undefined && !isSceneIdList(published)) ||
    (free !== undefined && !isSceneIdList(free)) ||
    (everything !== undefined && typeof everything !== 'boolean')
  ) {
    return undefined;
  }
  return {
    balance: value.balance,
    starterClaimed: value.starterClaimed,
    owned,
    packs,
    ...(published === undefined ? {} : { published }),
    ...(free === undefined ? {} : { free }),
    ...(everything === true ? { everything } : {}),
  };
};

/**
 * A store as this app wrote it (its owned scenes already look ids): what the
 * disk and the window are handed back. Checked whole, as the server's is.
 */
export const isSceneStore = (value: unknown): value is ISceneStore =>
  isRecord(value) &&
  isWhole(value.balance) &&
  typeof value.starterClaimed === 'boolean' &&
  Array.isArray(value.owned) &&
  value.owned.every(isOwnedLookId) &&
  (value.published === undefined || isSceneIdList(value.published)) &&
  (value.free === undefined || isSceneIdList(value.free)) &&
  (value.everything === undefined || value.everything === true) &&
  Array.isArray(value.packs) &&
  value.packs.every((row: unknown) => readPack(row) !== undefined);

/** Why the store could not be read. `unavailable`: a server before 0055. */
export type TStoreFailure = 'signed-out' | 'offline' | 'unavailable' | 'server';

/** Why a buy did not happen, as `buy_scene` refuses it. */
export type TBuyFailure =
  | TStoreFailure
  | 'no-credits'
  | 'already-owned'
  | 'unknown-scene'
  | 'blocked'
  | 'negative-balance'
  | 'banned';

/** Starter credits and checkout both need a confirmed address. */
export type TStarterFailure = TStoreFailure | 'unconfirmed';
export type TCheckoutFailure =
  | TStoreFailure
  | 'unconfirmed'
  | 'not-on-sale'
  /** This app carries terms older than the ones credits are sold under. */
  | 'terms-outdated';

export type TSceneStoreOutcome =
  | { ok: true; store: ISceneStore }
  /** `known`: the last store this account was told, when there is one. */
  | { ok: false; reason: TStoreFailure; known?: ISceneStore };
export type TBuyOutcome =
  { ok: true; store: ISceneStore } | { ok: false; reason: TBuyFailure };
export type TStarterOutcome =
  { ok: true; store: ISceneStore } | { ok: false; reason: TStarterFailure };
/** The checkout page is opened in the browser by main; the window hears only that it was. */
export type TCheckoutOutcome =
  { ok: true } | { ok: false; reason: TCheckoutFailure };

const BUY_REFUSALS = new Map<unknown, TBuyFailure>([
  ['no_credits', 'no-credits'],
  ['already_owned', 'already-owned'],
  ['unknown_scene', 'unknown-scene'],
  ['blocked', 'blocked'],
  ['negative_balance', 'negative-balance'],
  ['banned', 'banned'],
  ['signed_out', 'signed-out'],
]);

/** The server's word for a refused buy, as the app names it. */
export const buyFailureOf = (message: unknown): TBuyFailure =>
  BUY_REFUSALS.get(message) ?? 'server';

/** A price as the reader's money: cents to "$4.99" in their locale. */
export const formatPackPrice = (priceCents: number, locale: string): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(
    priceCents / 100,
  );

/**
 * Whether an account may play a look anywhere — the graph, the desktop, the
 * lamps. One rule, read by main's gates (`sceneOwnership.ts`) and the window
 * alike, so the two cannot disagree about a scene.
 *
 * The admin plays every scene (Ivan, 2026-10-21: "always free for the
 * admin"). Anybody else: their own scene once it is published (2026-10-18:
 * "quien la hace la ve", "necesitan publicar para poder ver") — a draft
 * plays on the Studio's stage and nowhere else, Plus or not, and until the
 * server has said which are published a maker's own scenes play as they did
 * before, with Plus; a FluidEQ scene the admin made free; and any other
 * scene bought, or any while Plus lasts. A member's scene is never free for
 * anyone but its maker.
 */
export const mayPlayLook = ({
  lookId,
  accountId,
  plus,
  store,
}: {
  lookId: string;
  accountId: string | undefined;
  plus: boolean;
  store: ISceneStore | undefined;
}): boolean => {
  if (!accountId) {
    return false;
  }
  if (store?.everything) {
    return true;
  }
  if (isPremiumLookId(lookId) && store?.free?.includes(packIdOfLook(lookId))) {
    return true;
  }
  const member = parseMemberLookId(lookId);
  if (member && member.authorId === accountId.toLowerCase()) {
    return store?.published ? store.published.includes(member.packId) : plus;
  }
  return plus || (store?.owned.includes(lookId) ?? false);
};

/** Whether any scene at all plays for this account: what the lamps ask. */
export const mayPlayAnything = (
  plus: boolean,
  store: ISceneStore | undefined,
): boolean =>
  plus ||
  store?.everything === true ||
  (store?.owned.length ?? 0) > 0 ||
  (store?.published?.length ?? 0) > 0 ||
  (store?.free?.length ?? 0) > 0;
