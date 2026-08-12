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

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  CSSProperties,
  KeyboardEvent,
  UIEvent,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  createElement,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { suggestSearches } from 'common/searchHistory';
import ArrowIcon from '../icons/ArrowIcon';
import '../styles/Dropdown.scss';
import { useClickOutside, useFocusOutside } from '../utils/utils';
import List, { renderOptionDisplay } from './List';
import TextInput from './TextInput';

interface IOptionEntry {
  value: string;
  label: string;
  display: ReactNode | (() => ReactNode);
}

interface IDropdownProps {
  name: string;
  options: IOptionEntry[];
  value: string;
  isDisabled: boolean;
  noSelectionPlaceholder?: ReactNode;
  emptyOptionsPlaceholder?: ReactNode;
  isFilterable?: boolean;
  filterPlaceholder?: string;
  searchHistory?: readonly string[];
  searchHistoryLabel?: string;
  clearSearchHistoryLabel?: string;
  onSearchCommit?: (query: string) => void;
  onClearSearchHistory?: () => void;
  placement?: 'up' | 'down' | 'left' | 'right';
  /**
   * Put on the portalled menu, for stylesheets that need to size it.
   *
   * The menu is rendered into `document.body`, so a rule written as
   * `.some-card .dropdown .list-wrapper` no longer selects it — the card is not
   * an ancestor any more. A call site that wants a wider or narrower menu than
   * the trigger names it here and styles that name instead.
   */
  menuClassName?: string;
  handleChange: (newValue: string) => void;
}

type DropdownPlacement = 'up' | 'down' | 'left' | 'right';

/**
 * Where the open menu sits, in viewport coordinates.
 *
 * WHY VIEWPORT COORDINATES AND A PORTAL. The menu used to be an absolutely
 * positioned child of the trigger, which meant every scroll container and every
 * card edge between it and the window clipped it. It escaped by force: a
 * `:has(.dropdown--open)` chain in App.scss set `overflow: visible` on eleven
 * ancestors, one of which is the tab panel that actually scrolls. An element
 * with visible overflow is not a scroll container, so opening any dropdown took
 * the pane's scrollbar away and the content jumped sideways into the freed
 * gutter — patched, in turn, by an 8px padding that guessed at a scrollbar's
 * width.
 *
 * Positioned against the window from a portal there is nothing to escape from,
 * so all of that goes: the chain, the padding, and the `translateX` nudge that
 * kept the menu on screen (which the fold animation overrode for its own
 * duration anyway, since a running animation outranks an inline transform).
 *
 * Only one of `top`/`bottom` and one of `left`/`right` is ever set — an upward
 * menu is pinned by its bottom edge so it grows away from the trigger rather
 * than towards it, which is what makes the fold read correctly without knowing
 * the height in advance.
 */
interface IMenuFrame {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  width: number;
  maxWidth: number;
  maxHeight: number;
}

/** Clearance between the menu and the trigger, above or below it. */
const MENU_GAP_BLOCK_PX = 5;
/** Clearance between the menu and the trigger when it opens to a side. */
const MENU_GAP_INLINE_PX = 8;
/** Clearance between the menu and the window edges. */
const VIEWPORT_PADDING_PX = 16;

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Catalogues run to tens of thousands of entries. Matching is done over the
// whole set (against a pre-normalised index, so it stays cheap), but only a
// page of results is mounted at a time and the next page is appended as the
// user scrolls.
const PAGE_SIZE = 100;
/** Distance from the bottom of the list at which the next page is appended. */
const LOAD_MORE_THRESHOLD_PX = 240;

export const matchesDropdownSearch = (option: IOptionEntry, query: string) => {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return true;
  }

  const searchableText = normalizeSearchText(`${option.label} ${option.value}`);
  return terms.every((term) => searchableText.includes(term));
};

const Dropdown = ({
  name,
  options,
  value,
  isDisabled,
  noSelectionPlaceholder,
  emptyOptionsPlaceholder,
  handleChange,
  isFilterable = false,
  filterPlaceholder = 'Search...',
  searchHistory,
  searchHistoryLabel = 'Recent searches',
  clearSearchHistoryLabel = 'Clear recent searches',
  onSearchCommit,
  onClearSearchHistory,
  placement = 'down',
  menuClassName,
}: IDropdownProps) => {
  const nullElement = createElement('div');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [menuPlacement, setMenuPlacement] =
    useState<DropdownPlacement>(placement);
  const [menuFrame, setMenuFrame] = useState<IMenuFrame>();
  const dropdownRef = useRef<HTMLDivElement>(null);
  // The portalled menu. It is outside `dropdownRef`'s subtree, so the
  // outside-click and outside-focus checks have to be told about it or every
  // click on an option would read as a click elsewhere and close the menu
  // before the option's own handler ran.
  const menuRef = useRef<HTMLDivElement>(null);

  const [searchString, setSearchString] = useState<string>('');
  const deferredSearchString = useDeferredValue(searchString);
  const searchSuggestions = useMemo(
    () => suggestSearches(searchHistory ?? [], searchString),
    [searchHistory, searchString],
  );
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const indexedOptions = useMemo(
    () =>
      options.map((option) => ({
        option,
        searchableText: normalizeSearchText(`${option.label} ${option.value}`),
      })),
    [options],
  );

  // Every match, over the complete option set.
  const matchedOptions = useMemo(() => {
    const terms = normalizeSearchText(deferredSearchString)
      .split(/\s+/)
      .filter(Boolean);
    if (terms.length === 0) {
      return options;
    }
    return indexedOptions
      .filter(({ searchableText }) =>
        terms.every((term) => searchableText.includes(term)),
      )
      .map(({ option }) => option);
  }, [deferredSearchString, indexedOptions, options]);

  // Start from the top of the results whenever the query or the source list
  // changes, so a new search never inherits a previous scroll depth.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [matchedOptions]);

  const filteredOptions = useMemo(
    () => matchedOptions.slice(0, visibleCount),
    [matchedOptions, visibleCount],
  );

  const hasMoreOptions = matchedOptions.length > filteredOptions.length;

  const handleListScroll = useCallback(
    (event: UIEvent<HTMLUListElement>) => {
      if (!hasMoreOptions) {
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
      if (scrollHeight - scrollTop - clientHeight <= LOAD_MORE_THRESHOLD_PX) {
        setVisibleCount((current) => current + PAGE_SIZE);
      }
    },
    [hasMoreOptions],
  );

  const updateMenuPlacement = useCallback(() => {
    const bounds = dropdownRef.current?.getBoundingClientRect();
    if (!bounds) {
      return;
    }

    const viewportPadding = VIEWPORT_PADDING_PX;
    const renderedMenu =
      menuRef.current?.querySelector<HTMLElement>('.list-wrapper');
    const renderedMenuBounds = renderedMenu?.getBoundingClientRect();
    const menuHeight =
      renderedMenuBounds?.height ??
      Math.min(
        360,
        Math.max(82, filteredOptions.length * 40 + (isFilterable ? 54 : 0)),
      );
    const menuWidth = Math.min(
      window.innerWidth - viewportPadding * 2,
      renderedMenuBounds?.width ??
        Math.max(bounds.width, Math.min(420, window.innerWidth - 32)),
    );
    const below = window.innerHeight - bounds.bottom - viewportPadding;
    const above = bounds.top - viewportPadding;
    const fitsBelow = below >= menuHeight;
    const fitsAbove = above >= menuHeight;
    const availableLeft = Math.max(0, bounds.left - viewportPadding);
    const availableRight = Math.max(
      0,
      window.innerWidth - bounds.right - viewportPadding,
    );
    let nextPlacement: DropdownPlacement = placement;

    if (placement === 'down' || placement === 'up') {
      if (placement === 'down' && !fitsBelow && fitsAbove) {
        nextPlacement = 'up';
      } else if (placement === 'up' && !fitsAbove && fitsBelow) {
        nextPlacement = 'down';
      } else if (!fitsBelow && !fitsAbove) {
        if (availableRight >= menuWidth || availableLeft >= menuWidth) {
          nextPlacement = availableRight >= availableLeft ? 'right' : 'left';
        } else {
          nextPlacement = below >= above ? 'down' : 'up';
        }
      }
    } else {
      const preferredSideSpace =
        placement === 'left' ? availableLeft : availableRight;
      const alternateSideSpace =
        placement === 'left' ? availableRight : availableLeft;
      if (preferredSideSpace < menuWidth && alternateSideSpace >= menuWidth) {
        nextPlacement = placement === 'left' ? 'right' : 'left';
      }
    }

    const isHorizontalPlacement =
      nextPlacement === 'left' || nextPlacement === 'right';
    let availableHeight = Math.max(below, above);
    if (nextPlacement === 'up') {
      availableHeight = above;
    } else if (nextPlacement === 'down') {
      availableHeight = below;
    }
    const nextMaxWidth = isHorizontalPlacement
      ? Math.max(
          180,
          Math.min(
            window.innerWidth - viewportPadding * 2,
            nextPlacement === 'left'
              ? availableLeft - MENU_GAP_INLINE_PX
              : availableRight - MENU_GAP_INLINE_PX,
          ),
        )
      : Math.max(180, window.innerWidth - viewportPadding * 2);

    // The trigger's width, which is what the menu used to inherit from
    // `width: 100%` against it. Detached from the trigger it has to be told.
    const nextWidth = Math.max(0, bounds.width);
    const nextFrame: IMenuFrame = {
      width: nextWidth,
      maxWidth: nextMaxWidth,
      maxHeight: Math.max(80, Math.min(360, availableHeight)),
    };

    if (nextPlacement === 'down') {
      nextFrame.top = bounds.bottom + MENU_GAP_BLOCK_PX;
    } else if (nextPlacement === 'up') {
      // Pinned by its bottom edge, so the box grows upward as the list fills
      // and the height never has to be known before it is rendered.
      nextFrame.bottom = window.innerHeight - bounds.top + MENU_GAP_BLOCK_PX;
    } else {
      nextFrame.top = bounds.top;
    }

    if (nextPlacement === 'right') {
      nextFrame.left = bounds.right + MENU_GAP_INLINE_PX;
    } else if (nextPlacement === 'left') {
      nextFrame.right = window.innerWidth - bounds.left + MENU_GAP_INLINE_PX;
    } else {
      // Aligned to the trigger, then pushed back inside the window if that
      // would hang it off an edge. `Math.max` runs last so a menu wider than
      // the window still starts at the left padding rather than off-screen.
      const boxWidth = Math.min(nextWidth, nextMaxWidth);
      nextFrame.left = Math.max(
        viewportPadding,
        Math.min(bounds.left, window.innerWidth - viewportPadding - boxWidth),
      );
    }

    setMenuPlacement((current) =>
      current === nextPlacement ? current : nextPlacement,
    );
    setMenuFrame((current) =>
      current &&
      current.top === nextFrame.top &&
      current.bottom === nextFrame.bottom &&
      current.left === nextFrame.left &&
      current.right === nextFrame.right &&
      current.width === nextFrame.width &&
      current.maxWidth === nextFrame.maxWidth &&
      current.maxHeight === nextFrame.maxHeight
        ? current
        : nextFrame,
    );
  }, [filteredOptions.length, isFilterable, placement]);

  useEffect(() => {
    if (isDisabled) {
      setIsOpen(false);
    }
  }, [isDisabled]);

  useEffect(() => {
    if (isOpen && isFilterable) {
      // Filterable menus are portalled to document.body, so the search field
      // is outside the trigger's subtree. Focus the menu itself after it has
      // mounted; querying dropdownRef here silently misses the input.
      menuRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    }
  }, [isFilterable, isOpen]);

  // A layout effect, not an effect: the menu is already in the document but has
  // no coordinates yet, so measuring after paint would show it at the top-left
  // of the window for one frame before it jumped into place.
  //
  // The capture-phase scroll listener is what keeps a viewport-positioned menu
  // attached to a trigger that scrolls under it — without it the menu would
  // hang in the air while the pane moved beneath.
  useLayoutEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    updateMenuPlacement();
    window.addEventListener('resize', updateMenuPlacement);
    window.addEventListener('scroll', updateMenuPlacement, true);
    return () => {
      window.removeEventListener('resize', updateMenuPlacement);
      window.removeEventListener('scroll', updateMenuPlacement, true);
    };
  }, [isOpen, updateMenuPlacement]);

  // Close the dropdown if the user clicks outside of the dropdown
  useClickOutside<HTMLDivElement>(
    dropdownRef,
    () => {
      setIsOpen(false);
    },
    menuRef,
  );

  // Close the dropdown if the user tabs outside of the dropdown
  useFocusOutside<HTMLDivElement>(
    dropdownRef,
    () => {
      setIsOpen(false);
    },
    menuRef,
  );

  /*
   * TAB ORDER, WHICH THE PORTAL WOULD OTHERWISE HAVE TAKEN AWAY.
   *
   * Tabbing follows document order, and the menu is now at the end of the body
   * rather than beside the trigger. So the keyboard route out of an open menu
   * went wherever the body happened to end — shift-tabbing off the first option
   * landed on whatever the last control in the window was, instead of on the
   * trigger the menu belongs to.
   *
   * Two focusable guards, one on each end of the portalled list, put it back:
   * reaching either means the user has tabbed off that end of the menu, and the
   * focus is redirected to where document order would have sent it if the menu
   * had stayed where it looks like it is. The menu closes on the way through,
   * because leaving it by keyboard is leaving it.
   */
  const focusableInDocumentOrder = () =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !menuRef.current?.contains(element));

  // Off the top of the list: back to the trigger, which is where the menu came
  // from and the only answer that does not feel like a jump.
  const handleGuardBefore = () => {
    setIsOpen(false);
    dropdownRef.current?.querySelector<HTMLElement>('[role="menu"]')?.focus();
  };

  // Off the bottom: on to whatever follows the whole widget, skipping the
  // trigger — tabbing forward past the last option should not land back on the
  // control that opened it.
  const handleGuardAfter = () => {
    const root = dropdownRef.current;
    setIsOpen(false);
    if (!root) {
      return;
    }
    const candidates = focusableInDocumentOrder();
    let lastOwn = -1;
    candidates.forEach((element, index) => {
      if (root.contains(element)) {
        lastOwn = index;
      }
    });
    candidates[lastOwn + 1]?.focus();
  };

  const selectedEntry = useMemo(() => {
    // Default to the first option if the value isn't valid
    const match = options.find((e) => e.value === value);
    return match ? renderOptionDisplay(match) : undefined;
  }, [options, value]);

  const toggleIsOpen = () => {
    setIsOpen((current) => {
      if (!current) {
        setMenuPlacement(placement);
        // Dropped rather than kept, so a menu reopened after the pane has
        // scrolled cannot show for a frame at the position it had last time.
        setMenuFrame(undefined);
      }
      return !current;
    });
  };

  const handleClick = () => {
    if (isDisabled) {
      return;
    }
    toggleIsOpen();
  };

  const listenForEnter = (e: KeyboardEvent) => {
    if (isDisabled) {
      return;
    }
    if (e.code === 'Enter') {
      toggleIsOpen();
    }
  };

  const onChange = (newValue: string) => {
    if (searchString.trim()) {
      onSearchCommit?.(searchString);
    }
    handleChange(newValue);
    setIsOpen(false);
  };

  const listStyle: CSSProperties = menuFrame
    ? {
        top: menuFrame.top !== undefined ? `${menuFrame.top}px` : undefined,
        bottom:
          menuFrame.bottom !== undefined ? `${menuFrame.bottom}px` : undefined,
        left: menuFrame.left !== undefined ? `${menuFrame.left}px` : undefined,
        right:
          menuFrame.right !== undefined ? `${menuFrame.right}px` : undefined,
        maxWidth: `${menuFrame.maxWidth}px`,
        maxHeight: `${menuFrame.maxHeight}px`,
      }
    : // One render before the layout effect measures. Hidden rather than
      // placed at a guess, so nothing is seen in the wrong position.
      { visibility: 'hidden' };

  const menu = isOpen ? (
    <div
      ref={menuRef}
      className={`dropdown-menu-layer dropdown--${menuPlacement}${
        isFilterable ? ' dropdown--filterable' : ''
      }${menuClassName ? ` ${menuClassName}` : ''}`}
      style={
        {
          '--dropdown-trigger-width': `${menuFrame?.width ?? 0}px`,
        } as CSSProperties
      }
    >
      <span
        className="dropdown-menu-layer__guard"
        // Focusable on purpose, and inert to everything else: a guard is
        // landed on and left in the same instant.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        onFocus={handleGuardBefore}
      />
      <List
        name={name}
        value={value}
        options={filteredOptions}
        isDisabled={isDisabled}
        handleChange={onChange}
        emptyOptionsPlaceholder={emptyOptionsPlaceholder}
        focusOnRender={!isFilterable}
        onScroll={handleListScroll}
        startingItem={
          isFilterable ? (
            <div className="dropdown-filter-tools">
              <TextInput
                value={searchString}
                ariaLabel="Filter audio devices"
                isDisabled={isDisabled}
                errorMessage=""
                placeholder={filterPlaceholder}
                handleChange={(newValue) => setSearchString(newValue)}
                handleSubmit={(query) => onSearchCommit?.(query)}
              />
              {searchSuggestions.length > 0 && (
                <div className="dropdown-search-history">
                  <div className="dropdown-search-history__head">
                    <span>{searchHistoryLabel}</span>
                    {onClearSearchHistory && (
                      <button type="button" onClick={onClearSearchHistory}>
                        {clearSearchHistoryLabel}
                      </button>
                    )}
                  </div>
                  <div className="dropdown-search-history__items">
                    {searchSuggestions.map((query) => (
                      <button
                        type="button"
                        key={query}
                        title={query}
                        onClick={() => setSearchString(query)}
                      >
                        <svg viewBox="0 0 16 16" aria-hidden>
                          <path d="M8 4v4l2.6 1.6" />
                          <circle cx="8" cy="8" r="5.6" />
                        </svg>
                        <span>{query}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : undefined
        }
        style={listStyle}
      />
      <span
        className="dropdown-menu-layer__guard"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        onFocus={handleGuardAfter}
      />
    </div>
  ) : null;

  return (
    <div
      ref={dropdownRef}
      className={`dropdown dropdown--${menuPlacement}${
        isFilterable ? ' dropdown--filterable' : ''
      }${isOpen ? ' dropdown--open' : ''}`}
    >
      <div
        role="menu"
        aria-label={name}
        aria-disabled={isDisabled}
        className="row"
        onClick={handleClick}
        onKeyDown={listenForEnter}
        tabIndex={isDisabled ? -1 : 0}
      >
        {options.length !== 0
          ? selectedEntry || noSelectionPlaceholder || nullElement
          : emptyOptionsPlaceholder || nullElement}
        <ArrowIcon type="down" className="arrow" />
      </div>
      {menu && createPortal(menu, document.body)}
    </div>
  );
};

export default Dropdown;
