/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useMemo, useRef } from 'react';
import LookPickerBody from '../../../graph/LookPickerBody';
import { buildStyleRows } from '../../../graph/lookPickerRows';
import { getSelectableLooks, useGraphPalette } from '../../../utils/graphStyle';
import { useTranslation } from '../../../utils/I18nContext';

const nothing = () => undefined;

/**
 * The look picker open on its Animated looks, every one drawn live as the
 * picker draws it (2.6: one loop, a fixed share of one core, nothing drawn
 * out of view), the second one marked as the look that plays. The picker's
 * own body on the factory's looks only; no scene, no account, nothing of
 * the reader's is read.
 */
export default function LooksLive() {
  const { t } = useTranslation();
  const palette = useGraphPalette();
  const searchRef = useRef<HTMLInputElement>(null);
  const styleRows = useMemo(
    () => buildStyleRows(getSelectableLooks([], palette, [], []), t),
    [palette, t],
  );
  const playing =
    styleRows.find((row) => row.family === 'scenes') ?? styleRows[0];
  return (
    <div className="graph-look-menu look-picker__menu">
      <LookPickerBody
        value={playing?.id ?? ''}
        styleRows={styleRows}
        plusRows={[]}
        query=""
        place="scenes"
        from="all"
        view="grid"
        onQuery={nothing}
        onPlace={nothing}
        onFrom={nothing}
        onSort={nothing}
        onView={nothing}
        onChoose={nothing}
        searchRef={searchRef}
      />
    </div>
  );
}
