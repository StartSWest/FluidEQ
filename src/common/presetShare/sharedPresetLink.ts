/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * A shared preset's short link: `https://fluideq.com/p/<id>`, eight letters
 * and digits the server answers a share code for (premium 0116,
 * `shared_presets`).
 *
 * Ivan, 2026-11-20: "Copy share link doesn't work and is huge". The link used
 * to carry the whole code, ~1,500 characters. Now it carries only the id, and
 * the app that opens one fetches the code itself, over HTTPS, from the
 * server, and reads it with the strict decoder a pasted code goes through
 * (`readPresetShareCode`). Nothing in the address is ever content: not a name,
 * not a setting, not a word of the page that sent it.
 *
 * Shared by main (which receives `fluideq://preset/<id>` from the system and
 * fetches the code), the preload's bridge and the window, so the three agree
 * on what an id is.
 */

/** Exactly eight base62 characters, and nothing around them. */
export const SHARED_PRESET_ID = /^[0-9A-Za-z]{8}$/;

/** The address a page hands FluidEQ, whole: no host but `preset`, no more path. */
export const SHARED_PRESET_APP_LINK = /^fluideq:\/\/preset\/([0-9A-Za-z]{8})$/;

/** The page on fluideq.com that shows a shared preset. */
export const SHARED_PRESET_PAGE = 'https://fluideq.com/p/';

/**
 * A short link inside a text — a message, a post, a pasted address: the
 * site's page or the app's own link, each ending at the id. The id must not
 * run on into more letters or digits, so `…/p/ABCDEFGHIJ` is no link at all
 * rather than the first eight of something else.
 */
const LINK_IN_TEXT =
  /(?:https?:\/\/(?:www\.)?fluideq\.com(?:\/[a-z]{2}(?:-[A-Za-z]{2,4})?)?\/p\/|fluideq:\/\/preset\/)([0-9A-Za-z]{8})(?![0-9A-Za-z])/;

export const isSharedPresetId = (value: unknown): value is string =>
  typeof value === 'string' && SHARED_PRESET_ID.test(value);

export const sharedPresetPageUrl = (id: string): string =>
  `${SHARED_PRESET_PAGE}${id}`;

/** The id a whole `fluideq://preset/<id>` address carries, if it is exactly one. */
export const sharedPresetIdOfAppLink = (value: string): string | undefined =>
  SHARED_PRESET_APP_LINK.exec(value)?.[1];

/** The first short link's id anywhere in `text`. */
export const findSharedPresetId = (text: string): string | undefined =>
  LINK_IN_TEXT.exec(text)?.[1];

/** A shared preset as the server answers it: the code still unread. */
export interface ISharedPresetRecord {
  id: string;
  name: string;
  code: string;
  /** The author's display name; null when they have none. */
  author: string | null;
}

/** Why a short link could not be made. */
export type TSharePresetLinkRefusal =
  | 'signed-out'
  | 'suspended'
  | 'rate-limited'
  | 'too-many'
  | 'taken-down'
  | 'invalid'
  | 'offline';

export type TSharePresetLinkOutcome =
  | { ok: true; id: string; url: string }
  | { ok: false; reason: TSharePresetLinkRefusal };

/** Why a short link opened nothing. */
export type TSharedPresetFetchProblem = 'missing' | 'offline';

export type TSharedPresetFetchOutcome =
  | { ok: true; preset: ISharedPresetRecord }
  | { ok: false; problem: TSharedPresetFetchProblem };

/** The two calls the window makes of main (`main/ipc/sharedPresetLinks.ts`). */
export const SHARE_PRESET_LINK = 'share-preset-link';
export const FETCH_SHARED_PRESET = 'fetch-shared-preset';
