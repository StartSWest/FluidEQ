/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useState } from 'react';
import type { ErrorDescription } from 'common/errors';
import { CURVE_LIST_MAX } from 'common/myCurves';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import {
  addMyCurve,
  isMyCurvesFull,
  useMyCurvesState,
  type INewCurve,
} from './myCurvesStore';
// Shown on the Squiglink panel and the OPRA library, where the list's own
// sheet may not be.
import '../styles/MyCurves.scss';

/**
 * Keep the curve on screen in My curves, in one press, under the name it
 * already has: the Squiglink panel's paste or file, the OPRA pick playing.
 * It used to open the Add dialog, which asked again for what was already
 * there (Ivan, 2026-10-20: "not sure about the extra step"); a name is changed
 * in the list, where every curve is renamed.
 *
 * Once the curve is in the list — saved here, or kept before — the button
 * gives way to a line saying under which name, so the same curve is never
 * kept twice by a second press.
 */
export default function SaveToMyCurves({
  curve,
  isDisabled = false,
}: {
  /** What to keep; nothing while there is no curve to keep. */
  curve: INewCurve | undefined;
  isDisabled?: boolean;
}) {
  const { t } = useTranslation();
  const { setGlobalError } = useFluidEqContext();
  const { curves, isLoaded } = useMyCurvesState();
  const [isSaving, setSaving] = useState(false);
  const text = curve?.text.trim();
  const kept = text
    ? curves.find((entry) => entry.text.trim() === text)
    : undefined;

  // The words are in a label of their own, which a row short of room hides
  // down to the icon (`useRowFit`); the tooltip and the accessible name keep
  // them.
  if (kept) {
    const said = t('myCurves.inList', { name: kept.name });
    return (
      <span className="my-curve-kept" role="status" title={said}>
        <MenuIcon name="check" />
        <span className="my-curve-save__label">{said}</span>
      </span>
    );
  }

  const isFull = isMyCurvesFull(curves);
  return (
    <button
      type="button"
      className="button small subtle"
      disabled={isDisabled || !curve || !isLoaded || isSaving || isFull}
      aria-label={t('myCurves.save')}
      title={
        isFull
          ? t('myCurves.full', { count: CURVE_LIST_MAX })
          : t('myCurves.save')
      }
      onClick={() => {
        if (!curve) {
          return;
        }
        setSaving(true);
        addMyCurve(curve)
          .catch((error) => setGlobalError(error as ErrorDescription))
          .finally(() => setSaving(false));
      }}
    >
      <MenuIcon name="save" />
      <span className="my-curve-save__label">{t('myCurves.save')}</span>
    </button>
  );
}
