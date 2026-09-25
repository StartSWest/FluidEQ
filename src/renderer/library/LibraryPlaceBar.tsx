/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  folderDisplayName,
  normaliseFolderPath,
} from '../../common/library/grouping';
import MenuIcon, { type MenuIconName } from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import '../styles/LibraryPlaceBar.scss';

/** What is open beneath the folder: one album, artist, genre or playlist. */
export interface ILibraryPlaceRecord {
  kind: 'album' | 'artist' | 'genre' | 'playlist';
  name: string;
}

/**
 * Every folder from the library root down to `folderPath`, root first.
 *
 * The root is the folder somebody added, not the drive it sits on: the trail
 * says where the reader is inside their library, and `C:` is not a place in
 * it. The deepest root wins where one root sits inside another. A path under
 * no root at all — a root removed while its folder was remembered — is its
 * own one-step trail rather than nothing, so the bar still says where it is.
 */
export const placeTrail = (
  folderPath: string,
  roots: readonly { path: string }[],
): string[] => {
  const root = roots
    .map((entry) => normaliseFolderPath(entry.path))
    .filter((path) => folderPath === path || folderPath.startsWith(`${path}/`))
    .sort((left, right) => right.length - left.length)[0];
  if (root === undefined) {
    return [folderPath];
  }
  const trail = [root];
  folderPath
    .slice(root.length)
    .split('/')
    .filter(Boolean)
    .forEach((segment) => {
      trail.push(`${trail[trail.length - 1]}/${segment}`);
    });
  return trail;
};

const RECORD_ICONS: Record<ILibraryPlaceRecord['kind'], MenuIconName> = {
  album: 'album',
  artist: 'artist',
  genre: 'genre',
  playlist: 'playlist',
};

const Chevron = () => (
  <svg className="library-place__sep" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M6 3.5L10.5 8 6 12.5" />
  </svg>
);

/**
 * The folders the line had no room for, folded into one step.
 *
 * Its name is the folded path itself — a screen reader says where the menu
 * goes, and the tooltip shows it — and its menu lists the folders in the
 * order the trail had them, each a press straight there.
 */
const PlaceFold = ({
  paths,
  onOpenFolder,
}: {
  paths: readonly string[];
  onOpenFolder: (folderPath: string) => void;
}) => {
  const { t } = useTranslation();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const spelled = paths.map(folderDisplayName).join(' / ');

  // Closes on a press elsewhere and on Escape, like every other menu built on
  // `AnchoredMenu` — the portalled menu is asked about separately, or pressing
  // one of its folders would count as pressing outside it.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        !anchorRef.current?.contains(event.target as Node) &&
        !isInsideAnchoredMenu(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return (
    <li className="library-place__crumb library-place__crumb--fold">
      <Chevron />
      <button
        type="button"
        ref={anchorRef}
        className={`library-place__link library-place__fold${
          isOpen ? ' is-open' : ''
        }`}
        aria-label={spelled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={spelled}
        onClick={() => setIsOpen((open) => !open)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="3.5" cy="8" r="1.3" />
          <circle cx="8" cy="8" r="1.3" />
          <circle cx="12.5" cy="8" r="1.3" />
        </svg>
      </button>
      <AnchoredMenu
        anchor={anchorRef.current}
        isOpen={isOpen}
        align="left"
        className="library-list__menu library-place__menu"
        ariaLabel={t('library.place.aria')}
      >
        {paths.map((path) => (
          <button
            key={path}
            type="button"
            role="menuitem"
            title={path}
            onClick={() => {
              setIsOpen(false);
              onOpenFolder(path);
            }}
          >
            <MenuIcon name="folder" className="library-list__menu-icon" />
            <span>{folderDisplayName(path)}</span>
          </button>
        ))}
      </AnchoredMenu>
    </li>
  );
};

/**
 * WHERE THE READER IS STANDING, ON EVERY SHELF AND IN EVERY VIEW.
 *
 * A folder narrows every shelf — walk into `Pop` and Albums shows the albums
 * in it, Songs its songs — and that is right, but the only way back out used
 * to live on an opened album's own panel. Any screen without one had no exit
 * and nothing saying it was narrowed: Genres, Songs and Playlists always, and
 * Albums whenever the folder held only folders. After a restart the library
 * could open on a fraction of itself with no word why (Ivan, 2026-09-23).
 *
 * So the place is one bar, drawn by the workspace over whichever view is up,
 * and it is the only Back in the Library. It reads the way a path does — All
 * music, the root, each folder, then whatever is open inside — and Back takes
 * one step up that trail: the open record first, then one folder at a time.
 * Every step above the last is a press straight there, All music included.
 *
 * ONE LINE AT ANY DEPTH, AND THE PLACE ALWAYS NAMED. Where the steps do not
 * fit, the ones nearest the root fold into `…` — a file manager's answer —
 * rather than every step being squeezed to two letters: "Mu… › Wo… › La…"
 * names nothing, and at 420px it still pushed the place itself off the end
 * of the line. The step above the place and All music never fold; they are
 * the two a reader goes back to.
 */
const LibraryPlaceBar = ({
  folderPath,
  roots,
  record,
  onBack,
  onAllMusic,
  onOpenFolder,
}: {
  /** The folder the reader is standing in, as stored: forward slashes. */
  folderPath: string | undefined;
  roots: readonly { path: string }[];
  record: ILibraryPlaceRecord | undefined;
  onBack: () => void;
  onAllMusic: () => void;
  onOpenFolder: (folderPath: string) => void;
}) => {
  const { t } = useTranslation();
  const trail = folderPath === undefined ? [] : placeTrail(folderPath, roots);
  // The folders before the step above the place: the ones that may fold.
  const foldable = Math.max(0, trail.length - (record === undefined ? 2 : 1));
  const trailRef = useRef<HTMLOListElement>(null);

  /**
   * How the line was made to fit, for the trail it was worked out for — a
   * different place starts whole and fits itself again.
   *
   * Three measures, in this order and never another: fold steps from the
   * root side; then the step above the place gives way (CSS — it is the only
   * one allowed to shrink); then, only if that is still not enough, the place
   * itself (`tight`). The place is kept from shrinking by a switch rather
   * than a small shrink factor, because any shrink at all — measured at a
   * third of a pixel — is enough for its name to end in an ellipsis.
   */
  const trailKey = `${trail.join('|')}|${record?.name ?? ''}`;
  const WHOLE = { key: trailKey, folded: 0, tight: false };
  const [fit, setFit] = useState(WHOLE);
  const current = fit.key === trailKey ? fit : WHOLE;
  const folded = Math.min(current.folded, foldable);
  /** The line's width, so a narrower one is fitted again. */
  const [width, setWidth] = useState(0);

  // One measure at a time, for as long as the line overflows or cuts the name
  // of the step above the place. A layout effect, so each lands before the
  // frame is painted: the reader sees the trail that fits, never the one that
  // did not.
  useLayoutEffect(() => {
    const list = trailRef.current;
    if (!list || current.tight) {
      return;
    }
    const isOver = list.scrollWidth > list.clientWidth + 1;
    if (folded < foldable) {
      const aboveLabel = list.querySelector<HTMLElement>(
        '.is-above .library-place__label',
      );
      const isAboveCut =
        aboveLabel !== null &&
        aboveLabel.scrollWidth > aboveLabel.clientWidth + 1;
      if (isOver || isAboveCut) {
        setFit({ key: trailKey, folded: folded + 1, tight: false });
      }
      return;
    }
    if (isOver) {
      setFit({ key: trailKey, folded, tight: true });
    }
  }, [current.tight, foldable, folded, trailKey, width]);

  // Narrower, the effect above takes the next measure. Wider, every measure
  // is undone and the line fits itself again from whole, so a folded step
  // comes back the moment there is room for it.
  useEffect(() => {
    const list = trailRef.current;
    if (!list) {
      return undefined;
    }
    let last = list.clientWidth;
    const observer = new ResizeObserver(() => {
      const next = list.clientWidth;
      if (next > last) {
        setFit((state) =>
          state.folded === 0 && !state.tight
            ? state
            : { key: state.key, folded: 0, tight: false },
        );
      }
      last = next;
      setWidth(next);
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  const hidden = trail.slice(0, folded);
  const shown = trail.slice(folded);

  return (
    <nav
      className={`library-place${current.tight ? ' is-tight' : ''}`}
      aria-label={t('library.place.aria')}
    >
      <button
        type="button"
        className="library-toolbar__chip library-detail__back"
        onClick={onBack}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M10 3L5 8l5 5" />
        </svg>
        <span>{t('library.back')}</span>
      </button>
      <ol className="library-place__trail" ref={trailRef}>
        <li className="library-place__crumb library-place__crumb--all">
          <button
            type="button"
            className="library-place__link"
            // Its name, whether or not the words are on screen: a narrow bar
            // shows the glyph alone.
            aria-label={t('library.place.all')}
            title={t('library.place.allHint')}
            onClick={onAllMusic}
          >
            <MenuIcon name="song" className="library-place__icon" />
            <span className="library-place__label">
              {t('library.place.all')}
            </span>
          </button>
        </li>
        {hidden.length > 0 && (
          <PlaceFold paths={hidden} onOpenFolder={onOpenFolder} />
        )}
        {shown.map((path, at) => {
          const isLast = at === shown.length - 1;
          const isHere = record === undefined && isLast;
          // The step the place stands in, which gives way before the place
          // does and never folds.
          const isAbove =
            record === undefined ? at === shown.length - 2 : isLast;
          return (
            <li
              key={path}
              className={`library-place__crumb${isHere ? ' is-here' : ''}${
                isAbove ? ' is-above' : ''
              }`}
            >
              <Chevron />
              {isHere ? (
                <span
                  className="library-place__here"
                  aria-current="location"
                  title={path}
                >
                  <MenuIcon name="folder" className="library-place__icon" />
                  <span className="library-place__label">
                    {folderDisplayName(path)}
                  </span>
                </span>
              ) : (
                <button
                  type="button"
                  className="library-place__link"
                  title={path}
                  onClick={() => onOpenFolder(path)}
                >
                  <span className="library-place__label">
                    {folderDisplayName(path)}
                  </span>
                </button>
              )}
            </li>
          );
        })}
        {record !== undefined && (
          <li className="library-place__crumb is-here">
            <Chevron />
            <span
              className="library-place__here"
              aria-current="location"
              title={record.name}
            >
              <MenuIcon
                name={RECORD_ICONS[record.kind]}
                className="library-place__icon"
              />
              <span className="library-place__label">{record.name}</span>
            </span>
          </li>
        )}
      </ol>
    </nav>
  );
};

export default LibraryPlaceBar;
