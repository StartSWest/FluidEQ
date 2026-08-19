/*
<FluidEQ: System-wide parametric audio equalizer interface>
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
  PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  WheelEvent,
} from 'react';
import {
  groupIntoAlbums,
  groupIntoArtists,
  sortAlbums,
  sortArtists,
} from '../../common/library/grouping';
import {
  ILibraryTrack,
  TLibraryBrowseMode,
  TLibrarySort,
  TLibrarySortDirection,
} from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import LibraryCoverArt from './LibraryCoverArt';
import '../styles/LibraryCoverFlow.scss';

/** Covers kept mounted either side of the centre. Past this, nothing renders
 * — a 5,000-album library only ever pays for the same 13 DOM nodes a 20-album
 * one does. */
export const COVER_FLOW_NEIGHBOURS = 6;
/** Degrees a side cover is turned towards the middle. */
const COVER_FLOW_ANGLE = 60;
/** Horizontal step, in cover widths, between neighbours. */
const COVER_FLOW_STEP = 0.42;
/** How far back each step pushes a cover, in pixels. */
const COVER_FLOW_DEPTH = 60;

/** Wheel distance, in the units a mouse notch reports, that moves the centre
 * by one cover. A trackpad's much smaller per-frame deltas simply accumulate
 * across events until they cross it, rather than each one moving a step. */
const COVER_FLOW_WHEEL_STEP = 80;
/** Drag distance, in pixels, that moves the centre by one cover. Measured
 * from where the drag began — the same "distance from where the drag began,
 * not since the last event" rule `PaneResizer` uses — so a pointer that
 * pauses mid-drag does not keep advancing on its own. */
const COVER_FLOW_DRAG_STEP = 70;
/** Pointer movement, in pixels, below which a press-and-release still counts
 * as the click that opens or selects a cover rather than a drag. */
const COVER_FLOW_DRAG_CLICK_TOLERANCE = 6;

/**
 * The angle, spacing and depth a cover at `offset` steps from the centre
 * sits at. `offset` is signed and can be fractional in neither direction —
 * it is always an integer distance in the flow, negative to the left.
 *
 * The centre cover is a special case rather than `offset * 0`: at zero the
 * direction sign (`offset > 0 ? 1 : -1`) is meaningless, and forcing it
 * through the general formula would rotate a cover that is supposed to be
 * facing the viewer square-on by a sign error's worth of nothing — better to
 * say plainly that it isn't turned at all.
 *
 * `rotateY(direction * COVER_FLOW_ANGLE)`, not the negation, is what curls
 * the row inward rather than peeling it outward. CSS's Y-rotation matrix
 * sends a point at local `(x, 0, 0)` to `(x·cosθ, 0, −x·sinθ)`, and positive
 * z is toward the viewer (the same convention `COVER_FLOW_DEPTH` uses:
 * `translateZ` goes *negative* to push a cover *away*). A cover to the right
 * of centre (`direction = 1`) has its centre-facing edge on its own local
 * left, `x = −1`; at `θ = +60deg` that edge maps to `z = −(−1)·sin60° > 0` —
 * toward the viewer — while its outer right edge recedes, which is the row
 * curling inward. The left side is the mirror image at `θ = −60deg`. Get the
 * sign wrong and both edges swap: the covers present their outer edges to
 * the viewer and the row peels outward instead of curling into a carousel.
 */
export const coverFlowTransform = (offset: number): string => {
  if (offset === 0) {
    return 'translateX(0) translateZ(0) rotateY(0deg)';
  }
  const direction = offset > 0 ? 1 : -1;
  const distance = Math.abs(offset);
  return [
    `translateX(${offset * COVER_FLOW_STEP * 100}%)`,
    `translateZ(-${distance * COVER_FLOW_DEPTH}px)`,
    `rotateY(${direction * COVER_FLOW_ANGLE}deg)`,
  ].join(' ');
};

interface ILibraryCoverFlowProps {
  tracks: readonly ILibraryTrack[];
  browseMode: TLibraryBrowseMode;
  onOpenAlbum: (albumId: string) => void;
  onOpenArtist: (artistId: string) => void;
  /** Song mode's own primary action — optional the same way `NowPlayingBar`'s
   * `volume` is: real usage (`LibraryWorkspace`) always supplies it, and none
   * of this view's other tests — geometry, browsing, identity tracking — need
   * a working one to exercise what they cover. */
  onPlayTrack?: (trackId: string) => void;
  /** The active order, for the same reason `LibraryGridView` takes it: song
   * covers arrive already sorted, groupings do not. */
  sort?: TLibrarySort;
  sortDirection?: TLibrarySortDirection;
}

/** One cover's worth of what this view draws — the same split
 * `LibraryGridView`'s `IGridItem` makes between raw data (kept in the memo)
 * and the translated title/subtitle (resolved at render time), for the same
 * reason: neither `t` nor the open callbacks need to be memo dependencies. */
interface ICoverFlowItem {
  id: string;
  artId?: string;
  title: string;
  artistName: string;
  albumCount?: number;
  /** A song cover: the track itself. An album or artist cover: true only
   * while every track currently grouped into it is still unread — see
   * `groupIntoAlbums`'/`groupIntoArtists`' own comments. */
  isPending: boolean;
}

const clampIndex = (index: number, length: number): number => {
  if (length <= 0) {
    return 0;
  }
  return Math.min(Math.max(index, 0), length - 1);
};

/**
 * The third view: covers arranged in a turning row, the centre one facing
 * the viewer, the rest angled away to either side and pushed back with
 * depth. `coverFlowTransform` is the whole geometry; this component is the
 * window, the input handling and the accessible structure around it.
 *
 * Only `COVER_FLOW_NEIGHBOURS` covers either side of the centre are ever
 * mounted — see the constant's own comment. Moving the centre is wired four
 * ways: arrow keys, Home/End, the mouse wheel and a pointer drag, because a
 * carousel reachable only one of those ways is unusable for whoever does not
 * have the other.
 *
 * The stage carries `role="listbox"` and the focus; individual covers are
 * `role="option"` and are never themselves tabbable — the
 * `aria-activedescendant` pattern WAI-ARIA's listbox authoring practice
 * describes, so a screen reader announces a position ("3 of 40") without a
 * roving tab stop the arrow keys would have to fight for.
 */
const LibraryCoverFlow = ({
  tracks,
  browseMode,
  onOpenAlbum,
  onOpenArtist,
  onPlayTrack,
  sort = 'title',
  sortDirection = 'asc',
}: ILibraryCoverFlowProps) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  // The id of whatever is currently centred, kept beside the index itself so
  // that a change to `items` can re-find that same album, artist or track —
  // see the reconciling effect below, and `setCentre`, which is the only
  // place this is written.
  const centredId = useRef<string | undefined>(undefined);

  // Same memo shape as `LibraryGridView`: keyed only on the two inputs that
  // actually change what is grouped, not on the callbacks `LibraryWorkspace`
  // hands down fresh every render or on `t` — see that component's comment
  // for the scan-tick re-render this avoids repeating.
  const items: ICoverFlowItem[] = useMemo(() => {
    if (browseMode === 'album') {
      return sortAlbums(groupIntoAlbums(tracks), sort, sortDirection).map(
        (album) => ({
          id: album.id,
          artId: album.artId,
          title: album.title,
          artistName: album.artist,
          isPending: album.isPending,
        }),
      );
    }
    if (browseMode === 'artist') {
      return sortArtists(groupIntoArtists(tracks), sort, sortDirection).map(
        (artist) => ({
          id: artist.id,
          artId: artist.artId,
          title: artist.name,
          artistName: '',
          albumCount: artist.albumCount,
          isPending: artist.isPending,
        }),
      );
    }
    // 'song', and any browse mode this view does not know about yet — the
    // same fallback `LibraryGridView` and `LibraryListView` make.
    return tracks.map((track) => ({
      id: track.id,
      artId: track.artId,
      title: track.title,
      artistName: track.artist ?? '',
      isPending: track.isPending === true,
    }));
  }, [tracks, browseMode, sort, sortDirection]);

  /** Moves the centre to `index`, clamped to the live `items` array, and
   * records what is now centred. Every path that changes the centre —
   * keyboard, wheel, drag, a click — goes through this rather than
   * `setCurrentIndex` directly, so `centredId` is never out of date when
   * `items` next changes. */
  const setCentre = (index: number) => {
    const clamped = clampIndex(index, items.length);
    centredId.current = items[clamped]?.id;
    setCurrentIndex(clamped);
  };

  // `items` changing shape — a rescan that inserts albums ahead of the one
  // being looked at, one that finishes and removes it — must not leave the
  // centre pointing at whatever numeric position now happens to be in
  // range: that silently swaps what the centre is showing with no
  // indication anything moved. `centredId` is looked up in the new `items`
  // first, so the same album, artist or track stays centred at whatever
  // index it now sits at; only when that id is gone entirely (or this is
  // the first render) does the centre fall back to clamping the old index.
  useEffect(() => {
    const previousId = centredId.current;
    const foundIndex =
      previousId === undefined
        ? -1
        : items.findIndex((item) => item.id === previousId);
    const nextIndex = clampIndex(
      foundIndex === -1 ? currentIndex : foundIndex,
      items.length,
    );
    centredId.current = items[nextIndex]?.id;
    setCurrentIndex(nextIndex);
    // `currentIndex` is deliberately not a dependency: this effect exists to
    // reconcile the centre against a new `items` array, and every other
    // change to `currentIndex` already goes through `setCentre` above, which
    // keeps `centredId` in step itself without needing this effect to run
    // again for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const tileSubtitle = (item: ICoverFlowItem): string => {
    if (browseMode === 'artist') {
      return t('library.albumCount', { count: item.albumCount ?? 0 });
    }
    if (browseMode === 'album') {
      return item.artistName || t('library.unknownArtist');
    }
    return item.artistName;
  };

  const tileTitle = (item: ICoverFlowItem): string => {
    if (browseMode === 'album') {
      return item.title || t('library.unknownAlbum');
    }
    if (browseMode === 'artist') {
      return item.title || t('library.unknownArtist');
    }
    return item.title;
  };

  /** The centre's own primary action: opens the drill-in for an album or
   * artist, plays the track for a song — the same three-way split
   * `LibraryGridView.openItem` and `LibraryListView`'s row handlers make,
   * so this is the one browse mode Cover Flow used to leave the whole
   * screen inert for (Enter or a click on the centre cover did nothing —
   * one full cell of the view/browse matrix). */
  const activateCurrent = () => {
    const item = items[currentIndex];
    if (!item) {
      return;
    }
    if (browseMode === 'album') {
      onOpenAlbum(item.id);
      return;
    }
    if (browseMode === 'artist') {
      onOpenArtist(item.id);
      return;
    }
    onPlayTrack?.(item.id);
  };

  const moveBy = (delta: number) => {
    setCentre(currentIndex + delta);
  };

  const onStageKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key === 'ArrowRight' ||
      event.key === 'ArrowDown' ||
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowUp'
    ) {
      event.preventDefault();
      const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
      moveBy(forward ? 1 : -1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setCentre(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setCentre(items.length - 1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      activateCurrent();
    }
  };

  // Trackpad ticks are far smaller than one mouse notch, so they accumulate
  // here until their sum crosses `COVER_FLOW_WHEEL_STEP` rather than each one
  // moving the centre — otherwise a single swipe would fly past a hundred
  // covers.
  const wheelAccumulator = useRef(0);
  const onStageWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta =
      Math.abs(event.deltaY) > Math.abs(event.deltaX)
        ? event.deltaY
        : event.deltaX;
    wheelAccumulator.current += delta;
    if (Math.abs(wheelAccumulator.current) >= COVER_FLOW_WHEEL_STEP) {
      moveBy(wheelAccumulator.current > 0 ? 1 : -1);
      wheelAccumulator.current = 0;
    }
  };

  // A drag in progress: the index and pointer position it began from, so
  // every move is measured from that start rather than accumulated move to
  // move — see `PaneResizer.onDrag` for why that avoids drift. `moved` marks
  // whether the drag travelled far enough that the pointerup afterwards is a
  // drag ending, not a click.
  const dragState = useRef<
    | { pointerId: number; startX: number; startIndex: number; moved: boolean }
    | undefined
  >(undefined);
  // Set for the one click that follows a real drag's pointerup, so releasing
  // over a cover does not also open or re-target it.
  const suppressNextClick = useRef(false);

  const onStagePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startIndex: currentIndex,
      moved: false,
    };
  };

  const onStagePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) >= COVER_FLOW_DRAG_CLICK_TOLERANCE) {
      drag.moved = true;
    }
    // Dragging the row left (negative distance) reveals what is further
    // along it, the same way pulling a filmstrip left brings the next frame
    // into the centre — hence the subtraction rather than addition.
    const target =
      drag.startIndex - Math.round(distance / COVER_FLOW_DRAG_STEP);
    setCentre(target);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    suppressNextClick.current = drag.moved;
    dragState.current = undefined;
  };

  const onCoverClick = (index: number) => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }
    if (index === currentIndex) {
      activateCurrent();
      return;
    }
    setCentre(index);
  };

  const start = Math.max(0, currentIndex - COVER_FLOW_NEIGHBOURS);
  const end = Math.min(items.length - 1, currentIndex + COVER_FLOW_NEIGHBOURS);
  const visible: { item: ICoverFlowItem; index: number }[] = [];
  for (let index = start; index <= end; index += 1) {
    visible.push({ item: items[index], index });
  }

  const centreItem = items[currentIndex];
  const optionId = (id: string) => `library-coverflow-option-${id}`;

  return (
    <div className="library-coverflow">
      <div
        className="library-coverflow__stage"
        role="listbox"
        tabIndex={0}
        aria-label={t('library.view.coverflow')}
        aria-activedescendant={centreItem ? optionId(centreItem.id) : undefined}
        onKeyDown={onStageKeyDown}
        onWheel={onStageWheel}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="library-coverflow__track">
          {visible.map(({ item, index }) => {
            const isCentre = index === currentIndex;
            const title = tileTitle(item);
            const subtitle = tileSubtitle(item);
            return (
              // An `option` in the `aria-activedescendant` pattern is
              // deliberately not a tab stop and has no key handler of its
              // own — the listbox above owns every key, exactly as WAI-ARIA's
              // authoring practice describes it and as this file's own doc
              // comment says. The two rules below assume the roving-tabindex
              // pattern instead, which this is not.
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
              <div
                key={item.id}
                id={optionId(item.id)}
                role="option"
                aria-selected={isCentre}
                className={`library-coverflow__cover${isCentre ? ' is-centre' : ''}${item.isPending ? ' library-coverflow__cover--pending' : ''}`}
                style={{ transform: coverFlowTransform(index - currentIndex) }}
                onClick={() => onCoverClick(index)}
              >
                <span className="library-coverflow__art">
                  <LibraryCoverArt
                    artId={item.artId}
                    label={title}
                    size="cover"
                  />
                  {/* Same restraint as `LibraryListView`'s pending badge:
                      information, not a problem, so it draws quiet rather
                      than alarmed. */}
                  {item.isPending && (
                    <span
                      className="library-grid__badge--pending"
                      title={t('library.pending')}
                    >
                      <MenuIcon
                        name="pending"
                        className="library-list__badge-icon"
                      />
                    </span>
                  )}
                </span>
                <span className="library-coverflow__title">{title}</span>
                <small className="library-coverflow__subtitle">
                  {subtitle}
                </small>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LibraryCoverFlow;
