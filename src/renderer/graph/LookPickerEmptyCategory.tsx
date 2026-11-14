/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { TPlusCategory } from 'common/plusGallery';
import { useAccount } from '../account/accountStore';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import openLookPickerPlace from './lookPickerPlaces';

/**
 * A category chip none of the member's scenes is filed under: said, with
 * the way to that category in the gallery. The picker shows every one of
 * the gallery's categories (Ivan, 2026-11-13), so a chip can hold nothing of
 * the member's - and a blank list under a chip reads as the chip broken.
 * Where the picker cannot leave for the gallery (no `onLeave`), the line
 * alone.
 */
export default function LookPickerEmptyCategory({
  category,
  onLeave,
}: {
  category: TPlusCategory;
  onLeave: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const account = useAccount();
  return (
    <div className="look-picker__empty">
      <p>{t('graph.picker.emptyCategory')}</p>
      {onLeave && (
        <button
          type="button"
          className="button small subtle"
          onClick={() =>
            openLookPickerPlace(
              'gallery',
              onLeave,
              account.status === 'signed-in',
              category,
            )
          }
        >
          <Glyph name="looks" />
          {t('graph.picker.browseCategory')}
        </button>
      )}
    </div>
  );
}
