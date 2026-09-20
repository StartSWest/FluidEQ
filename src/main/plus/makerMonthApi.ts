import {
  parseMakerMonth,
  type TMakerMonthFailure,
  type TMakerMonthOutcome,
} from '../../common/makerMonth';
import type { IGalleryAuth } from './galleryAccess';
import { rpc } from './galleryApi';

/**
 * The month a maker earns by publishing, asked of the server with the
 * account's own token.
 *
 * Nothing here decides anything: the server says when the earned month runs
 * out, how many months are waiting behind a paid membership, and how much of
 * this month's submission allowance is spent (migration 0041). The app only
 * shows it and counts the days down.
 */

const failureOf = (status: number): TMakerMonthFailure =>
  status === 401 ? 'signed-out' : 'server';

export const myMakerMonth = async (
  auth: IGalleryAuth,
): Promise<TMakerMonthOutcome> => {
  let response: Response;
  try {
    response = await rpc(auth, 'my_maker_month', {});
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (!response.ok) {
    return { ok: false, reason: failureOf(response.status) };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, reason: 'server' };
  }
  const month = parseMakerMonth(body);
  if (month) {
    return { ok: true, month };
  }
  // A server from before the earned month answers something this cannot read,
  // which is an account that has never earned one — what it was until now.
  //
  // `guessed` is what stops that standing in for the server having said no.
  // This shape is also what a rolled-back server, or one answering something
  // new, produces; acted on as an answer it would take the Studio away from
  // a maker mid-scene (`knownMakers.ts` forgets on a no). Shown, it is the
  // harmless "nothing to say"; believed, it is a member locked out by a
  // server that never mentioned them.
  return {
    ok: true,
    guessed: true,
    month: {
      running: false,
      earnedThisMonth: false,
      waiting: 0,
      submissions: 0,
      allowed: 2,
      rejections: 0,
      refusalsAllowed: 2,
      maker: false,
    },
  };
};
