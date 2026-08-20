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
  MouseEvent as ReactMouseEvent,
  PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  WheelEvent,
} from 'react';
import {
  albumKey,
  artistKey,
  groupIntoAlbums,
  groupIntoArtists,
  groupIntoFolders,
  normalizeForSearch,
  sortAlbums,
  sortArtists,
  sortFolders,
  trackFolderPath,
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
import LibraryDetail from './LibraryDetail';
import '../styles/LibraryCoverFlow.scss';

/** Covers kept mounted either side of the centre. Past this, nothing renders
 * — a 5,000-album library only ever pays for the same 13 DOM nodes a 20-album
 * one does. */
export const COVER_FLOW_NEIGHBOURS = 6;
/** Degrees a side cover is turned towards the middle. */
const COVER_FLOW_ANGLE = 60;
/**
 * Horizontal step, in cover widths, between neighbours.
 *
 * Widened from 0.42 once only the centre cover keeps its label: at the old
 * spacing thirteen titles were drawn on top of one another in a band under
 * the row, and tightening the covers was the only thing holding that band
 * together. With the sides silent the row can breathe, and the fan reaches
 * the edges of a stage it used to leave three-quarters empty.
 */
const COVER_FLOW_STEP = 0.55;
/**
 * How far back each step pushes a cover, as a fraction of the cover's own
 * width — not a pixel count.
 *
 * Pixels were wrong the moment the cover started sizing itself off the stage:
 * a fixed 60px behind a 160px cover is a deep row, and behind a 420px one it
 * is a flat wall. Expressed against the cover, the perspective holds at every
 * window size.
 *
 * The value has a floor that geometry, not taste, decides. A cover of width
 * `W` turned `COVER_FLOW_ANGLE` about its own centre puts its near edge at
 * `+(W/2)·sin(60°) = 0.433W` in front of wherever that centre sits. So a
 * first neighbour parked at `-0.42W` has its leading edge at `+0.013W` —
 * in front of the centre cover's own plane, which is why the sides were seen
 * slicing through the middle of the centre sleeve as two vertical seams.
 * Anything above `0.433` clears it; `0.62` clears it with room, and reads as
 * a deeper row into the bargain.
 */
const COVER_FLOW_DEPTH_RATIO = 0.62;

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
 * The depth is a `calc()` against `--cover-flow-size`, the custom property
 * `LibraryCoverFlow.scss` sizes the covers from. It has to be: the cover is
 * sized in container units now, so its width is not known until layout, and
 * a depth in fixed pixels would read as a deep row on a small window and a
 * flat wall on a large one.
 *
 * `rotateY(direction * COVER_FLOW_ANGLE)`, not the negation, is what curls
 * the row inward rather than peeling it outward. CSS's Y-rotation matrix
 * sends a point at local `(x, 0, 0)` to `(x·cosθ, 0, −x·sinθ)`, and positive
 * z is toward the viewer (the same convention the depth uses: `translateZ`
 * goes *negative* to push a cover *away*). A cover to the right
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
  const depth = (distance * COVER_FLOW_DEPTH_RATIO).toFixed(2);
  return [
    `translateX(${offset * COVER_FLOW_STEP * 100}%)`,
    `translateZ(calc(var(--cover-flow-size) * -${depth}))`,
    `rotateY(${direction * COVER_FLOW_ANGLE}deg)`,
  ].join(' ');
};

interface ILibraryCoverFlowProps {
  tracks: readonly ILibraryTrack[];
  browseMode: TLibraryBrowseMode;
  // No `onOpenAlbum`/`onOpenArtist`. This view does not navigate: pressing a
  // cover opens its songs underneath the row it is standing in — see
  // `activateCurrent`. The drill-in page is what the list and grid do, and
  // reaching it from here meant losing the carousel and your place in it.
  /** Song mode's own primary action — optional the same way `NowPlayingBar`'s
   * `volume` is: real usage (`LibraryWorkspace`) always supplies it, and none
   * of this view's other tests — geometry, browsing, identity tracking — need
   * a working one to exercise what they cover. */
  onPlayTrack?: (trackId: string) => void;
  /** The active order, for the same reason `LibraryGridView` takes it: song
   * covers arrive already sorted, groupings do not. */
  sort?: TLibrarySort;
  sortDirection?: TLibrarySortDirection;
  /** An album or artist the workspace already has open — from the list or
   * the grid, before the reader switched to this view. The row centres on it
   * and opens it, so changing view carries you to the same place rather than
   * dropping you at the top of an unrelated carousel. */
  openId?: string;
  /** Reports what this view now has open, so the drill-in is one piece of
   * state shared by all three views rather than three that disagree. */
  onOpenChange?: (openId: string | undefined) => void;
  /** The track the player is on, forwarded to the detail this opens. */
  playingTrackId?: string;
  /** A track to scroll to and select inside the panel this opens, forwarded
   * to the same-named prop on `LibraryDetail`. */
  revealTrack?: { trackId: string; nonce: number };
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

/** The rail's buttons, in order. `#` collects everything that does not start
 * with a Latin letter once folded — digits, and every script this app is
 * translated into. One bucket rather than none: a library of Japanese album
 * titles should still have somewhere to jump to. */
const JUMP_LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')] as const;

/** Which rail button a title belongs under. Accent-folded first, so "Ángel"
 * files under A rather than under `#`. */
const jumpLetterOf = (title: string): string => {
  const first = normalizeForSearch(title).charAt(0).toUpperCase();
  return first >= 'A' && first <= 'Z' ? first : '#';
};

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
  onPlayTrack,
  sort,
  sortDirection = 'asc',
  openId,
  onOpenChange,
  playingTrackId,
  revealTrack,
}: ILibraryCoverFlowProps) => {
  const { t } = useTranslation();

  // Same memo shape as `LibraryGridView`: keyed only on the two inputs that
  // actually change what is grouped, not on the callbacks `LibraryWorkspace`
  // hands down fresh every render or on `t` — see that component's comment
  // for the scan-tick re-render this avoids repeating.
  //
  // Declared above the state rather than beside the rest of the derivations
  // because `currentIndex` starts from it — see that hook.
  const items: ICoverFlowItem[] = useMemo(() => {
    if (browseMode === 'album') {
      const grouped = groupIntoAlbums(tracks);
      return (sort ? sortAlbums(grouped, sort, sortDirection) : grouped).map(
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
      const grouped = groupIntoArtists(tracks);
      return (sort ? sortArtists(grouped, sort, sortDirection) : grouped).map(
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
    if (browseMode === 'folder') {
      const grouped = groupIntoFolders(tracks);
      return (sort ? sortFolders(grouped, sort, sortDirection) : grouped).map(
        (folder) => ({
          id: folder.id,
          artId: folder.artId,
          title: folder.name,
          // The path under the name, exactly as `LibraryGridView` shows it:
          // two folders called "CD1" are the normal case, and the name alone
          // cannot tell them apart.
          artistName: folder.id,
          isPending: folder.isPending,
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

  /**
   * The centre starts on whatever the workspace already had open.
   *
   * Not zero. Switching to this view from an open album used to mount the row
   * at its first cover and let the hand-off effect below move it on the next
   * commit — with the covers' 320ms transition live, so the whole carousel
   * visibly flew from the first album to the one being read every single time
   * the view was chosen. Starting where it belongs makes the switch a cut,
   * which is what a view change should be; the effect below is then only for
   * an album that arrives later, mid-scan.
   */
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (openId === undefined) {
      return 0;
    }
    const index = items.findIndex((item) => item.id === openId);
    return index < 0 ? 0 : index;
  });
  // The id of whatever is currently centred, kept beside the index itself so
  // that a change to `items` can re-find that same album, artist or track —
  // see the reconciling effect below, and `setCentre`, which is the only
  // place this is written.
  const centredId = useRef<string | undefined>(items[currentIndex]?.id);
  /** The `openId` this view has already centred on — see the effect that
   * reads it for why once per id, not once per `items`. */
  const appliedOpenId = useRef<string | undefined>(undefined);
  /**
   * The album or artist the drill-in below the row is showing, if any.
   *
   * Held as an id rather than as "whatever is centred", because turning the
   * row and choosing something are two different acts. Arrow keys, the wheel
   * and a drag move the row and leave the panel exactly as it was — it does
   * not close, and it does not follow along. Only a click on a cover changes
   * what it shows, and only Back closes it.
   *
   * Never set in song mode: a track has nothing to expand into.
   */
  const [expandedId, setExpandedId] = useState<string | undefined>(openId);

  /** Every path that opens or closes the panel goes through this, so the
   * workspace hears about it and the other two views agree. Reporting from
   * here rather than from an effect on `expandedId` is what keeps the sync
   * with `openId` below from feeding back on itself. */
  const openPanel = (next: string | undefined) => {
    setExpandedId(next);
    onOpenChange?.(next);
  };
  /** The covers' shared parent, measured on every press — see
   * `coverIndexAt`, which has to work out for itself what was pressed. */
  const trackRef = useRef<HTMLDivElement | null>(null);
  /** Which cover the pointer is over, or nothing. React state rather than a
   * CSS `:hover` rule for the same reason the click is computed: Chromium
   * does not deliver hover to these rotated covers either, so only the centre
   * one ever lit up. */
  const [hoveredIndex, setHoveredIndex] = useState<number | undefined>(
    undefined,
  );

  /** Moves the centre to `index`, clamped to the live `items` array, and
   * records what is now centred. Every path that changes the centre —
   * keyboard, wheel, drag, a click — goes through this rather than
   * `setCurrentIndex` directly, so `centredId` is never out of date when
   * `items` next changes. */
  const setCentre = (index: number) => {
    const clamped = clampIndex(index, items.length);
    centredId.current = items[clamped]?.id;
    setCurrentIndex(clamped);
    // Nothing here touches the panel. It follows the centre rather than
    // belonging to one album — see `isPanelOpen`.
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

  /**
   * The workspace already had something open when this view was chosen, so
   * go to it: centre that cover and show its detail underneath.
   *
   * Without this, switching to Cover Flow from an open album dropped the
   * reader at the top of an unrelated carousel and closed what they were
   * looking at — the view change threw away the only thing they had said.
   *
   * Depends on `items` as well as `openId`: a scan still running can produce
   * the album a moment after the switch, and the row should go to it when it
   * arrives rather than only if it happened to exist already.
   */
  useEffect(() => {
    if (openId === undefined) {
      appliedOpenId.current = undefined;
      return;
    }
    // Once per id, not once per render of `items`.
    //
    // `items` gets a new identity on every scan batch — several times a
    // second while one runs — so an effect that centred on `openId` every
    // time it changed dragged the row back to that album the instant the
    // reader scrolled away from it. Recording which id has already been
    // honoured is what makes this a hand-off rather than a leash.
    if (appliedOpenId.current === openId) {
      return;
    }
    const index = items.findIndex((item) => item.id === openId);
    if (index < 0) {
      // Not in the row yet. Deliberately not marked as applied: a scan still
      // running can produce this album a moment from now, and the hand-off
      // should still happen when it does.
      return;
    }
    appliedOpenId.current = openId;
    centredId.current = openId;
    setCurrentIndex(index);
    setExpandedId(openId);
  }, [openId, items]);

  /**
   * Song mode's own hand-off: centre the row on a track the workspace asked
   * for.
   *
   * `openId` cannot do this job — it opens a panel, and a track has nothing
   * to open. So a switch to Songs, or the now-playing bar's "show me what is
   * playing", arrives here instead and only moves the centre. In the other
   * three modes the id is an album's, an artist's or a folder's and never
   * matches a cover here, so the effect stands aside and `openId` above does
   * the work.
   */
  const revealNonce = revealTrack?.nonce;
  const revealTrackId = revealTrack?.trackId;
  useEffect(() => {
    if (revealTrackId === undefined) {
      return;
    }
    const index = items.findIndex((item) => item.id === revealTrackId);
    if (index < 0) {
      return;
    }
    centredId.current = revealTrackId;
    setCurrentIndex(index);
    // Keyed on the request rather than on `items`, which gets a new identity
    // on every scan batch — see the effect above for what that costs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealTrackId, revealNonce]);

  /**
   * The cover the playing track belongs to.
   *
   * Marking the song in the table below was not enough: the row is what the
   * reader is looking at in this view, and with only the list marked the
   * carousel gave no sign at all of where the music was coming from. Keyed
   * the same way the covers themselves are grouped — `albumKey` for an album
   * cover, `artistKey` for an artist one, the track's own id for a song —
   * so a cover and its songs can never disagree about which is playing.
   */
  const playingItemId = useMemo(() => {
    if (playingTrackId === undefined) {
      return undefined;
    }
    const playing = tracks.find((track) => track.id === playingTrackId);
    if (!playing) {
      return undefined;
    }
    if (browseMode === 'album') {
      return albumKey(playing);
    }
    if (browseMode === 'artist') {
      return artistKey(playing);
    }
    if (browseMode === 'folder') {
      return trackFolderPath(playing.path);
    }
    return playing.id;
  }, [tracks, playingTrackId, browseMode]);

  /**
   * Left and right move the row, whether or not it has been clicked first.
   *
   * The stage carries the same keys and always has, but only once it holds
   * focus — and nothing about a carousel says "click me before the arrow keys
   * do anything". This is the same handler at window level, refusing to act
   * whenever the key belongs to somebody else: any text field, any element a
   * reader is editing, and any modifier combination, which are shortcuts
   * rather than navigation.
   */
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }
      // The stage's own handler already has it, and running both would move
      // the row two covers for one press.
      if (target?.closest('.library-coverflow__stage')) {
        return;
      }
      event.preventDefault();
      moveByRef.current(event.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /**
   * The first cover under each letter of the rail.
   *
   * Built from `items` in their current order, so it follows whatever sort is
   * in force rather than assuming alphabetical — a rail that jumps to "the
   * first D" is honest under any order; one that assumed A-Z would send the
   * reader somewhere arbitrary the moment they sorted by year.
   *
   * A letter with nothing under it stays on the rail and is disabled: a
   * jumper whose buttons come and go is one nobody can build muscle memory
   * for, and the gap itself says something about the library.
   */
  const jumpTargets = useMemo(() => {
    const firstIndex = new Map<string, number>();
    items.forEach((item, index) => {
      const letter = jumpLetterOf(item.title);
      if (!firstIndex.has(letter)) {
        firstIndex.set(letter, index);
      }
    });
    return firstIndex;
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

  /**
   * The centre's own primary action.
   *
   * For an album or an artist this opens the songs *underneath the carousel*
   * rather than replacing it with the drill-in page. Cover Flow's whole point
   * is the row: leaving it to see a track list, and having to come back and
   * find your place again, threw away the one thing this view has that the
   * other two do not. The row stays, shrinks, and moves up; the songs slide
   * in below it. Pressing the same cover again puts it back.
   *
   * A song still just plays — there is nothing under a track to expand into.
   */
  const activateCurrent = () => {
    const item = items[currentIndex];
    if (!item) {
      return;
    }
    if (
      browseMode === 'album' ||
      browseMode === 'artist' ||
      browseMode === 'folder'
    ) {
      openPanel(expandedId === item.id ? undefined : item.id);
      return;
    }
    onPlayTrack?.(item.id);
  };

  const moveBy = (delta: number) => {
    setCentre(currentIndex + delta);
  };
  /** The window-level key handler is bound once and would otherwise close
   * over the `moveBy` from that first render, and with it a `currentIndex`
   * that never changes — every press would move to the same cover. */
  const moveByRef = useRef(moveBy);
  moveByRef.current = moveBy;

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

  /**
   * A press begins a *possible* drag. The pointer is deliberately NOT
   * captured here.
   *
   * Capturing on pointerdown retargets every following pointer event to the
   * stage — and, per the pointer-events spec, the `click` that follows is
   * dispatched at the capture target too. So every cover's own `onClick` was
   * dead: pressing any cover, centre or side, did nothing at all, and the
   * only way to move the row was the keyboard, the wheel or a drag. Capture
   * is taken in `onStagePointerMove` instead, at the moment a drag actually
   * becomes a drag, which is the only moment it is needed for.
   */
  const onStagePointerDown = (event: PointerEvent<HTMLDivElement>) => {
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
      // Not dragging, so this is just the pointer passing over the row. Which
      // cover it is over has to be worked out the same way a press does —
      // see `coverIndexAt` for why a CSS `:hover` rule only ever lit the
      // centre cover.
      setHoveredIndex(coverIndexAt(event.clientX));
      return;
    }
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) >= COVER_FLOW_DRAG_CLICK_TOLERANCE) {
      // Now it is a drag, and now the stage wants the pointer: the row has to
      // keep following a pointer that leaves it, and the `click` this would
      // otherwise end with is one the reader no longer means. Taken here
      // rather than on pointerdown — see `onStagePointerDown`.
      if (!drag.moved) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
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
    // Only if it was ever taken — a press that never became a drag never
    // captured, and releasing a capture that does not exist throws.
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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
    // A click is a choice, so it moves the panel with it — but only if one is
    // already open. Turning the row by any other means leaves the panel
    // showing what it was showing; see `expandedId`.
    if (expandedId !== undefined) {
      openPanel(items[clampIndex(index, items.length)]?.id);
    }
  };

  /**
   * Which cover the pointer is over, worked out from where the covers have
   * actually landed on screen rather than from what the event says it hit.
   *
   * Chromium will not route real input to these covers. They are rotated in
   * 3D inside a `preserve-3d` subtree, and while `elementFromPoint` happily
   * reports the side cover under a given point, the compositor's own hit test
   * — the one that decides what a mouse press targets — does not: every press
   * on a side cover arrived with the track as its target, so the per-cover
   * `onClick` never fired and only the unrotated centre cover could be
   * pressed at all. Confirmed against the running window, not inferred: a
   * real `Input.dispatchMouseEvent` on a side cover's artwork reported
   * `closest('.library-coverflow__cover') === null`, at coordinates where
   * `elementsFromPoint` listed that very cover.
   *
   * So the stage takes the press and answers the question itself. Each
   * cover's projected centre is read from its own client rect — which IS
   * accurate, and matches what is drawn — and the nearest one horizontally
   * wins. That also makes the whole vertical strip above and below a cover
   * live, which is the behaviour wanted anyway: pressing near a cover in a
   * fanned row should take you to it.
   */
  const start = Math.max(0, currentIndex - COVER_FLOW_NEIGHBOURS);
  const end = Math.min(items.length - 1, currentIndex + COVER_FLOW_NEIGHBOURS);
  const visible: { item: ICoverFlowItem; index: number }[] = [];
  for (let index = start; index <= end; index += 1) {
    visible.push({ item: items[index], index });
  }

  const coverIndexAt = (clientX: number): number | undefined => {
    const track = trackRef.current;
    if (!track) {
      return undefined;
    }
    const covers = track.querySelectorAll<HTMLElement>(
      '.library-coverflow__cover',
    );
    let bestIndex: number | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    covers.forEach((element, offset) => {
      const rect = element.getBoundingClientRect();
      const distance = Math.abs(clientX - (rect.left + rect.width / 2));
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = start + offset;
      }
    });
    return bestIndex;
  };

  const onStageClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const index = coverIndexAt(event.clientX);
    if (index !== undefined) {
      onCoverClick(index);
    }
  };

  const centreItem = items[currentIndex];
  const optionId = (id: string) => `library-coverflow-option-${id}`;
  // Open, and still pointing at something that exists: a rescan can remove
  // the album out from under it, and a panel with nothing behind it is a
  // blank page with a Back button.
  const isExpanded =
    expandedId !== undefined && items.some((item) => item.id === expandedId);

  return (
    <div className={`library-coverflow${isExpanded ? ' is-expanded' : ''}`}>
      {/* The letter rail, above the row it steers. Thirteen covers of a
          fourteen-thousand-file library is a lot of scrolling to reach the
          Rs; this is the one control that crosses the whole collection in a
          press. */}
      <div
        className="library-coverflow__jumper"
        role="group"
        aria-label={t('library.jumpTo')}
      >
        {JUMP_LETTERS.map((letter) => {
          const target = jumpTargets.get(letter);
          const isCurrent =
            centreItem !== undefined &&
            jumpLetterOf(centreItem.title) === letter;
          return (
            <button
              key={letter}
              type="button"
              className={`library-coverflow__jump${isCurrent ? ' is-current' : ''}`}
              disabled={target === undefined}
              aria-current={isCurrent ? 'true' : undefined}
              onClick={() => {
                if (target !== undefined) {
                  setCentre(target);
                }
              }}
            >
              {letter}
            </button>
          );
        })}
      </div>
      <div
        className="library-coverflow__stage"
        role="listbox"
        tabIndex={0}
        aria-label={t('library.view.coverflow')}
        aria-activedescendant={centreItem ? optionId(centreItem.id) : undefined}
        onKeyDown={onStageKeyDown}
        onWheel={onStageWheel}
        onClick={onStageClick}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setHoveredIndex(undefined)}
      >
        {/* The two arrows, in the dead space either side of the fan. The row
            has always been steerable by wheel, drag and keyboard, none of
            which a first-time reader can see; these are the one affordance
            that says so without a tooltip. `stopPropagation` because the
            stage turns a press into "centre the nearest cover" — see
            `coverIndexAt` — and a press on an arrow means something else. */}
        <button
          type="button"
          className="library-coverflow__arrow library-coverflow__arrow--back"
          aria-label={t('library.coverflow.previous')}
          title={t('library.coverflow.previous')}
          disabled={currentIndex <= 0}
          onClick={(event) => {
            event.stopPropagation();
            moveBy(-1);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5L8 12l7 7" />
          </svg>
        </button>
        <button
          type="button"
          className="library-coverflow__arrow library-coverflow__arrow--next"
          aria-label={t('library.coverflow.next')}
          title={t('library.coverflow.next')}
          disabled={currentIndex >= items.length - 1}
          onClick={(event) => {
            event.stopPropagation();
            moveBy(1);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div className="library-coverflow__track" ref={trackRef}>
          {visible.map(({ item, index }) => {
            const isCentre = index === currentIndex;
            const title = tileTitle(item);
            const subtitle = tileSubtitle(item);
            return (
              // An `option` in the `aria-activedescendant` pattern is
              // deliberately not a tab stop and has no key handler of its
              // own — the listbox above owns every key, exactly as WAI-ARIA's
              // authoring practice describes it and as this file's own doc
              // comment says. It has no click handler either: the stage owns
              // the press and works out which cover was meant, because
              // Chromium will not deliver input to a cover rotated in 3D.
              // See `coverIndexAt`.
              <div
                key={item.id}
                id={optionId(item.id)}
                role="option"
                aria-selected={isCentre}
                className={`library-coverflow__cover${isCentre ? ' is-centre' : ''}${
                  index === hoveredIndex && !isCentre ? ' is-hovered' : ''
                }${item.id === playingItemId ? ' is-playing' : ''}${
                  item.isPending ? ' library-coverflow__cover--pending' : ''
                }`}
                style={{ transform: coverFlowTransform(index - currentIndex) }}
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
                {/* Wrapped so the pair can be hidden together on every cover
                    but the centre one — see `.library-coverflow__label`. */}
                <span className="library-coverflow__label">
                  <span className="library-coverflow__title">{title}</span>
                  <small className="library-coverflow__subtitle">
                    {subtitle}
                  </small>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {/* The drill-in itself, under the row rather than instead of it.
          `LibraryDetail` verbatim — the same header, the same Play button,
          the same track table with its badges and reveal menu that the list
          and grid open. A second, near-identical panel was written here
          first and was exactly the kind of thing that drifts: one of the two
          would grow a column the other never got. Its Back button collapses
          the panel instead of navigating, which is the only difference and
          is the whole point of this view. */}
      {isExpanded && (
        <div className="library-coverflow__panel">
          <LibraryDetail
            tracks={tracks}
            albumId={browseMode === 'album' ? expandedId : undefined}
            artistId={browseMode === 'artist' ? expandedId : undefined}
            folderPath={browseMode === 'folder' ? expandedId : undefined}
            onBack={() => openPanel(undefined)}
            onPlayTrack={(trackId) => onPlayTrack?.(trackId)}
            playingTrackId={playingTrackId}
            revealTrack={revealTrack}
          />
        </div>
      )}
    </div>
  );
};

export default LibraryCoverFlow;
