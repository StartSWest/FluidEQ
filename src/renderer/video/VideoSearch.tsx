/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.
*/

import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { suggestSearches } from 'common/searchHistory';
import { useTranslation } from '../utils/I18nContext';
import {
  addSearchToHistory,
  clearSearchHistory,
  removeSearchFromHistory,
  useSearchHistory,
} from '../utils/videoSearchHistory';

interface IVideoSearchProps {
  /** Where a chosen search goes. The site to run it on is the caller's affair. */
  handleSearch: (terms: string) => void;
  /** Named so the placeholder can say which site is being asked. */
  siteName: string;
}

/**
 * The search box, and what has been searched for before.
 *
 * A combobox written out here rather than the shared `TextInput`, which submits
 * on key-*up* and offers no way to see an arrow key. Suggestions need both, and
 * five more props on a widget used a dozen other places to serve one of them is
 * a worse trade than one component that owns its own input.
 */
const VideoSearch = ({ handleSearch, siteName }: IVideoSearchProps) => {
  const { t } = useTranslation();
  const history = useSearchHistory();

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  /** Which row the arrow keys are on; -1 is "what has been typed". */
  const [highlighted, setHighlighted] = useState(-1);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const suggestions = suggestSearches(history, query);
  const isListShowing = isOpen && suggestions.length > 0;

  const run = useCallback(
    (terms: string) => {
      const cleaned = terms.trim();
      if (!cleaned) {
        return;
      }
      addSearchToHistory(cleaned);
      setQuery(cleaned);
      setIsOpen(false);
      setHighlighted(-1);
      inputRef.current?.blur();
      handleSearch(cleaned);
    },
    [handleSearch],
  );

  /**
   * Close when the click lands anywhere else.
   *
   * Blur alone is not enough: the page below is a `<webview>`, and a click into
   * the guest never reaches this document at all — so a list left open by focus
   * would hang over a video somebody has just gone back to watching. Pointer-down
   * on the window covers every case that does reach us, and the guest taking
   * focus fires blur for the one that does not.
   */
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlighted(-1);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        // Held here rather than left to the browser: in a text field the arrows
        // move the caret, which is not what somebody reaching for a list below
        // the box is asking for.
        event.preventDefault();
        if (!suggestions.length) {
          return;
        }
        setIsOpen(true);
        const step = event.key === 'ArrowDown' ? 1 : -1;
        // Wraps through -1, so arrowing off either end puts back whatever was
        // typed instead of trapping the selection in the list.
        const count = suggestions.length + 1;
        setHighlighted(((highlighted + 1 + step + count) % count) - 1);
        return;
      }

      if (event.key === 'Enter') {
        run(highlighted >= 0 ? suggestions[highlighted] : query);
        return;
      }

      if (event.key === 'Escape') {
        if (isListShowing) {
          // First press closes the list, second clears the box. Escaping
          // straight to empty would throw away a half-typed search somebody
          // only meant to stop suggesting against.
          event.stopPropagation();
          setIsOpen(false);
          setHighlighted(-1);
        } else if (query) {
          event.stopPropagation();
          setQuery('');
        }
      }
    },
    [highlighted, isListShowing, query, run, suggestions],
  );

  return (
    <div className="video-search" ref={rootRef}>
      <div className={`video-search__field${isListShowing ? ' is-open' : ''}`}>
        <svg className="video-search__icon" viewBox="0 0 16 16" aria-hidden>
          <circle cx="7" cy="7" r="4.2" />
          <path d="M10.2 10.2L14 14" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="video-search__input"
          value={query}
          role="combobox"
          aria-label={t('video.searchAria')}
          aria-expanded={isListShowing}
          aria-controls="video-search-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={
            highlighted >= 0 ? `video-search-option-${highlighted}` : undefined
          }
          placeholder={t('video.searchOn', { site: siteName })}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            setHighlighted(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            type="button"
            className="video-search__clear"
            aria-label={t('video.searchClear')}
            title={t('video.searchClear')}
            onClick={() => {
              setQuery('');
              setHighlighted(-1);
              inputRef.current?.focus();
            }}
          >
            <svg viewBox="0 0 12 12" aria-hidden>
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="video-search__go"
          aria-label={t('video.searchAria')}
          title={t('video.searchAria')}
          disabled={!query.trim()}
          onClick={() => run(query)}
        >
          {t('video.searchGo')}
        </button>
      </div>

      {isListShowing && (
        <div className="video-search__suggestions">
          <div className="video-search__suggestions-title">
            {t('video.searchRecent')}
          </div>
          <ul
            id="video-search-suggestions"
            role="listbox"
            aria-label={t('video.searchRecent')}
          >
            {suggestions.map((term, index) => (
              <li
                key={term}
                id={`video-search-option-${index}`}
                role="option"
                aria-selected={index === highlighted}
                className={`video-search__suggestion${
                  index === highlighted ? ' is-highlighted' : ''
                }`}
              >
                {/* Mouse-down rather than click: the click would land after the
                    input had already lost focus and closed the list out from
                    under the pointer. */}
                <button
                  type="button"
                  className="video-search__suggestion-run"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    run(term);
                  }}
                  onMouseEnter={() => setHighlighted(index)}
                >
                  <svg viewBox="0 0 16 16" aria-hidden>
                    <path d="M8 4v4l2.6 1.6" />
                    <circle cx="8" cy="8" r="5.6" />
                  </svg>
                  <span>{term}</span>
                </button>
                <button
                  type="button"
                  className="video-search__suggestion-forget"
                  aria-label={t('video.searchForget', { term })}
                  title={t('video.searchForget', { term })}
                  onMouseDown={(event) => {
                    // Kept off the input's blur so the box stays focused and
                    // the list stays open — removing four old searches should
                    // be four clicks, not four clicks and three re-focuses.
                    event.preventDefault();
                    event.stopPropagation();
                    removeSearchFromHistory(term);
                    setHighlighted(-1);
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
            className="video-search__forget-all"
            onMouseDown={(event) => {
              event.preventDefault();
              clearSearchHistory();
              setIsOpen(false);
            }}
          >
            {t('video.searchForgetAll')}
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoSearch;
