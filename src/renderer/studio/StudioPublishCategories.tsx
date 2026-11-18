/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PLUS_CATEGORIES, type TPlusCategory } from 'common/plusGallery';
import { categoryKey } from '../plus/GalleryParts';
import { useTranslation } from '../utils/I18nContext';

interface IStudioPublishCategoriesProps {
  chosen: readonly TPlusCategory[];
  locked: boolean;
  onPick: (entry: TPlusCategory) => void;
}

/**
 * The Publish dialog's categories, chosen from the fixed list and never
 * typed. Up to two, the first the one a card names; once there are two the
 * chips number themselves (`StudioPublishDialog` says why).
 */
export default function StudioPublishCategories({
  chosen,
  locked,
  onPick,
}: IStudioPublishCategoriesProps) {
  const { t } = useTranslation();
  return (
    <div className="studio-publish__category" data-publish-part="category">
      <span
        className="dialog-frame__section-title"
        id="studio-publish-category"
      >
        {t('studio.publish.category')}
      </span>
      <span className="studio-publish__category-hint">
        {t('studio.publish.categoryHint')}
      </span>
      <div
        className="gallery-chips"
        role="group"
        aria-labelledby="studio-publish-category"
      >
        {PLUS_CATEGORIES.map((entry) => (
          <button
            key={entry}
            type="button"
            aria-pressed={chosen.includes(entry)}
            className="gallery-chip"
            disabled={locked}
            onClick={() => onPick(entry)}
          >
            {t(categoryKey(entry))}
            {chosen.length === 2 && chosen.includes(entry) && (
              <span className="studio-publish__order" aria-hidden="true">
                {chosen.indexOf(entry) + 1}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
