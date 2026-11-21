/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { RefObject } from 'react';
import { useTranslation } from '../utils/I18nContext';

/**
 * The one search over every look, styles and scenes alike, in the Library's
 * quiet field. Enter plays the look when the search has narrowed to one.
 */
export default function LookPickerSearch({
  query,
  searchRef,
  onQuery,
  onEnter,
}: {
  query: string;
  searchRef: RefObject<HTMLInputElement | null>;
  onQuery: (query: string) => void;
  onEnter: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="look-picker__search">
      <svg viewBox="0 0 16 16" aria-hidden>
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5L14 14" />
      </svg>
      <input
        ref={searchRef}
        type="text"
        value={query}
        placeholder={t('graph.picker.search')}
        aria-label={t('graph.picker.search')}
        onChange={(event) => onQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            onEnter();
          }
        }}
      />
      {query.length > 0 && (
        <button
          type="button"
          className="menu-search__clear"
          aria-label={t('common.clearSearch')}
          title={t('common.clearSearch')}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onQuery('');
            searchRef.current?.focus();
          }}
        >
          <svg viewBox="0 0 12 12" aria-hidden>
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
