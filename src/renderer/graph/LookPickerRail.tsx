/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TGraphStyleFamily } from 'common/graphStyleFamilies';
import { PLUS_CATEGORIES } from 'common/plusGallery';
import { useTranslation } from '../utils/I18nContext';
import LookPickerPlaceIcon from './LookPickerPlaceIcon';
import type { TPickerPlace } from './lookPickerFilter';

interface ILookPickerRailProps {
  /** The place open, or none while a search is showing everything. */
  place: TPickerPlace | undefined;
  families: readonly TGraphStyleFamily[];
  /** How many looks each place holds under the From tab chosen. */
  countOf: (place: TPickerPlace) => number;
  nameOf: (place: TPickerPlace) => string;
  onPlace: (place: TPickerPlace) => void;
}

/**
 * THE PICKER'S PLACES, AS THE LIBRARY'S RAIL (Ivan, 2026-11-19: "improve that
 * to look like the Library, which is better"). It was two rows of pills over
 * each column - twelve of them over the scenes, wrapping, with the makers
 * mixed in at the end. Now each place is a row with its glyph and how much
 * is in it, the open one with the Library's mark: everything, what is new,
 * the families of styles, and every one of the gallery's categories, even
 * those that hold nothing yet, which say so in the place itself.
 *
 * A `nav` of plain buttons with `aria-current`, as the Library's shelves are,
 * and one Tab stop: the arrows walk it (`walkPicker`).
 */
export default function LookPickerRail({
  place,
  families,
  countOf,
  nameOf,
  onPlace,
}: ILookPickerRailProps) {
  const { t } = useTranslation();
  const stop = place ?? 'everything';
  const item = (each: TPickerPlace) => {
    const isActive = each === place;
    const count = countOf(each);
    return (
      <button
        key={each}
        type="button"
        className={`look-picker__place${isActive ? ' is-active' : ''}${
          count === 0 ? ' is-empty' : ''
        }`}
        aria-current={isActive ? 'page' : undefined}
        tabIndex={each === stop ? 0 : -1}
        title={nameOf(each)}
        onClick={() => onPlace(each)}
      >
        <LookPickerPlaceIcon place={each} className="look-picker__place-icon" />
        <span className="look-picker__place-name">{nameOf(each)}</span>
        {/* Something new is the one count worth a mark beside it. */}
        {each === 'fresh' && count > 0 && (
          <span className="look-picker__place-dot" aria-hidden="true" />
        )}
        <small className="look-picker__place-count">{count}</small>
      </button>
    );
  };
  return (
    <nav
      className="look-picker__rail"
      aria-label={t('graph.picker.places')}
      data-anchored-menu-scroll
    >
      {item('everything')}
      {item('fresh')}
      <div className="look-picker__rail-heading" aria-hidden="true">
        {t('graph.picker.styles')}
      </div>
      {families.map(item)}
      <div className="look-picker__rail-heading" aria-hidden="true">
        {t('graph.picker.plus')}
      </div>
      {item('all-scenes')}
      {PLUS_CATEGORIES.map(item)}
    </nav>
  );
}
