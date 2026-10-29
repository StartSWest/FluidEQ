/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IHeadphoneSettings } from 'common/constants';
import { curveTextOf } from 'common/curveText';
import type { IMyCurve } from 'common/myCurves';

/**
 * Whether a curve is the headphone correction playing now, whichever tab
 * applied it (Ivan, 2026-10-25: applying a curve from OPRA, Squiglink or My
 * curves is applying the same curve, and My curves offered Apply again for
 * one OPRA had just applied).
 *
 * A correction is recognised by its text, two ways: the text it was imported
 * from (Squiglink, My curves), and the text its bands write — which is what
 * "Save to My curves" keeps from an OPRA pick and what OPRA's own curves are
 * compared by (`GET_OPRA_CURVES`). Checking only the import's text was the
 * bug: an OPRA pick has none.
 */
const correctionTexts = (headphone: IHeadphoneSettings | undefined) => {
  if (!headphone) {
    return [];
  }
  const written = curveTextOf({
    preAmp: 0,
    filters: headphone.filters,
    graphicEq: headphone.graphicEq,
  }).trim();
  const imported = headphone.eqImport?.text?.trim();
  return imported ? [written, imported] : [written];
};

export const isCurveApplied = (
  text: string | undefined,
  headphone: IHeadphoneSettings | undefined,
): boolean =>
  !!text?.trim() && correctionTexts(headphone).includes(text.trim());

/**
 * The name My curves keeps the playing correction under, when it is there:
 * what the main EQ's correction chip says rather than "Custom", and, being
 * read from the list each time, what it says after the curve is renamed.
 */
export const keptCurveName = (
  curves: readonly IMyCurve[],
  headphone: IHeadphoneSettings | undefined,
): string | undefined =>
  curves.find((curve) => isCurveApplied(curve.text, headphone))?.name;
