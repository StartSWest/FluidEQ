/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import type { TPickerFrom } from './lookPickerFilter';

const FROM_KEYS: Record<TPickerFrom, TranslationKey> = {
  all: 'graph.picker.all',
  fluideq: 'account.plus.eyebrow',
  members: 'graph.picker.members',
  yours: 'graph.picker.yours',
};

/**
 * WHO MADE IT, apart from what it is (Ivan, 2026-11-19, of the old "Made by
 * you" and "Made by members" pills among the categories: "kind of
 * complicated ... I don't know"). Its own row over the grid, in the
 * Library's underlined words (`studio-tab`), each with how many SCENES it
 * holds in the place that is open, so a tab that would empty the grid says
 * so before it is pressed. Scenes only, since 2026-11-25: a style has no
 * maker to choose between (`keepFrom`).
 *
 * `idle` over a family of styles, where it has nothing to narrow: kept in
 * the layout and not drawn, so the heading does not change height between
 * Analysis and Nature.
 */
export default function LookPickerFrom({
  froms,
  from,
  countOf,
  onFrom,
  idle = false,
}: {
  froms: readonly TPickerFrom[];
  from: TPickerFrom;
  countOf: (from: TPickerFrom) => number;
  onFrom: (from: TPickerFrom) => void;
  idle?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`look-picker__froms${idle ? ' is-idle' : ''}`}
      role="group"
      aria-label={t('graph.picker.from')}
      aria-hidden={idle || undefined}
    >
      <span className="look-picker__froms-label" aria-hidden="true">
        {t('graph.picker.from')}
      </span>
      {froms.map((each) => (
        <button
          key={each}
          type="button"
          className={`look-picker__from${each === from ? ' is-active' : ''}`}
          aria-pressed={each === from}
          tabIndex={idle ? -1 : undefined}
          onClick={() => onFrom(each)}
        >
          {t(FROM_KEYS[each])}
          <small className="look-picker__from-count">{countOf(each)}</small>
        </button>
      ))}
    </div>
  );
}
