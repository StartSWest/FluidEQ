import type { IAccountConfig } from '../../common/accountConfig';

/**
 * The newest version of the Plus terms this account has agreed to, as the
 * server has it on record.
 *
 * Every agreement is recorded there as it is made — the checkout, a scene's
 * export, a scene's publication — in `terms_acceptances`, one row per
 * version, and row-level security hands each account its own rows and
 * nobody else's. So the question is a plain read with the member's own
 * token, and the answer covers every computer they have ever agreed on.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isVersion = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

/**
 * The highest version among the rows the server returned: zero for none, and
 * undefined for a body that is not a list of rows.
 *
 * A row without a usable version is skipped rather than taken as a refusal:
 * one bad row must not erase the agreements beside it. A body that is not a
 * list at all is a different thing — a renamed column or an error object —
 * and "no agreement on record" would be the wrong answer to it, because that
 * answer puts a notice on screen.
 */
export const highestAgreedVersion = (rows: unknown): number | undefined => {
  if (!Array.isArray(rows)) {
    return undefined;
  }
  return rows.reduce<number>((highest, row) => {
    const version = isRecord(row) ? row.version : undefined;
    return isVersion(version) && version > highest ? version : highest;
  }, 0);
};

/** The account's newest agreement, or undefined when it could not be asked. */
export const fetchAgreedTermsVersion = async ({
  config,
  accessToken,
  fetchImpl = fetch,
}: {
  config: IAccountConfig;
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<number | undefined> => {
  const url = new URL('/rest/v1/terms_acceptances', config.supabaseUrl);
  url.searchParams.set('select', 'version');
  url.searchParams.set('order', 'version.desc');
  url.searchParams.set('limit', '1');
  try {
    const response = await fetchImpl(url.toString(), {
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      return undefined;
    }
    return highestAgreedVersion(await response.json());
  } catch {
    return undefined;
  }
};
