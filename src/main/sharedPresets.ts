/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IAccountConfig } from '../common/accountConfig';
import {
  isSharedPresetId,
  sharedPresetPageUrl,
  type ISharedPresetRecord,
  type TSharePresetLinkOutcome,
  type TSharePresetLinkRefusal,
  type TSharedPresetFetchOutcome,
} from '../common/presetShare/sharedPresetLink';

/**
 * The server's side of short preset links (premium 0116): keeping a share
 * code under an id, and answering the code for an id.
 *
 * Both through PostgREST. Sharing needs the member's own token, and the
 * server decides who may (signed in, not suspended, 30 an hour). Reading
 * needs only the public key: anybody holding a link may open it.
 *
 * What comes back is treated as a stranger's text, because it is: the id,
 * name and code are checked against the shapes the database itself enforces
 * before the window sees them, and the code is then read by the window's
 * strict decoder like a pasted one. A server that answered anything else is
 * answered "missing".
 */

/** The shape of a share code, as `presetLinks`, the server and the site check it. */
const SHARE_CODE = /^FQP1\.[A-Za-z0-9_-]{8,4000}$/;
/** The longest name or author a row may carry (`profiles`, `shared_presets`). */
const NAME_MAX = 40;
// Control characters are what a name must never carry into a dialog.
// eslint-disable-next-line no-control-regex -- matching them is the point
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCleanText = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.trim() !== '' &&
  value.length <= NAME_MAX &&
  !CONTROL.test(value);

export const isShareCode = (value: unknown): value is string =>
  typeof value === 'string' && SHARE_CODE.test(value);

const headers = (config: IAccountConfig, bearer: string) => ({
  apikey: config.supabaseAnonKey,
  Authorization: `Bearer ${bearer}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

const rpcUrl = (config: IAccountConfig, name: string) =>
  new URL(`/rest/v1/rpc/${name}`, config.supabaseUrl).toString();

/** What `share_preset` raises, read from PostgREST's error body. */
const REFUSALS: ReadonlyArray<[string, TSharePresetLinkRefusal]> = [
  ['signed_out', 'signed-out'],
  ['suspended', 'suspended'],
  ['rate_limited', 'rate-limited'],
  ['too_many', 'too-many'],
  ['taken_down', 'taken-down'],
  ['bad_name', 'invalid'],
  ['bad_code', 'invalid'],
];

const refusalOf = (body: unknown): TSharePresetLinkRefusal => {
  const message =
    isRecord(body) && typeof body.message === 'string' ? body.message : '';
  return REFUSALS.find(([word]) => message === word)?.[1] ?? 'offline';
};

export const sharePresetLink = async ({
  config,
  accessToken,
  name,
  code,
  fetchImpl = fetch,
}: {
  config: IAccountConfig;
  accessToken: string;
  name: string;
  code: string;
  fetchImpl?: typeof fetch;
}): Promise<TSharePresetLinkOutcome> => {
  try {
    const response = await fetchImpl(rpcUrl(config, 'share_preset'), {
      method: 'POST',
      headers: headers(config, accessToken),
      body: JSON.stringify({ p_name: name, p_code: code }),
    });
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      return { ok: false, reason: refusalOf(body) };
    }
    if (!isSharedPresetId(body)) {
      return { ok: false, reason: 'offline' };
    }
    return { ok: true, id: body, url: sharedPresetPageUrl(body) };
  } catch {
    return { ok: false, reason: 'offline' };
  }
};

/** The row `shared_preset` answered, if every field is what it may be. */
export const readSharedPresetRow = (
  row: unknown,
  id: string,
): ISharedPresetRecord | undefined => {
  if (!isRecord(row) || row.id !== id) {
    return undefined;
  }
  const { name, code } = row;
  const author = row.author_name;
  if (!isCleanText(name) || !isShareCode(code)) {
    return undefined;
  }
  return {
    id,
    name: name.trim(),
    code,
    author: isCleanText(author) ? author.trim() : null,
  };
};

export const fetchSharedPreset = async ({
  config,
  id,
  fetchImpl = fetch,
}: {
  config: IAccountConfig;
  id: string;
  fetchImpl?: typeof fetch;
}): Promise<TSharedPresetFetchOutcome> => {
  if (!isSharedPresetId(id)) {
    return { ok: false, problem: 'missing' };
  }
  try {
    const response = await fetchImpl(rpcUrl(config, 'shared_preset'), {
      method: 'POST',
      headers: headers(config, config.supabaseAnonKey),
      body: JSON.stringify({ p_id: id }),
    });
    if (!response.ok) {
      return { ok: false, problem: 'offline' };
    }
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) {
      return { ok: false, problem: 'offline' };
    }
    const preset = readSharedPresetRow(rows[0], id);
    return preset ? { ok: true, preset } : { ok: false, problem: 'missing' };
  } catch {
    return { ok: false, problem: 'offline' };
  }
};
