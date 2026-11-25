/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from '../../utils/I18nContext';
import type { TPresetBrowse } from './usePresetBrowse';
import WavePresetFavourites from './WavePresetFavourites';
import WavePresetResults from './WavePresetResults';
import WavePresetStatus from './WavePresetStatus';

/**
 * The plate's panel under its head (Ivan, 2026-11-25, design A): one field
 * that searches every preset, and under it a box whose height is set when
 * the panel opens (`WavePreset.scss`, `$browse-height`), so typing never
 * resizes the panel. Before anything is typed the box holds None and the
 * favourites; while typing, what was found; at its foot, the strip.
 */
const WavePresetBrowse = ({ browse }: { browse: TPresetBrowse }) => {
  const { t } = useTranslation();
  const { search, query, activeIndex } = browse;
  const placeholder = t('wavePreset.search', {
    count: browse.searchableCount,
  });

  const activeRowId = activeIndex >= 0 ? browse.rowId(activeIndex) : undefined;
  const listRef = useRef<HTMLDivElement>(null);

  // Another search starts at the top of what it found.
  useLayoutEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [query]);
  // The row the keys land on is brought into view, the nearest edge only.
  useLayoutEffect(() => {
    const row = activeRowId ? document.getElementById(activeRowId) : null;
    // jsdom has none, and the cases that walk the rows are not about scrolling.
    if (row && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' });
    }
  }, [activeRowId, query]);

  return (
    <>
      <div className="wave-preset-menu__search">
        <svg viewBox="0 0 16 16" aria-hidden>
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" />
        </svg>
        <input
          ref={browse.inputRef}
          type="text"
          value={query}
          placeholder={placeholder}
          aria-label={t('wavePreset.searchLabel')}
          aria-controls={browse.listId}
          aria-activedescendant={activeRowId}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => browse.setQuery(event.target.value)}
        />
        <span className="wave-preset-menu__found" aria-live="polite">
          {search ? t('wavePreset.found', { count: search.count }) : ''}
        </span>
        {query !== '' && (
          <button
            type="button"
            className="menu-search__clear"
            aria-label={t('common.clearSearch')}
            title={t('common.clearSearch')}
            // Pressing a button focuses it, and this one unmounts on the
            // very next render: the caret would land on the body and the
            // next key would go nowhere.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              browse.setQuery('');
              browse.inputRef.current?.focus({ preventScroll: true });
            }}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        )}
      </div>
      <div className="wave-preset-menu__browse">
        <div
          ref={listRef}
          id={browse.listId}
          className={`wave-preset-menu__list${search ? ' is-results' : ''}`}
        >
          {search ? (
            <WavePresetResults browse={browse} search={search} />
          ) : (
            <WavePresetFavourites browse={browse} />
          )}
        </div>
        <WavePresetStatus browse={browse} />
      </div>
    </>
  );
};

export default WavePresetBrowse;
