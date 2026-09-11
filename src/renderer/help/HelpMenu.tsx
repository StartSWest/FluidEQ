/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useRef, useState } from 'react';
import { PRODUCT_NAME } from 'common/branding';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon, { type MenuIconName } from '../icons/MenuIcon';
import HelpGuide from './HelpGuide';
import '../styles/HelpGuide.scss';

interface IHelpMenuProps {
  onTour: () => void;
  onTroubleshoot: () => void;
  onReport: () => void;
  /** Shows the Forum — the project's GitHub Discussions — in the workspace. */
  onForum: () => void;
  onAbout: () => void;
  /**
   * The Forum is what the workspace shows. It has no tab of its own in the
   * titlebar, so the menu it opens from is what says where it is.
   */
  forumOpen: boolean;
}

export default function HelpMenu({
  onTour,
  onTroubleshoot,
  onReport,
  onForum,
  onAbout,
  forumOpen,
}: IHelpMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === 'F1' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        setOpen(false);
        setShowGuide(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  // The Forum sits with the other ways to get help, after reporting a
  // problem: the place to ask people rather than the app. It wears its own
  // picture because, unlike the rest, it opens a place and not a dialog.
  const actions: { label: string; run: () => void; icon: MenuIconName }[] = [
    { label: t('help.title'), run: () => setShowGuide(true), icon: 'info' },
    { label: t('app.menu.whatsNew'), run: onTour, icon: 'info' },
    { label: t('app.menu.fixAudio'), run: onTroubleshoot, icon: 'info' },
    { label: t('app.menu.reportProblem'), run: onReport, icon: 'info' },
    { label: t('tabs.forum'), run: onForum, icon: 'forum' },
    {
      label: t('app.menu.about', { product: PRODUCT_NAME }),
      run: onAbout,
      icon: 'info',
    },
  ];

  return (
    <div className="workspace-header__tools help-menu" ref={root}>
      <button
        ref={trigger}
        type="button"
        className={`workspace-header__tools-trigger help-menu__trigger${forumOpen ? ' is-active' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? 'help-menu' : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {t('help.menu')}
      </button>
      {open && (
        <div
          id="help-menu"
          ref={menu}
          className="workspace-header__menu help-menu__items"
          role="menu"
          tabIndex={-1}
          aria-label={t('help.menu')}
          onBlur={(event) => {
            if (!root.current?.contains(event.relatedTarget)) {
              setOpen(false);
            }
          }}
          onKeyDown={(event) => {
            const items = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>('button'),
            );
            const index = items.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            let next: number | undefined;
            if (event.key === 'ArrowDown') {
              next = (index + 1) % items.length;
            }
            if (event.key === 'ArrowUp') {
              next = (index - 1 + items.length) % items.length;
            }
            if (event.key === 'Home') {
              next = 0;
            }
            if (event.key === 'End') {
              next = items.length - 1;
            }
            if (next !== undefined) {
              event.preventDefault();
              items[next]?.focus();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              trigger.current?.focus();
            }
          }}
        >
          {actions.map((action, index) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              aria-keyshortcuts={index === 0 ? 'F1' : undefined}
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
                action.run();
              }}
            >
              <MenuIcon name={action.icon} />
              <span className="help-menu__label">
                {action.label}
                {index === 0 && <kbd>F1</kbd>}
              </span>
            </button>
          ))}
        </div>
      )}
      {showGuide && <HelpGuide onClose={() => setShowGuide(false)} />}
    </div>
  );
}
