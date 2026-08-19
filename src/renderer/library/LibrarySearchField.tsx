/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useEffect, useRef, useState } from 'react';
import { suggestSearches } from 'common/searchHistory';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import type { ISearchHistoryStore } from '../utils/searchHistoryStore';

interface ILibrarySearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Both the accessible name and the placeholder — the two say the same
   * thing for a field whose entire job is stated in three words. */
  label: string;
  /** Where this box's own past terms live. Two boxes, two stores: what
   * somebody types to find an album across the library and what they type to
   * narrow one album's track listing are different vocabularies, and offering
   * one inside the other is noise. */
  history: ISearchHistoryStore;
}

/**
 * The Media tab's search capsule, with its recent-searches list.
 *
 * One component rather than the toolbar's markup copied into the drill-in:
 * the second copy was written and immediately became the thing that would
 * drift — one of the two would grow a behaviour the other never got. The
 * capsule, the magnifier, the clear button, the mouse-down handling on the
 * suggestions and the click-away that closes them all live here once.
 */
const LibrarySearchField = ({
  value,
  onChange,
  label,
  history,
}: ILibrarySearchFieldProps) => {
  const { t } = useTranslation();
  const terms = history.use();
  const suggestions = suggestSearches(terms, value);
  const [isFocused, setIsFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const isListShowing = isFocused && suggestions.length > 0;

  // A click anywhere else closes the list. Focus alone is not enough: the
  // suggestion buttons take mousedown without taking focus, so relying on
  // blur would close the list before the click it was closing for landed.
  useEffect(() => {
    if (!isFocused) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [isFocused]);

  /** Remembers what is in the box now. Called on Enter and on leaving the
   * field, never on every keystroke — a history of every prefix somebody
   * typed on the way to "beatles" is not a history of anything. */
  const commit = () => {
    history.add(value.trim());
  };

  return (
    <div className="library-search" ref={rootRef}>
      {/* `type="text"` rather than `"search"` — Chromium draws its own clear
          glyph on a search input, which sits badly on a dark capsule and
          cannot be styled. `role="searchbox"` is stated because the type no
          longer implies it, and it is the honest role for a field that
          filters a list. */}
      <div
        className={`library-search__field${isListShowing ? ' is-open' : ''}`}
      >
        <svg className="library-search__icon" viewBox="0 0 16 16" aria-hidden>
          <circle cx="7" cy="7" r="4.4" />
          <path d="M10.4 10.4L14 14" />
        </svg>
        <input
          type="text"
          role="searchbox"
          className="library-search__input"
          value={value}
          aria-label={label}
          placeholder={label}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commit();
              setIsFocused(false);
            }
            if (event.key === 'Escape') {
              setIsFocused(false);
            }
          }}
        />
        {value.length > 0 && (
          <button
            type="button"
            className="library-search__clear"
            aria-label={t('app.dismiss')}
            onClick={() => onChange('')}
          >
            <MenuIcon name="clear" className="library-search__clear-icon" />
          </button>
        )}
      </div>
      {isListShowing && (
        <div className="library-search__suggestions">
          <div className="library-search__suggestions-title">
            {t('video.searchRecent')}
          </div>
          <ul role="listbox" aria-label={t('video.searchRecent')}>
            {suggestions.map((term) => (
              <li key={term} role="option" aria-selected={term === value}>
                {/* Mouse-down rather than click, the same reason
                    `VideoSearch` gives: the click would land after the input
                    had lost focus and closed the list out from under the
                    pointer. */}
                <button
                  type="button"
                  className="library-search__suggestion"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onChange(term);
                    history.add(term);
                    setIsFocused(false);
                  }}
                >
                  <svg viewBox="0 0 16 16" aria-hidden>
                    <path d="M8 4v4l2.6 1.6" />
                    <circle cx="8" cy="8" r="5.6" />
                  </svg>
                  <span>{term}</span>
                </button>
                <button
                  type="button"
                  className="library-search__forget"
                  aria-label={t('video.searchForget', { term })}
                  title={t('video.searchForget', { term })}
                  onMouseDown={(event) => {
                    // Kept off the input's blur so the box stays focused and
                    // the list stays open — dropping four old searches should
                    // be four clicks, not four clicks and three re-focuses.
                    event.preventDefault();
                    event.stopPropagation();
                    history.remove(term);
                  }}
                >
                  <svg viewBox="0 0 12 12" aria-hidden>
                    <path d="M3 3l6 6M9 3l-6 6" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="library-search__forget-all"
            onMouseDown={(event) => {
              event.preventDefault();
              history.clear();
              setIsFocused(false);
            }}
          >
            {t('video.searchForgetAll')}
          </button>
        </div>
      )}
    </div>
  );
};

export default LibrarySearchField;
