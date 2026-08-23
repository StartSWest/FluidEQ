/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
  createRef,
  Fragment,
  KeyboardEvent,
  MouseEvent,
  UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  ReactElement,
  ReactNode,
  CSSProperties,
} from 'react';
import '../styles/List.scss';

export interface IOptionEntry {
  value: string;
  label: string;
  /**
   * The row's content. May be a thunk, which is what catalogues in the
   * thousands should pass: the list only ever mounts a page of rows, so
   * building an element tree for every entry up front costs far more than the
   * data it is built from.
   */
  display: ReactNode | (() => ReactNode);
  /** Optional non-interactive section heading displayed above this option. */
  group?: string;
}

/** Resolves an entry's content, whether it was given as a node or a thunk. */
export const renderOptionDisplay = (entry: {
  display: ReactNode | (() => ReactNode);
}): ReactNode =>
  typeof entry.display === 'function' ? entry.display() : entry.display;

interface IListProps {
  name: string;
  options: IOptionEntry[];
  value: string;
  isDisabled: boolean;
  handleChange: (newValue: string, e?: MouseEvent) => void;
  className?: string;
  itemClassName?: string;
  focusOnRender?: boolean;
  startingItem?: ReactElement;
  emptyOptionsPlaceholder?: ReactNode;
  style?: CSSProperties;
  /** Fires as the list scrolls; used to append the next page of results. */
  onScroll?: (event: UIEvent<HTMLUListElement>) => void;
}

const List = ({
  name,
  options,
  value,
  isDisabled,
  handleChange,
  className,
  itemClassName,
  focusOnRender = false,
  startingItem,
  emptyOptionsPlaceholder = 'No options found.',
  style,
  onScroll,
}: IListProps) => {
  const inputRefs = useMemo(
    () =>
      Array(options.length)
        .fill(0)
        .map(() => createRef<HTMLLIElement>()),
    [options],
  );

  /**
   * Once per opening, and that is the whole point of the ref.
   *
   * Focusing an element inside a scroller makes the browser scroll it back
   * into view, so this effect is a "jump to the selected row" in disguise. Its
   * dependencies include `options` and the refs derived from them, and callers
   * build that array inline — a fresh identity on every render. Anything that
   * re-rendered the open menu therefore re-ran this and dragged the list back
   * to the selected row, which is exactly what "I pick Clásica, scroll, and it
   * returns to Clásica" is. The list could not be scrolled away from its own
   * selection at all.
   *
   * Reset when the list closes, so the next opening still lands on the
   * selected row.
   */
  const hasFocusedSelection = useRef(false);
  useEffect(() => {
    if (!focusOnRender) {
      hasFocusedSelection.current = false;
      return;
    }
    if (hasFocusedSelection.current) {
      return;
    }
    hasFocusedSelection.current = true;
    const index = options.findIndex((entry) => entry.value === value);
    if (index >= 0) {
      // Focus WITHOUT its scroll, then centre deliberately. Focusing a row
      // inside a scroller brings it to the nearest edge, so a selection near
      // the bottom of a long list opened flush against the bottom of the menu
      // with everything after it out of sight and no sign there was more.
      inputRefs[index].current?.focus({ preventScroll: true });
      // Not smooth: this runs as the menu appears, and an animated scroll
      // starting at that moment is something the first flick of the wheel has
      // to fight.
      inputRefs[index].current?.scrollIntoView({ block: 'center' });
    }
  }, [focusOnRender, inputRefs, options, value]);

  const onClick = useCallback(
    (newValue: string) => (e: MouseEvent) => {
      handleChange(newValue, e);
    },
    [handleChange],
  );

  const onMouseEnter = useCallback(
    (index: number) => () => {
      // Give focus on mouseenter if focus wasn't already within the element
      if (!inputRefs[index].current?.contains(document.activeElement)) {
        inputRefs[index].current?.focus();
      }
    },
    [inputRefs],
  );

  const handleItemKeyPress = useCallback(
    (entry: IOptionEntry, index: number) => (e: KeyboardEvent) => {
      if (isDisabled) {
        return;
      }
      if (e.code === 'Enter') {
        handleChange(entry.value);
      } else if (e.code === 'ArrowDown') {
        const next = Math.min(index + 1, options.length - 1);
        inputRefs[next].current?.focus();
      } else if (e.code === 'ArrowUp') {
        const prev = Math.max(index - 1, 0);
        inputRefs[prev].current?.focus();
      }
    },
    [inputRefs, isDisabled, handleChange, options.length],
  );

  return (
    <div className={`list-wrapper ${className || ''}`} style={style}>
      {startingItem && (
        <div role="menuitem" className="row starting-item">
          {startingItem}
        </div>
      )}
      <ul
        className={`list ${className || ''}`}
        aria-label={`${name}-items`}
        onScroll={onScroll}
      >
        {options.map((entry: IOptionEntry, index: number) => {
          const showGroup =
            Boolean(entry.group) &&
            (index === 0 || entry.group !== options[index - 1].group);
          return (
            <Fragment key={entry.value}>
              {showGroup && (
                <li role="presentation" className="list-group-heading">
                  {entry.group}
                </li>
              )}
              <li
                role="menuitem"
                ref={inputRefs[index]}
                className={`row ${itemClassName || ''} ${
                  entry.value === value ? 'selected' : ''
                }`}
                value={entry.value}
                aria-label={entry.label}
                onClick={onClick(entry.value)}
                onKeyDown={handleItemKeyPress(entry, index)}
                onMouseEnter={onMouseEnter(index)}
                tabIndex={0}
              >
                {renderOptionDisplay(entry)}
              </li>
            </Fragment>
          );
        })}
        {options.length === 0 && (
          <li
            role="menuitem"
            className={`row ${itemClassName || ''} `}
            tabIndex={0}
          >
            {emptyOptionsPlaceholder}
          </li>
        )}
      </ul>
    </div>
  );
};

export default List;
