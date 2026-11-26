/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  Fragment,
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import MenuIcon, { type MenuIconName } from '../../icons/MenuIcon';
import AnchoredMenu, { isInsideAnchoredMenu } from '../../widgets/AnchoredMenu';

export interface IPresetMenuItem {
  key: string;
  icon: MenuIconName;
  label: string;
  run: () => void;
  isDanger?: boolean;
  isDisabled?: boolean;
  /** The first of a group of its own, set apart by a rule. */
  startsGroup?: boolean;
}

/**
 * Whether a preset card's menu is open, and the two ways in that are not its
 * button: a right-click on the card, and the keyboard's menu key or
 * Shift+F10 on it, which the browser sends as the same `contextmenu`. Both
 * open the one menu the card's ⋯ opens (Ivan, 2026-11-26: "right click on
 * presets, edit a copy", "also add like the icon for options").
 */
export const usePresetMenu = () => {
  const [isOpen, setOpen] = useState(false);
  const onContextMenu = (event: ReactMouseEvent) => {
    // A field being renamed keeps the system's own menu: cut, copy, paste.
    if (event.target instanceof HTMLInputElement) {
      return;
    }
    event.preventDefault();
    setOpen(true);
  };
  return { isOpen, setOpen, onContextMenu };
};

interface IPresetMenuProps {
  /** The preset's name, at the menu's head. */
  subject: string;
  /** The ⋯ button's name, which the menu is named by too. */
  label: string;
  items: readonly IPresetMenuItem[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** The ⋯ button's class: each card places it its own way. */
  buttonClassName: string;
  onPoint?: () => void;
}

/**
 * A preset card's ⋯ and the menu it opens. A press anywhere but the menu and
 * its button closes it, as every menu here closes; Escape too, and the focus
 * goes back to the button. Opened, the focus goes to its first item and the
 * arrows walk the items, so a menu opened from the keys is used from them:
 * the menu is drawn in a portal, where Tab from the button never reaches.
 */
const PresetMenu = ({
  subject,
  label,
  items,
  isOpen,
  onOpenChange,
  buttonClassName,
  onPoint,
}: IPresetMenuProps) => {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        !isInsideAnchoredMenu(event.target) &&
        !anchor?.contains(event.target as Node)
      ) {
        onOpenChange(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
        anchor?.focus();
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [anchor, isOpen, onOpenChange]);

  // The first item takes the focus when the items arrive: AnchoredMenu
  // mounts what it holds a render after it is opened, so an effect of the
  // opening found nothing yet. Attached once per opening.
  const takeFocus = useCallback((node: HTMLDivElement | null) => {
    node
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
      ?.focus({ preventScroll: true });
  }, []);

  const walk = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    event.preventDefault();
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ),
    );
    const at = buttons.findIndex((one) => one === document.activeElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    buttons[(at + step + buttons.length) % buttons.length]?.focus();
  };

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className={buttonClassName}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onPointerEnter={onPoint}
        onClick={() => onOpenChange(!isOpen)}
      >
        <MenuIcon name="menu" />
      </button>
      <AnchoredMenu
        anchor={anchor}
        isOpen={isOpen}
        className="band-menu own-preset-menu"
        ariaLabel={label}
      >
        {/* The keys are heard on the items' own box: AnchoredMenu draws
            the menu's frame, and this is what lies inside it. */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- the arrows walk the menu items inside; each item is its own button */}
        <div ref={takeFocus} className="preset-menu__items" onKeyDown={walk}>
          <p className="band-menu__subject">{subject}</p>
          {items.map((item) => (
            <Fragment key={item.key}>
              {item.startsGroup && (
                <span className="band-menu__rule" role="separator" />
              )}
              <button
                type="button"
                role="menuitem"
                className={item.isDanger ? 'is-danger' : undefined}
                disabled={item.isDisabled}
                onClick={() => {
                  onOpenChange(false);
                  item.run();
                }}
              >
                <MenuIcon name={item.icon} className="band-menu__icon" />
                <span>{item.label}</span>
              </button>
            </Fragment>
          ))}
        </div>
      </AnchoredMenu>
    </>
  );
};

export default PresetMenu;
