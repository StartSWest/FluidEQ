/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { Fragment, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import useExitAnimation from '../utils/useExitAnimation';
import MenuIcon from '../icons/MenuIcon';
import ForumNewsBadge, {
  forumNewsText,
  useForumNewsCount,
} from '../forum/ForumNewsBadge';
import ForumNewsMenuItems from '../forum/ForumNewsMenuItems';
import { useForumNewsHidden } from '../forum/forumNewsPref';
import { watchForumNews } from '../forum/forumStore';
import HelpGuide from './HelpGuide';
import { onHelpGuideRequest } from './helpGuideRequests';
import helpMenuActions, { type IHelpHandlers } from './helpMenuActions';
import '../styles/HelpGuide.scss';

interface IHelpMenuProps extends IHelpHandlers {
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
  const { t, locale } = useTranslation();
  const news = useForumNewsCount();
  // Switched off, the count leaves this button and its menu.
  const newsHidden = useForumNewsHidden();
  const shown = newsHidden ? 0 : news;
  const [open, setOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  // Folds back into the button when it closes, as every other menu does,
  // rather than blinking out (`menu-out`).
  const exit = useExitAnimation(open, 'menu-out', menu);

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

  // The Forum's count of what is new, kept fresh from here: this menu is
  // mounted for as long as the titlebar is, including while its button has
  // given way to the actions menu, which shows the count instead. Nothing
  // reads the Forum in the background while the count is switched off.
  useEffect(() => (newsHidden ? undefined : watchForumNews()), [newsHidden]);

  // Asked for from elsewhere: What's New's "Open Help".
  useEffect(
    () =>
      onHelpGuideRequest(() => {
        setOpen(false);
        setShowGuide(true);
      }),
    [],
  );

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

  const actions = helpMenuActions(
    t,
    { onTour, onTroubleshoot, onReport, onForum, onAbout },
    () => setShowGuide(true),
  );
  // "Help · New: 12" — two names the app already has in every language,
  // joined by a mark that reads as a separator in all ten.
  const name =
    shown > 0
      ? `${t('help.menu')} · ${t('forum.new.countLabel', {
          count: forumNewsText(shown, locale),
        })}`
      : t('help.menu');
  const runRow = (action: () => void) => () => {
    setOpen(false);
    trigger.current?.focus();
    action();
  };

  return (
    <div className="workspace-header__tools help-menu" ref={root}>
      <button
        ref={trigger}
        type="button"
        className={`workspace-header__tools-trigger help-menu__trigger${forumOpen ? ' is-active' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? 'help-menu' : undefined}
        aria-label={name}
        title={name}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {/* A glyph, not the word: this menu is one of the three things in the
            titlebar's instrument capsule now, beside the engine's own menu
            (Ivan, 2026-09-22: "put the help menu as icon next to the other
            menu icon inside the pill"). Its name is on the label and the
            tooltip, as every other glyph in this strip's is. */}
        <MenuIcon name="guide" />
        <ForumNewsBadge count={shown} placement="corner" />
      </button>
      {exit.present && (
        <div
          id="help-menu"
          ref={menu}
          className="workspace-header__menu help-menu__items"
          role="menu"
          tabIndex={-1}
          aria-label={t('help.menu')}
          data-closing={exit.closing ? '' : undefined}
          inert={exit.closing}
          onAnimationEnd={exit.onAnimationEnd}
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
            <Fragment key={action.label}>
              <button
                type="button"
                role="menuitem"
                className="workspace-header__menu-item"
                aria-keyshortcuts={index === 0 ? 'F1' : undefined}
                onClick={runRow(action.run)}
              >
                <MenuIcon name={action.icon} />
                <span className="help-menu__label">
                  {action.label}
                  {index === 0 && <kbd>F1</kbd>}
                  {action.id === 'forum' && (
                    <ForumNewsBadge count={shown} placement="row" />
                  )}
                </span>
              </button>
              {action.id === 'forum' && (
                <ForumNewsMenuItems
                  news={news}
                  hidden={newsHidden}
                  run={runRow}
                />
              )}
            </Fragment>
          ))}
        </div>
      )}
      {showGuide && <HelpGuide onClose={() => setShowGuide(false)} />}
    </div>
  );
}
