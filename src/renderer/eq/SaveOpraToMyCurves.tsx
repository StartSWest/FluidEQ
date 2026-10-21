/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useState } from 'react';
import { curveTextOf } from 'common/curveText';
import type { IHeadphoneSettings } from 'common/constants';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import MyCurveAddDialog from './MyCurveAddDialog';

/**
 * The OPRA correction playing now, kept as a copy in My curves: beside the
 * library's Apply, under the name the library gives it, to rename and edit
 * there. A copy, so the library itself is never changed.
 */
export default function SaveOpraToMyCurves({
  headphone,
  name,
}: {
  headphone: IHeadphoneSettings;
  name: string;
}) {
  const { t } = useTranslation();
  const [isSaving, setSaving] = useState(false);
  return (
    <>
      <button
        type="button"
        className="button small subtle autoeq-save-mine"
        onClick={() => setSaving(true)}
      >
        <MenuIcon name="save" />
        {t('myCurves.save')}
      </button>
      {isSaving && (
        <MyCurveAddDialog
          initial={{
            text: curveTextOf({
              preAmp: 0,
              filters: headphone.filters,
              graphicEq: headphone.graphicEq,
            }),
            name,
            source: 'opra',
            ears: 'both',
          }}
          onClose={() => setSaving(false)}
        />
      )}
    </>
  );
}
