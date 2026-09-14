/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import Chevron from '../icons/Chevron';
import LookIcon from '../icons/LookIcon';
import SceneLookIcon from '../icons/SceneLookIcon';
import { findGalleryScene } from '../plus/galleryStore';
import { useCustomLooks } from '../utils/customLooks';
import { getSelectableLooks, useGraphPalette } from '../utils/graphStyle';
import { useTranslation } from '../utils/I18nContext';
import {
  isUnseenSceneVersion,
  useSeenSceneVersions,
} from '../utils/seenSceneVersions';
import {
  useLockedMemberScenes,
  useUsableMemberScenes,
} from '../utils/memberScenes';
import {
  refreshScenePacks,
  useLockedScenes,
  useUsableScenes,
} from '../utils/scenePacks';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import GraphSceneRemove from './GraphSceneRemove';
import {
  buildPlusRows,
  buildStyleRows,
  categoryName,
  FAMILY_KEYS,
  keepPlus,
  keepStyle,
  makerName,
  matchesSearch,
  plusFilters,
  styleFilters,
  type IPlusRow,
  type IStyleRow,
  type TPlusFilter,
  type TStyleFilter,
} from './lookPickerRows';
import { LockBadge, PICK, SceneThumbnail, walkPicker } from './lookPickerParts';
import '../styles/LookPicker.scss';

/**
 * The graph's style picker: the standard styles and the Plus visualizers side
 * by side, each filed and filterable, over one search.
 *
 * It was a single 268px list, which was fine for forty styles and is not for a
 * collection that grows every week: the Plus scenes sat at the bottom of the
 * styles, a picture's worth of scene was a sixteen-pixel glyph, and there was
 * no way to ask for "something with water in it". Two columns let each half
 * be what it is — a style is a shape, read by its drawing; a visualizer is a
 * picture, read by its thumbnail — and a filter over each lets the list grow
 * without growing longer to scroll.
 *
 * `graph-look-menu` stays on the window: the graph's idle chrome stays up while
 * the pointer is in it, and the auto-cycle waits while it is open.
 */

/** Remembered for the session, so reopening lands where it was left. */
let lastStyleFilter: TStyleFilter = 'all';
let lastPlusFilter: TPlusFilter = 'all';

interface ILookPickerProps {
  /** The selection, not the resolved look: a draft's id is in neither list. */
  value: string;
  disabled: boolean;
  onChoose: (lookId: string) => void;
}

const LookPicker = ({ value, disabled, onChoose }: ILookPickerProps) => {
  const { t, locale } = useTranslation();
  const customLooks = useCustomLooks();
  const palette = useGraphPalette();
  const usable = useUsableScenes();
  const locked = useLockedScenes();
  const members = useUsableMemberScenes();
  const lockedMembers = useLockedMemberScenes();
  // Read for its changes: a look played at a new version loses its mark.
  useSeenSceneVersions();

  const [isOpen, setIsOpen] = useState(false);
  if (disabled && isOpen) {
    setIsOpen(false);
  }
  const [query, setQuery] = useState('');
  const [styleFilter, setStyleFilter] = useState(lastStyleFilter);
  const [plusFilter, setPlusFilter] = useState(lastPlusFilter);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const styleRows = useMemo(
    () =>
      buildStyleRows(
        getSelectableLooks(customLooks, palette, usable, members),
        t,
      ),
    [customLooks, palette, usable, members, t],
  );
  // Rebuilt on every opening as well: the gallery's filing is read, not
  // subscribed to, and a scene browsed in the gallery since should file there.
  const plusRows = useMemo(
    () =>
      buildPlusRows({
        usable,
        locked,
        members,
        lockedMembers,
        locale,
        t,
        findInGallery: findGalleryScene,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isOpen re-reads the gallery store
    [usable, locked, members, lockedMembers, locale, t, isOpen],
  );

  const styleChips = styleFilters(styleRows);
  const plusChips = plusFilters(plusRows);
  const activeStyle = styleChips.includes(styleFilter) ? styleFilter : 'all';
  const activePlus = plusChips.includes(plusFilter) ? plusFilter : 'all';
  const searching = query.trim().length > 0;
  const shownStyles = styleRows.filter((row) =>
    searching ? matchesSearch(row.search, query) : keepStyle(row, activeStyle),
  );
  const shownPlus = plusRows.filter((row) =>
    searching ? matchesSearch(row.search, query) : keepPlus(row, activePlus),
  );

  const close = useCallback((refocus: boolean) => {
    if (refocus) {
      triggerRef.current?.focus();
    }
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointer = (event: Event) => {
      if (
        !rootRef.current?.contains(event.target as Node) &&
        !isInsideAnchoredMenu(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close(isInsideAnchoredMenu(document.activeElement));
        return;
      }
      const menu = searchRef.current?.closest('[data-anchored-menu]');
      if (menu?.contains(document.activeElement)) {
        walkPicker(event, menu);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, close]);

  /**
   * On arrival: the caret in the search and each column scrolled to its chosen
   * row. A ref rather than an effect on `isOpen`, because AnchoredMenu draws
   * nothing until it has placed the window, so on the render that opens it
   * none of this exists yet.
   */
  const arrive = useCallback((columns: HTMLDivElement | null) => {
    if (!columns) {
      return;
    }
    searchRef.current?.focus();
    const chosen = columns.querySelector<HTMLElement>(
      `${PICK}[aria-pressed="true"]`,
    );
    if (chosen && typeof chosen.scrollIntoView === 'function') {
      chosen.scrollIntoView({ block: 'center' });
    }
  }, []);

  const choose = (lookId: string) => {
    onChoose(lookId);
    close(true);
  };

  const toggle = () => {
    if (!isOpen) {
      setQuery('');
      // Opening the looks is when a newer version of one is worth having.
      // The list opens from what is held; whatever changed arrives through
      // the stores' own announcements, marked "New".
      refreshScenePacks().catch(() => undefined);
    }
    setIsOpen(!isOpen);
  };

  const chooseStyleFilter = (filter: TStyleFilter) => {
    lastStyleFilter = filter;
    setStyleFilter(filter);
    setQuery('');
  };
  const choosePlusFilter = (filter: TPlusFilter) => {
    lastPlusFilter = filter;
    setPlusFilter(filter);
    setQuery('');
  };

  const styleChipName = (filter: TStyleFilter) => {
    if (filter === 'all') {
      return t('graph.picker.all');
    }
    return filter === 'yours'
      ? t('graph.picker.yours')
      : t(FAMILY_KEYS[filter]);
  };
  const plusChipName = (filter: TPlusFilter) => {
    if (filter === 'all') {
      return t('graph.picker.all');
    }
    return filter === 'mine' || filter === 'members'
      ? makerName(t, filter)
      : categoryName(t, filter);
  };

  // Only the chosen row, or the first, is a Tab stop in each column: forty
  // Tab presses to get from the styles to the visualizers is not a way there.
  const stopOf = (ids: readonly string[]) =>
    ids.includes(value) ? value : ids[0];
  const styleStop = stopOf(shownStyles.map((row) => row.id));
  const plusStop = stopOf(shownPlus.map((row) => row.id));

  const current: IStyleRow | IPlusRow | undefined =
    styleRows.find((row) => row.id === value) ??
    plusRows.find((row) => row.id === value);

  const renderStyle = (row: IStyleRow) => {
    const selected = row.id === value;
    return (
      <button
        key={row.id}
        type="button"
        className={`look-picker__pick look-picker__style${
          selected ? ' is-selected' : ''
        }`}
        aria-pressed={selected}
        tabIndex={row.id === styleStop ? 0 : -1}
        title={row.name}
        onClick={() => choose(row.id)}
      >
        <span className="look-picker__glyph">
          <LookIcon
            style={row.look.style}
            palette={row.look.palette}
            colours={row.look.colours}
          />
        </span>
        <span
          className={`look-picker__name${
            row.yours ? ' graph-look-name--custom' : ''
          }`}
        >
          {row.name}
        </span>
      </button>
    );
  };

  const renderScene = (row: IPlusRow, index: number) => {
    const selected = row.id === value;
    // Changed since it was last played here: marked until it is played again.
    const fresh = !row.locked && isUnseenSceneVersion(row.id, row.version);
    const heading =
      new Set(shownPlus.map((each) => each.maker)).size > 1 &&
      (index === 0 || shownPlus[index - 1].maker !== row.maker);
    let caption = row.author
      ? t('graph.member.by', { name: row.author })
      : row.categories.map((category) => categoryName(t, category)).join(' · ');
    if (fresh && row.version !== undefined) {
      caption = row.versionNote
        ? t('graph.version.caption', {
            version: String(row.version),
            note: row.versionNote,
          })
        : t('graph.version.captionBare', { version: String(row.version) });
    }
    return [
      heading && (
        <p key={`${row.maker}-heading`} className="look-picker__group">
          {makerName(t, row.maker)}
        </p>
      ),
      <div key={row.id} className="look-picker__item">
        <button
          type="button"
          className={`look-picker__pick look-picker__scene${
            selected ? ' is-selected' : ''
          }${row.locked ? ' is-locked' : ''}`}
          aria-pressed={selected}
          tabIndex={row.id === plusStop ? 0 : -1}
          title={row.locked ? t('graph.scene.locked') : row.name}
          onClick={() => choose(row.id)}
        >
          <SceneThumbnail row={row} />
          <span className="look-picker__scene-text">
            <span className="look-picker__name">{row.name}</span>
            {caption && <span className="look-picker__caption">{caption}</span>}
          </span>
          {fresh && (
            <span className="look-picker__new">{t('graph.version.new')}</span>
          )}
          {row.locked && <LockBadge label={t('graph.scene.badge')} />}
        </button>
        <GraphSceneRemove lookId={row.id} name={row.name} />
      </div>,
    ];
  };

  const chips = <T extends string>(
    filters: readonly T[],
    active: T,
    name: (filter: T) => string,
    pick: (filter: T) => void,
    label: TranslationKey,
  ) => (
    <div
      className="gallery-chips look-picker__chips"
      role="group"
      aria-label={t(label)}
    >
      {filters.map((filter) => (
        <button
          key={filter}
          type="button"
          className="gallery-chip"
          aria-pressed={!searching && filter === active}
          onClick={() => pick(filter)}
        >
          {name(filter)}
        </button>
      ))}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={`dropdown look-picker${isOpen ? ' dropdown--open' : ''}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className="look-picker__trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={t('graph.picker.label')}
        disabled={disabled}
        onClick={toggle}
      >
        {current && (
          <span className="graph-look-option">
            {'look' in current ? (
              <LookIcon
                className="graph-look-option__icon"
                style={current.look.style}
                palette={current.look.palette}
                colours={current.look.colours}
              />
            ) : (
              <SceneLookIcon
                className="graph-look-option__icon"
                swatch={current.swatch}
                lookId={current.id}
              />
            )}
            <span
              className={`graph-look-name${
                'yours' in current && current.yours
                  ? ' graph-look-name--custom'
                  : ''
              }${'maker' in current ? ' graph-look-name--premium' : ''}`}
            >
              {current.name}
            </span>
            {'maker' in current && (
              <span className="graph-look-badge">{t('graph.scene.badge')}</span>
            )}
            {'maker' in current &&
              isUnseenSceneVersion(current.id, current.version) && (
                <span
                  className="look-picker__dot"
                  role="img"
                  aria-label={t('graph.version.dot')}
                  title={t('graph.version.dot')}
                />
              )}
          </span>
        )}
        <Chevron className="arrow" />
      </button>
      <AnchoredMenu
        anchor={rootRef.current}
        isOpen={isOpen}
        className="graph-look-menu look-picker__menu"
        role="dialog"
        ariaLabel={t('graph.picker.label')}
        maxHeight={600}
      >
        <div className="look-picker__search">
          <svg viewBox="0 0 16 16" aria-hidden>
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={query}
            placeholder={t('graph.picker.search')}
            aria-label={t('graph.picker.search')}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              const matches = [...shownStyles, ...shownPlus];
              if (event.key === 'Enter' && searching && matches.length === 1) {
                choose(matches[0].id);
              }
            }}
          />
          {query.length > 0 && (
            <button
              type="button"
              className="menu-search__clear"
              aria-label={t('common.clearSearch')}
              title={t('common.clearSearch')}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
            >
              <svg viewBox="0 0 12 12" aria-hidden>
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          )}
        </div>
        <div ref={arrive} className="look-picker__columns">
          <section
            className="look-picker__column look-picker__column--styles"
            aria-label={t('graph.picker.styles')}
          >
            <header className="look-picker__head">
              <h3>{t('graph.picker.styles')}</h3>
              <span className="look-picker__count">{shownStyles.length}</span>
            </header>
            {chips(
              styleChips,
              activeStyle,
              styleChipName,
              chooseStyleFilter,
              'graph.picker.filterStyles',
            )}
            <div
              className="look-picker__list"
              data-look-picker-scroll
              data-anchored-menu-scroll
            >
              {shownStyles.map(renderStyle)}
              {shownStyles.length === 0 && (
                <p className="look-picker__empty">{t('common.noMatches')}</p>
              )}
            </div>
          </section>
          <section
            className="look-picker__column look-picker__column--plus"
            aria-label={t('graph.picker.plus')}
          >
            <header className="look-picker__head">
              <h3>{t('graph.picker.plus')}</h3>
              <span className="graph-look-badge">{t('graph.scene.badge')}</span>
              <span className="look-picker__count">{shownPlus.length}</span>
            </header>
            {plusRows.length > 0 &&
              chips(
                plusChips,
                activePlus,
                plusChipName,
                choosePlusFilter,
                'graph.picker.filterPlus',
              )}
            <div
              className="look-picker__list"
              data-look-picker-scroll
              data-anchored-menu-scroll
            >
              {shownPlus.flatMap(renderScene)}
              {shownPlus.length === 0 && (
                <p className="look-picker__empty">{t('common.noMatches')}</p>
              )}
            </div>
          </section>
        </div>
      </AnchoredMenu>
    </div>
  );
};

// Memoised: the chart around it re-renders on every reading it plots, and
// the closed trigger's value, disabled state and handler rarely change.
export default memo(LookPicker);
