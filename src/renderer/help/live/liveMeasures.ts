/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IHelpLiveMeasure } from './HelpLiveSurface';

/**
 * What each live figure measured last, in each language, for as long as the
 * window lives: the guide opened again, or the figure enlarged, holds the
 * room it will take from its first paint instead of the room it expected.
 */
const MEASURES = new Map<string, IHelpLiveMeasure>();

const keyOf = (live: string, locale: string) => `${live}:${locale}`;

export const rememberedMeasure = (
  live: string,
  locale: string,
): IHelpLiveMeasure | undefined => MEASURES.get(keyOf(live, locale));

export const rememberMeasure = (
  live: string,
  locale: string,
  measure: IHelpLiveMeasure,
) => {
  MEASURES.set(keyOf(live, locale), measure);
};
