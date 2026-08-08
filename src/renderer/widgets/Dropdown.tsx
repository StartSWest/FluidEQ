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
  KeyboardEvent,
  UIEvent,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  createElement,
  ReactNode,
} from 'react';
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
  placement?: 'up' | 'down' | 'left' | 'right';
  handleChange: (newValue: string) => void;
}

type DropdownPlacement = 'up' | 'down' | 'left' | 'right';

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
  placement = 'down',
}: IDropdownProps) => {
  const nullElement = createElement('div');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [menuPlacement, setMenuPlacement] =
    useState<DropdownPlacement>(placement);
  const [menuOffsetX, setMenuOffsetX] = useState(0);
  const [menuMaxHeight, setMenuMaxHeight] = useState<number>();
  const [menuMaxWidth, setMenuMaxWidth] = useState<number>();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [searchString, setSearchString] = useState<string>('');
  const deferredSearchString = useDeferredValue(searchString);
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

    const viewportPadding = 16;
    const renderedMenu =
      dropdownRef.current?.querySelector<HTMLElement>('.list-wrapper');
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
    const nextOffsetX = isHorizontalPlacement
      ? 0
      : Math.max(
          viewportPadding - bounds.left,
          Math.min(
            0,
            window.innerWidth - viewportPadding - bounds.left - menuWidth,
          ),
        );
    const nextMaxWidth = isHorizontalPlacement
      ? Math.max(
          180,
          Math.min(
            window.innerWidth - viewportPadding * 2,
            nextPlacement === 'left' ? availableLeft - 8 : availableRight - 8,
          ),
        )
      : Math.max(180, window.innerWidth - viewportPadding * 2);

    setMenuPlacement((current) =>
      current === nextPlacement ? current : nextPlacement,
    );
    setMenuOffsetX((current) =>
      current === nextOffsetX ? current : nextOffsetX,
    );
    setMenuMaxHeight(Math.max(80, Math.min(360, availableHeight)));
    setMenuMaxWidth(nextMaxWidth);
  }, [filteredOptions.length, isFilterable, placement]);

  useEffect(() => {
    if (isDisabled) {
      setIsOpen(false);
    }
  }, [isDisabled]);

  useEffect(() => {
    if (isOpen && isFilterable) {
      dropdownRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    }
  }, [isFilterable, isOpen]);

  useEffect(() => {
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
  useClickOutside<HTMLDivElement>(dropdownRef, () => {
    setIsOpen(false);
  });

  // Close the dropdown if the user tabs outside of the dropdown
  useFocusOutside<HTMLDivElement>(dropdownRef, () => {
    setIsOpen(false);
  });

  const selectedEntry = useMemo(() => {
    // Default to the first option if the value isn't valid
    const match = options.find((e) => e.value === value);
    return match ? renderOptionDisplay(match) : undefined;
  }, [options, value]);

  const toggleIsOpen = () => {
    setIsOpen((current) => {
      if (!current) {
        setMenuPlacement(placement);
        setMenuOffsetX(0);
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
    handleChange(newValue);
    setIsOpen(false);
  };

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
      {isOpen && (
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
              <TextInput
                value={searchString}
                ariaLabel="Filter audio devices"
                isDisabled={isDisabled}
                errorMessage=""
                placeholder={filterPlaceholder}
                handleChange={(newValue) => setSearchString(newValue)}
              />
            ) : undefined
          }
          style={
            menuOffsetX !== 0 ||
            menuMaxHeight !== undefined ||
            menuMaxWidth !== undefined
              ? {
                  maxWidth:
                    menuMaxWidth !== undefined
                      ? `${menuMaxWidth}px`
                      : 'calc(100vw - 24px)',
                  maxHeight:
                    menuMaxHeight !== undefined
                      ? `${menuMaxHeight}px`
                      : 'calc(100vh - 24px)',
                  transform: `translateX(${menuOffsetX}px)`,
                }
              : undefined
          }
        />
      )}
    </div>
  );
};

export default Dropdown;
