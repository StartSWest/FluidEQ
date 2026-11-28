/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import Chevron from '../icons/Chevron';
import useChatPopover from '../studio/chat/useChatPopover';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu from '../widgets/AnchoredMenu';
import { PICKER_SORTS, type TPickerSort } from './lookPickerFilter';
import '../styles/SceneChoice.scss';

export const SORT_KEYS: Record<TPickerSort, TranslationKey> = {
  newest: 'plus.gallery.sort.new',
  updated: 'graph.picker.sortUpdated',
  name: 'library.sort.name',
  used: 'plus.gallery.sort.added',
};

/**
 * The picker's order, as the Library's bar says its own ("Sort: Name"), on
 * the gallery's order menu (`GallerySortMenu`): an AnchoredMenu, so a press
 * in it is inside a menu and leaves the picker open, and Escape shuts this
 * list before the picker (`useChatPopover` listens first, and stops it).
 *
 * Disabled where there is nothing for it to order: the standard looks keep
 * their fixed order under every sort (`lookOrder.ts`). Still there and
 * still saying the order, so the bar keeps its shape from place to place.
 */
export default function LookPickerSort({
  sort,
  disabled = false,
  onSort,
}: {
  sort: TPickerSort;
  disabled?: boolean;
  onSort: (sort: TPickerSort) => void;
}) {
  const { t } = useTranslation();
  const menu = useChatPopover();
  return (
    <>
      <button
        ref={menu.setAnchor}
        type="button"
        className="look-picker__sort"
        aria-haspopup="menu"
        aria-expanded={menu.isOpen}
        disabled={disabled}
        onClick={menu.toggle}
      >
        <span className="look-picker__sort-text">
          {t('library.sortBy', { value: t(SORT_KEYS[sort]) })}
        </span>
        <Chevron className="arrow" />
      </button>
      <AnchoredMenu
        anchor={menu.anchor}
        isOpen={menu.isOpen}
        role="menu"
        className="scene-choice__menu"
        ariaLabel={t('library.sort')}
        align="right"
      >
        {PICKER_SORTS.map((each) => (
          <button
            key={each}
            type="button"
            role="menuitemradio"
            aria-checked={each === sort}
            className={`scene-choice__item${each === sort ? ' is-chosen' : ''}`}
            onClick={() => {
              menu.close();
              onSort(each);
            }}
          >
            <span className="scene-choice__mark" aria-hidden />
            <span className="scene-choice__name">{t(SORT_KEYS[each])}</span>
          </button>
        ))}
      </AnchoredMenu>
    </>
  );
}
