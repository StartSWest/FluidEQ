/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  Fragment,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from '../utils/I18nContext';
import Chevron from '../icons/Chevron';
import AnchoredMenu, { isInsideAnchoredMenu } from './AnchoredMenu';
import '../styles/RichPick.scss';

/** One row: what it is called, what it does, and what it looks like. */
export interface IRichPickEntry {
  id: string;
  name: string;
  /** The line under the name. Searched as well as shown. */
  hint: string;
  /**
   * Which heading it files under. The empty string files under none, which is
   * how an entry that belongs above the list — "None", "Default" — gets there
   * without a section of its own.
   */
  group: string;
  icon: ReactNode;
}

interface IRichPickProps {
  entries: readonly IRichPickEntry[];
  /** The heading for a group key, or `''` for a group that gets no heading. */
  groupLabel: (group: string) => string;
  activeId: string;
  onPick: (id: string) => void;
  /** What the trigger says when `activeId` matches nothing. */
  placeholder: string;
  triggerAriaLabel: string;
  triggerTitle: string;
  /** Shown when nothing is chosen, since there is no entry to take one from. */
  placeholderIcon: ReactNode;
  disabled?: boolean;
  /** Extra classes on the root, for a caller with styling of its own. */
  className?: string;
  /** Extra classes on the trigger — a bypassed state, for instance. */
  triggerClassName?: string;
  /** Rendered inside the trigger's label, after the name. */
  triggerExtra?: ReactNode;
  /** Rendered in the root under the trigger, for a caller's own messages. */
  children?: ReactNode;
}

/**
 * Everything a search has to ignore to match the way a person expects.
 *
 * Case and accents both: somebody looking for "Clásica" types "clasica", and
 * somebody looking for "Lo-fi" types "lofi". Latin-1 decomposition covers every
 * language this app ships in that uses accents at all — the CJK locales do not
 * decompose and do not need to.
 */
const foldForSearch = (text: string) =>
  text
    .normalize('NFD')
    // Written as escapes because the literal range is four invisible combining
    // marks, which look like a typo and get "tidied" into one.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * A pill that names what is chosen, over a searchable list of what else there
 * is.
 *
 * Written for the voicing quick pick and now worn by the DSP preset picker as
 * well, which is the whole point of it being here: the two lists have nothing
 * in common except that both are long, both need a line saying what each entry
 * does, and both are used the same way — open, look, choose, listen. Keeping
 * them as one component is what stops them drifting into two similar menus that
 * behave differently, which is what they were.
 *
 * What an entry MEANS stays with the caller. This renders names and hints and
 * reports an id; applying it is the caller's, because applying a preset to the
 * DSP rack and applying a voicing to the APO config have nothing to share.
 */
const RichPick = ({
  entries,
  groupLabel,
  activeId,
  onPick,
  placeholder,
  triggerAriaLabel,
  triggerTitle,
  placeholderIcon,
  disabled,
  className,
  triggerClassName,
  triggerExtra,
  children,
}: IRichPickProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  // A DSP source change can disable the trigger while its portaled menu is
  // open. The menu must stop accepting selections in that same render.
  if (disabled && isOpen) {
    setIsOpen(false);
  }
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  /**
   * What the trigger names, which the empty id is deliberately never.
   *
   * Both callers use `''` for "nothing applied" — no voicing, or a hand-made
   * curve that is nobody's preset — and both want the pill to say that in
   * their own words rather than name a row. Voicing has a "None" row too, and
   * it stays pickable; it just is not something the pill reports, because a
   * pill lit up reading "None" claims a voicing is applied.
   */
  const active = activeId
    ? entries.find((entry) => entry.id === activeId)
    : undefined;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const close = (event: Event) => {
      // The menu is portalled out of the panel that clips, so it is no longer
      // inside the trigger and has to be asked about separately.
      if (
        !rootRef.current?.contains(event.target as Node) &&
        !isInsideAnchoredMenu(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  /**
   * Opening starts a fresh search, at the entry that is already chosen.
   *
   * Both halves matter. A menu that reopens still filtered hides the entry you
   * came back for, and the filter is at the top of a list you may have scrolled
   * — so the list looks short rather than filtered. And with forty-six entries
   * the chosen one is usually off screen, which made the menu open looking like
   * nothing was selected at all.
   */
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }
    // jsdom implements neither, and the tests that open this menu are not about
    // either one.
    if (typeof activeRef.current?.scrollIntoView === 'function') {
      activeRef.current.scrollIntoView({ block: 'center' });
    }
    searchRef.current?.focus();
  }, [isOpen]);

  const matches = useMemo(() => {
    const needle = foldForSearch(query.trim());
    if (!needle) {
      return entries;
    }
    // The group heading counts as part of every entry under it, so typing
    // "genre" brings back the genres — the heading is on screen next to the
    // names and reads as something you can search for.
    return entries.filter((entry) =>
      foldForSearch(
        `${entry.name} ${entry.hint} ${groupLabel(entry.group)}`,
      ).includes(needle),
    );
  }, [entries, groupLabel, query]);

  const pick = (id: string) => {
    setIsOpen(false);
    onPick(id);
  };

  return (
    <div
      className={`rich-pick${className ? ` ${className}` : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`rich-pick__trigger${active ? ' is-active' : ''}${
          triggerClassName ? ` ${triggerClassName}` : ''
        }`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={triggerAriaLabel}
        title={triggerTitle}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        {active ? active.icon : placeholderIcon}
        <span>
          {active ? active.name : placeholder}
          {triggerExtra}
        </span>
        {/* It opens a menu, and nothing on it said so — it read as a button
            that does something, in a row of buttons that do. The same chevron
            the mode picker carries, turning over when it is open. */}
        <Chevron className="rich-pick__caret" />
      </button>

      {children}

      {/* Out of the panel, because the panel clips — see AnchoredMenu. This one
          is as tall as the list, so near the bottom of a scrolled editor it was
          losing its last entries entirely. */}
      <AnchoredMenu
        anchor={rootRef.current}
        isOpen={isOpen}
        className="rich-pick__menu"
      >
        <div className="rich-pick__search">
          <svg viewBox="0 0 16 16" aria-hidden>
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={query}
            placeholder={t('common.search')}
            aria-label={t('common.search')}
            onChange={(event) => setQuery(event.target.value)}
            // Enter picks the only thing left, which is how a search that has
            // narrowed to one entry is expected to end. Without it the last
            // step of every search was reaching for the mouse.
            onKeyDown={(event) => {
              if (event.key === 'Enter' && matches.length === 1) {
                pick(matches[0].id);
              }
            }}
          />
          {query.length > 0 && (
            <button
              type="button"
              className="menu-search__clear"
              aria-label={t('common.clearSearch')}
              title={t('common.clearSearch')}
              // Pressing a button focuses it, and this one unmounts on the
              // very next render, so without this the caret would land on
              // the body and the next keystroke would go nowhere.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
            >
              <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          )}
        </div>

        {matches.length === 0 && (
          <p className="rich-pick__empty">{t('common.noMatches')}</p>
        )}

        {matches.map((entry, index) => {
          const heading = groupLabel(entry.group);
          return (
            <Fragment key={entry.id}>
              {/* A heading at each change of group, rather than a fixed set of
                  sections, so adding an entry to any of them cannot leave it
                  filed under the wrong header — and so a filtered list shows
                  headings only for the groups that still have something in
                  them. */}
              {heading && entry.group !== matches[index - 1]?.group && (
                <span className="rich-pick__group" role="presentation">
                  {heading}
                </span>
              )}
              <button
                ref={entry.id === activeId ? activeRef : undefined}
                type="button"
                role="menuitemradio"
                aria-checked={entry.id === activeId}
                className={`rich-pick__item${
                  entry.id === activeId ? ' is-active' : ''
                }`}
                onClick={() => pick(entry.id)}
              >
                {entry.icon}
                <span>
                  <strong>{entry.name}</strong>
                  <small>{entry.hint}</small>
                </span>
              </button>
            </Fragment>
          );
        })}
      </AnchoredMenu>
    </div>
  );
};

export default RichPick;
