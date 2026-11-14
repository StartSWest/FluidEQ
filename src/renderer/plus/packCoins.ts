/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { ICreditPack } from 'common/sceneStore';

/** The most coins a pile ever shows, however many packs are sold. */
const MOST_COINS = 3;

/**
 * How many coins stand for this many credits: the pack's rank by size among
 * the packs on sale, one for the smallest, three at most. The pile beside
 * each pack in Get credits (`CreditPacks`) and the coins that celebrate a
 * pack once it is paid for (`CoinCelebration`) both ask here, so the coins a
 * member chose are the coins that arrive (Ivan, 2026-11-13: "if they get the
 * 2-coin package, 2 coins show").
 *
 * Credits that are no single pack (two payments settled at once, or a pack
 * the server sells since this list was read) count as the biggest pack they
 * cover, and never fewer than one coin.
 */
const packCoins = (
  packs: readonly Pick<ICreditPack, 'credits'>[],
  credits: number,
): number => {
  const sizes = [...new Set(packs.map((pack) => pack.credits))].sort(
    (a, b) => a - b,
  );
  const exact = sizes.indexOf(credits);
  const rank =
    exact >= 0 ? exact : sizes.filter((size) => size <= credits).length - 1;
  return Math.min(MOST_COINS, Math.max(1, rank + 1));
};

export default packCoins;
