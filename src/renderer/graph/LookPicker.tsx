/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useAddonCapabilities } from '../addons';
import Chevron from '../icons/Chevron';
import LookIcon from '../icons/LookIcon';
import SceneLookIcon from '../icons/SceneLookIcon';
import { useGalleryFinder } from '../plus/galleryStore';
import { useFluidEqHelpers } from '../plus/sceneStore';
import { useCustomLooks } from '../utils/customLooks';
import { useHoldGraphAutoCycle } from '../utils/graphAutoCycle';
import { getSelectableLooks, useGraphPalette } from '../utils/graphStyle';
import { useTranslation } from '../utils/I18nContext';
import {
  isUnseenSceneVersion,
  useSeenSceneVersions,
} from '../utils/seenSceneVersions';
import {
  listedLookOf,
  useLockedMemberScenes,
  useUsableMemberScenes,
} from '../utils/memberScenes';
import {
  refreshScenePacks,
  useLockedScenes,
  useUsableScenes,
} from '../utils/scenePacks';
import { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import LookPickerBody from './LookPickerBody';
import LookPickerWindow from './LookPickerWindow';
import {
  freshnessOf,
  isStylePlace,
  keepFrom,
  keepSceneIn,
  keepStyleIn,
  type TPickerFrom,
  type TPickerPlace,
  type TPickerSort,
  type TPickerView,
} from './lookPickerFilter';
import {
  buildPlusRows,
  buildStyleRows,
  type IPlusRow,
  type IStyleRow,
} from './lookPickerRows';
import { followPlaying } from './lookPickerFollow';
import { walkPicker } from './lookPickerParts';
import '../styles/LookPicker.scss';

/**
 * The graph's look picker: every standard style and scene, laid out as the
 * Library is (Ivan, 2026-11-19) - places down a rail, who made a look in tabs
 * of its own, the looks as pictures - over one search (`LookPickerBody`).
 *
 * It was a single 268px list, which was fine for forty styles and is not for a
 * collection that grows every week: the Plus scenes sat at the bottom of the
 * styles, a picture's worth of scene was a sixteen-pixel glyph, and there was
 * no way to ask for "something with water in it". Two columns with rows of
 * filter pills came next, and the pills wrapped into two rows with the makers
 * mixed in among the categories; the rail names every place with its count.
 *
 * `graph-look-menu` stays on the window: the graph's idle chrome stays up while
 * the pointer is in it. The auto-cycle waits while it is open
 * (`useHoldGraphAutoCycle`).
 */

/** Remembered for the session, so reopening lands where it was left. */
let lastPlace: TPickerPlace = 'everything';
let lastFrom: TPickerFrom = 'all';
let lastSort: TPickerSort = 'newest';
let lastView: TPickerView = 'grid';

interface ILookPickerProps {
  /** The selection, not the resolved look: a draft's id is in neither list. */
  value: string;
  disabled: boolean;
  onChoose: (lookId: string) => void;
  /**
   * Something else to press, in place of the pill that names the look.
   *
   * A slot rather than a mode: the list it opens, how it searches and what
   * choosing does are the same either way — only what is pressed differs.
   * The player's narrow layout has no room for a named pill and opens the
   * same explorer from the mark at the end of its transport (Ivan,
   * 2026-09-22).
   */
  trigger?: ReactNode;
  triggerClassName?: string;
  triggerTitle?: string;
  /**
   * What a plain press on that trigger does instead of opening the list.
   *
   * Given one, the explorer moves to the right-press: stepping through the
   * looks is what somebody does over and over, and browsing all of them is
   * the deliberate act (Ivan, 2026-09-22).
   */
  onTriggerPress?: (event: ReactMouseEvent) => void;
}

const LookPicker = ({
  value,
  disabled,
  onChoose,
  trigger,
  triggerClassName,
  triggerTitle,
  onTriggerPress,
}: ILookPickerProps) => {
  const { t, locale } = useTranslation();
  const customLooks = useCustomLooks();
  const palette = useGraphPalette();
  const usable = useUsableScenes();
  const locked = useLockedScenes();
  const members = useUsableMemberScenes();
  const lockedMembers = useLockedMemberScenes();
  const fluidEqHelpers = useFluidEqHelpers();
  const findInGallery = useGalleryFinder();
  // FluidEQ's own scenes are this account's too when it publishes them.
  const { ownsOfficialScenes } = useAddonCapabilities();
  // Read for its changes: a look played at a new version loses its mark.
  useSeenSceneVersions();

  const [isOpen, setIsOpen] = useState(false);
  if (disabled && isOpen) {
    setIsOpen(false);
  }
  useHoldGraphAutoCycle(isOpen);
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState(lastPlace);
  const [from, setFrom] = useState(lastFrom);
  const [sort, setSort] = useState(lastSort);
  const [view, setView] = useState(lastView);
  // What counts as new is decided as the picker opens, not while it is open.
  const [openedAt, setOpenedAt] = useState<number | undefined>(undefined);
  // Whether the window still shows the playing look, from the opening until
  // the reader looks elsewhere (`followPlaying`).
  const [follow, setFollow] = useState(false);
  const following = isOpen && follow;
  const [body, setBody] = useState<HTMLDivElement | null>(null);
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
  // Rebuilt whenever a gallery list changes, open or not: the marks, sorts
  // and categories are the gallery's word, and the Scenes tab and this
  // window read the same lists (`useGalleryFinder`).
  const plusRows = useMemo(
    () =>
      buildPlusRows({
        usable,
        locked,
        members,
        lockedMembers,
        locale,
        t,
        findInGallery,
        fluidEqHelpers,
      }),
    [
      usable,
      locked,
      members,
      lockedMembers,
      locale,
      t,
      findInGallery,
      fluidEqHelpers,
    ],
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
      if (!menu?.contains(document.activeElement)) {
        return;
      }
      // The window opens with the keyboard on the playing tile, and a
      // letter typed there is still a search: the caret moves to the box
      // before the key's character lands, so the character lands in it.
      const typed =
        event.key.length === 1 &&
        event.key !== ' ' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey;
      if (typed && !(document.activeElement instanceof HTMLInputElement)) {
        searchRef.current?.focus();
        return;
      }
      walkPicker(event, menu);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, close]);

  // On arrival, and through every change to the list while the window is
  // open, the playing look's tile is kept centred and focused until the
  // reader takes over (`followPlaying`). The body is state, not a ref read
  // on `isOpen`, because AnchoredMenu draws nothing until it has placed the
  // window, so on the render that opens it none of this exists yet.
  useLayoutEffect(() => {
    if (!following || !body) {
      return undefined;
    }
    return followPlaying(body, () => setFollow(false));
  }, [following, body]);

  const choose = (lookId: string) => {
    onChoose(lookId);
    close(true);
  };

  const toggle = () => {
    if (!isOpen) {
      setQuery('');
      setOpenedAt(Date.now());
      setFollow(true);
      // Opening the looks is when a newer version of one is worth having.
      // The list opens from what is held; whatever changed arrives through
      // the stores' own announcements, marked "New".
      refreshScenePacks().catch(() => undefined);
    }
    setIsOpen(!isOpen);
  };

  // Pressing a place leaves the search: a place is a way of asking too. A
  // family of styles leaves the From tab too: From is not offered there, so
  // its counts in the rail are every maker's, and the tab must not come
  // back to narrow the next place the rail just counted unnarrowed.
  // A place, a maker tab or a search is the reader looking somewhere else:
  // the playing look stops being followed. A new order or view is the same
  // looks laid out again, and the playing one is still what is shown.
  const choosePlace = (next: TPickerPlace) => {
    setFollow(false);
    lastPlace = next;
    setPlace(next);
    setQuery('');
    if (isStylePlace(next)) {
      lastFrom = 'all';
      setFrom('all');
    }
  };
  const search = (next: string) => {
    setFollow(false);
    setQuery(next);
  };
  const chooseFrom = (next: TPickerFrom) => {
    setFollow(false);
    lastFrom = next;
    setFrom(next);
  };
  const chooseSort = (next: TPickerSort) => {
    lastSort = next;
    setSort(next);
  };
  const chooseView = (next: TPickerView) => {
    lastView = next;
    setView(next);
  };

  // The row the selection is shown as: a publisher's own copy of one of
  // FluidEQ's scenes is that scene's row (`listedLookOf`), so the pill names
  // it and the window marks it as playing.
  const shown = listedLookOf(value, members, usable);
  const current: IStyleRow | IPlusRow | undefined =
    styleRows.find((row) => row.id === shown) ??
    plusRows.find((row) => row.id === shown);

  // THE WINDOW OPENS ON THE LOOK THAT IS PLAYING (Ivan, 2026-11-24 and
  // 11-26). The place and maker tab left last time are kept when they hold
  // it; otherwise the window stands on the look's own place, every maker.
  // Decided in the render while the look is followed, not once as the
  // window opens: the rows are rebuilt from the gallery while it is open,
  // and a look whose row arrived after the press was decided without.
  if (following && current) {
    const shows =
      'look' in current
        ? keepStyleIn(current, place)
        : keepSceneIn(current, place, freshnessOf(current, openedAt));
    if (!shows) {
      const own: TPickerPlace =
        'look' in current ? current.family : 'all-scenes';
      lastPlace = own;
      setPlace(own);
    }
    if (!keepFrom(current, from, ownsOfficialScenes)) {
      lastFrom = 'all';
      setFrom('all');
    }
  }

  return (
    <div
      ref={rootRef}
      className={`dropdown look-picker${isOpen ? ' dropdown--open' : ''}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName ?? 'look-picker__trigger'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={triggerTitle ?? t('graph.picker.label')}
        title={triggerTitle}
        disabled={disabled}
        onClick={onTriggerPress ?? toggle}
        onContextMenu={
          onTriggerPress
            ? (event) => {
                event.preventDefault();
                toggle();
              }
            : undefined
        }
      >
        {trigger}
        {!trigger && current && (
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
                className="graph-look-option__icon graph-look-option__icon--scene"
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
        {!trigger && <Chevron className="arrow" />}
      </button>
      <LookPickerWindow
        anchor={rootRef.current}
        isOpen={isOpen}
        ariaLabel={t('graph.picker.label')}
      >
        <LookPickerBody
          value={shown}
          styleRows={styleRows}
          plusRows={plusRows}
          query={query}
          place={place}
          from={from}
          sort={sort}
          view={view}
          openedAt={openedAt}
          ownsOfficialScenes={ownsOfficialScenes}
          onQuery={search}
          onPlace={choosePlace}
          onFrom={chooseFrom}
          onSort={chooseSort}
          onView={chooseView}
          onChoose={choose}
          searchRef={searchRef}
          bodyRef={setBody}
          onLeave={() => close(false)}
        />
      </LookPickerWindow>
    </div>
  );
};

// Memoised: the chart around it re-renders on every reading it plots, and
// the closed trigger's value, disabled state and handler rarely change.
export default memo(LookPicker);
