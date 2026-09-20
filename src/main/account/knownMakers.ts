/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import { createAccountVersions } from './accountVersions';

/**
 * Which accounts on this computer have had a scene approved.
 *
 * The Studio is a Plus thing, and a maker earns Plus by publishing — so the
 * day their earned month runs out they would be locked out of making the
 * scene that would earn the next one. That is a trap, and this is the way
 * out: a maker keeps the single-project bench for good, whether or not they
 * are paying that week.
 *
 * A convenience, never a permission. The rule that matters is the server's —
 * it is what decides whether a publication is accepted (`is_scene_maker` in
 * migration 0041) — and nothing here unlocks a scene, the desktop, the
 * lighting or anything else Plus carries. Written when the server says the
 * account is a maker, read when the Studio asks what this account may open.
 */

const MAKERS_FILE = 'scene-makers.json';

/** One, because a maker either is one or is not; the file is a version map. */
const IS_A_MAKER = 1;

const makersIn = (userDataDir: string) =>
  createAccountVersions(path.join(userDataDir, MAKERS_FILE));

export const isKnownMaker = (userDataDir: string, accountId: string): boolean =>
  makersIn(userDataDir).read(accountId) >= IS_A_MAKER;

/**
 * What the server last said about this account, kept for the Studio to ask
 * offline. Answers whether it changed, so the page is told again only when
 * there is something new to tell it.
 *
 * It goes both ways: a scene taken down or deleted takes the last approval
 * with it, and `is_scene_maker` then says no. Recording only the yes would
 * leave the bench open on this computer to somebody the server refuses,
 * which is the Studio saying one thing and publishing saying another.
 */
export const setKnownMaker = (
  userDataDir: string,
  accountId: string,
  maker: boolean,
): boolean => {
  const makers = makersIn(userDataDir);
  const known = makers.read(accountId) >= IS_A_MAKER;
  if (known === maker) {
    return false;
  }
  if (maker) {
    makers.write(accountId, IS_A_MAKER);
  } else {
    makers.forget(accountId);
  }
  return true;
};
