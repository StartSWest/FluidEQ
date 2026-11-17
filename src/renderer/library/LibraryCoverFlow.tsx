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

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { parentFolderPath } from '../../common/library/grouping';
import { JUMP_LETTERS, jumpLetterOf } from '../../common/library/jumpLetter';
import type { TLibraryBrowseMode } from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import { prefersReducedMotion } from '../utils/bandReveal';
import MenuIcon from '../icons/MenuIcon';
import { COVER_FLOW_WINDOW } from './coverFlow/coverFlowGeometry';
import type { ICoverFlowSource } from './coverFlow/coverFlowScene';
import useCoverFlowScene from './coverFlow/useCoverFlowScene';
import useCoverFlowSurprise from './coverFlow/useCoverFlowSurprise';
import type { TSurpriseStageRef } from './surpriseDraw/surpriseStage';
import {
  clampIndex,
  coverFlowItemOf,
  playlistCoverFlowItem,
  type ICoverFlowItem,
} from './coverFlowItems';
import LibraryCoverFlowStage from './LibraryCoverFlowStage';
import LibraryDetail from './LibraryDetail';
import { useSectionLabel } from './LibrarySectionHeading';
import { usePlaylists } from './PlaylistContext';
import useCoverFlowGestures from './useCoverFlowGestures';
import type { ILibraryList } from './useLibraryList';
import usePlaylistCovers from './usePlaylistCovers';
import { useLibrary } from './LibraryContext';
import '../styles/LibraryCoverFlow.scss';

/** Covers asked for and named either side of the centre — the scene's own
 * window (`COVER_FLOW_WINDOW`). Past this, nothing is read, drawn or held:
 * a 5,000-album library only ever pays for the same 21 covers a 30-album
 * one does. */
export const COVER_FLOW_NEIGHBOURS = COVER_FLOW_WINDOW;

const NO_FOLDER_ROOTS: readonly { path: string }[] = [];

interface ILibraryCoverFlowProps {
  /**
   * The covers of the row, a page at a time (`useLibraryList`) — every shelf
   * but Playlists, which are the listener's own. On the Folders shelf the
   * workspace asks for the level the open folder stands on, so the open one
   * is always among its neighbours.
   */
  list?: ILibraryList;
  browseMode: TLibraryBrowseMode;
  // No `onOpenAlbum`/`onOpenArtist`. This view does not navigate: pressing a
  // cover opens its songs underneath the row it is standing in — see
  // `activateCurrent`.
  /** Song mode's own primary action. */
  onPlayTrack?: (trackId: string) => void;
  /** A song cover, or a row in the panel under the row, pressed twice in one
   * double-press. See `LibraryListView`'s own prop of the same name. */
  onRestartTrack?: (trackId: string) => void;
  /** The library roots, so Back in a folder's panel climbs one level and
   * knows when it has reached the top. */
  folderRoots?: readonly { path: string }[];
  /** What the workspace already has open. The row centres on it and opens
   * it, so changing view carries you to the same place rather than dropping
   * you at the top of an unrelated carousel. */
  openId?: string;
  /** Reports what this view now has open, so the drill-in is one piece of
   * state shared by all three views rather than three that disagree. */
  onOpenChange?: (openId: string | undefined) => void;
  /** The song the player is on, forwarded to the panel this opens. */
  playingTrackId?: string;
  /** The cover the playing song belongs to — its album, artist, genre,
   * folder, or the song itself. */
  playingItemId?: string;
  /** A song to centre, or to select inside the panel this opens. */
  revealTrack?: { trackId: string; nonce: number };
  /** The toolbar's search, forwarded to the panel this opens, which decides
   * for itself whether the query found the container or songs inside it. */
  query?: string;
  /** Add-to-queue, forwarded to the panel this opens. */
  onQueueTracks?: (trackIds: readonly string[]) => void;
  /** Filled while this view is on screen, so Surprise me's draw spins this
   * row instead of building a second scene (`surpriseStage.ts`). */
  surpriseStageRef?: TSurpriseStageRef;
  /** A cover to centre, numbered so the same one twice still moves the row:
   * Surprise me's pick (`showSurprisePick`). */
  centreRequest?: { id: string; nonce: number };
}

/**
 * The third view: covers arranged in a turning row, the centre one facing
 * the viewer, the rest angled away to either side and pushed back with
 * depth, drawn in three.js (`coverFlowScene.ts`); this component is the
 * window, the input handling and the accessible structure around it.
 *
 * Only `COVER_FLOW_NEIGHBOURS` covers either side of the centre are ever
 * mounted, and only their pages are ever here. Moving the centre is wired
 * four ways: arrow keys, Home/End, the mouse wheel and a pointer drag,
 * because a carousel reachable only one of those ways is unusable for
 * whoever does not have the other.
 *
 * The stage carries `role="listbox"` and the focus; individual covers are
 * `role="option"` and are never themselves tabbable — the
 * `aria-activedescendant` pattern WAI-ARIA's listbox authoring practice
 * describes, so a screen reader announces a position without a roving tab
 * stop the arrow keys would have to fight for.
 */
const LibraryCoverFlow = ({
  list,
  browseMode,
  onPlayTrack,
  onRestartTrack,
  folderRoots = NO_FOLDER_ROOTS,
  openId,
  onOpenChange,
  playingTrackId,
  playingItemId,
  revealTrack,
  query,
  onQueueTracks,
  surpriseStageRef,
  centreRequest,
}: ILibraryCoverFlowProps) => {
  const { t } = useTranslation();
  const { isScanning } = useLibrary();
  const { playlists } = usePlaylists();
  const isPlaylists = browseMode === 'playlist';
  const covers = usePlaylistCovers(isPlaylists ? playlists : []);
  const sectionLabel = useSectionLabel();

  const count = isPlaylists ? playlists.length : (list?.count ?? 0);

  /** The cover at `index`, or nothing while its page is out. */
  const itemAt = (index: number): ICoverFlowItem | undefined => {
    if (isPlaylists) {
      const playlist = playlists[index];
      return playlist === undefined
        ? undefined
        : playlistCoverFlowItem(playlist, covers.get(playlist.id), t);
    }
    const item = list?.at(index);
    return item === undefined ? undefined : coverFlowItemOf(item, t);
  };

  /**
   * Where a cover is among what is held: its index, -1 where the answer is
   * final (a playlist, or no list to ask), or nothing where only the store
   * can say.
   */
  const heldPositionOf = (id: string): number | undefined => {
    if (isPlaylists) {
      return playlists.findIndex((playlist) => playlist.id === id);
    }
    const held = list?.indexOf(id) ?? -1;
    return held !== -1 || list?.query === undefined ? held : undefined;
  };
  /** Where a cover is: among what is held, or asked of the store. */
  const positionOf = (id: string): Promise<number> => {
    const held = heldPositionOf(id);
    if (held !== undefined || list?.query === undefined) {
      return Promise.resolve(held ?? -1);
    }
    return window.electron.ipcRenderer.queryLibrary({
      type: 'position',
      query: list.query,
      id,
    });
  };
  const positionOfRef = useRef(positionOf);
  positionOfRef.current = positionOf;

  /**
   * The centre, starting at the top and moved to whatever the workspace has
   * open as soon as the store says where that is — the hand-off below.
   */
  const [currentIndex, setCurrentIndex] = useState(0);
  // The id of whatever is centred, kept beside the index so a new list can
  // find the same album, artist or song again — see the effect on the list.
  const centredId = useRef<string | undefined>(undefined);
  /** The `openId` this view has already centred on — once per id. */
  const appliedOpenId = useRef<string | undefined>(undefined);
  /** A centre request still waiting for a row that holds its cover. */
  const pendingRequest = useRef<{ id: string; nonce: number } | undefined>(
    undefined,
  );
  /** The last centre request answered or given up, by its nonce. */
  const appliedRequestNonce = useRef<number | undefined>(undefined);
  /**
   * The album or artist the drill-in below the row is showing, if any.
   *
   * Held as an id rather than as "whatever is centred", because turning the
   * row and choosing something are two different acts. Arrow keys, the wheel
   * and a drag move the row and leave the panel exactly as it was. Only a
   * click on a cover changes what it shows, and only Back closes it.
   *
   * Never set in song mode: a track has nothing to expand into.
   */
  const [expandedId, setExpandedId] = useState<string | undefined>(openId);

  /**
   * Which browse modes have anything to drill into: containers do, a song is
   * not one — left ungated, switching to Songs with an album remembered from
   * another view opened a panel over nothing.
   */
  const hasDrillIn =
    browseMode === 'album' ||
    browseMode === 'artist' ||
    browseMode === 'genre' ||
    browseMode === 'folder' ||
    browseMode === 'playlist';

  /** Every path that opens or closes the panel goes through this, so the
   * workspace hears about it and the other two views agree. */
  const openPanel = (next: string | undefined) => {
    setExpandedId(next);
    onOpenChange?.(next);
  };

  /**
   * THE PANEL FOLLOWS THE WORKSPACE WHEN IT IS THE WORKSPACE THAT MOVES.
   *
   * Back and every step of the trail live on the place bar over the views
   * (`LibraryPlaceBar`), so a record closes, and a folder changes, from
   * outside this view. Every change of `openId` lands, closing included; a
   * press here reports through `openPanel` and comes back as the same id,
   * which changes nothing.
   */
  useEffect(() => {
    setExpandedId(hasDrillIn ? openId : undefined);
  }, [hasDrillIn, openId]);
  /** The stage, and inside it the element the scene's canvas fills. */
  const stageRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  /** Which cover the pointer is over, or nothing — the scene answers. */
  const [hoveredIndex, setHoveredIndex] = useState<number | undefined>(
    undefined,
  );

  /**
   * THE ROW OPENS ON ITS COVER, never turning to it (Ivan, 2026-11-15: "it
   * needs to load directly on the selected cover instead of scrolling,
   * animating into it"). The row stands on cover 0 until the store says where
   * the open record, the asked-for cover or the remembered one is, and the
   * scene then travelled the whole way there on every visit.
   *
   * Every placement the store makes jumps until the row has been moved by
   * hand; only after that does one travel (a reveal, a new song). It was
   * the first placement alone, and an arrival places more than once: the
   * row's first list is often a passing one (recorded in Ivan's window: the
   * shelf's own first album, then an empty row, then the real list), the
   * first placement was spent on it, and the real one travelled from there
   * to "Exitos II" on every visit ("done and still scrolling").
   */
  const isTouchedRef = useRef(false);
  /** The scene's jump, filled in where the scene is made, below. */
  const jumpSceneRef = useRef<(index: number) => void>(() => undefined);
  const placeAt = (index: number) => {
    if (!isTouchedRef.current) {
      jumpSceneRef.current(index);
    }
    setCurrentIndex(index);
  };
  /**
   * The same cover kept centred where a new list moved it: the row did not
   * move for the reader, so the scene must not either - a jump to its new
   * index, never a journey through the covers between.
   */
  const keepAt = (index: number) => {
    jumpSceneRef.current(index);
    setCurrentIndex(index);
  };

  /** Moves the centre to `index`, clamped to the row, and records what is
   * now centred. Every path that changes the centre goes through this. */
  const setCentre = (index: number) => {
    isTouchedRef.current = true;
    // The reader moving the row ends any request still waiting for a row
    // that holds its cover (a pick a search leaves out never arrives).
    if (pendingRequest.current !== undefined) {
      appliedRequestNonce.current = pendingRequest.current.nonce;
      pendingRequest.current = undefined;
    }
    const clamped = clampIndex(index, count);
    centredId.current = itemAt(clamped)?.id;
    setCurrentIndex(clamped);
  };

  // The covers either side of the centre, asked for as the centre moves.
  useEffect(() => {
    list?.want(
      Math.max(0, currentIndex - COVER_FLOW_NEIGHBOURS),
      currentIndex + COVER_FLOW_NEIGHBOURS + 1,
    );
  }, [list, currentIndex]);

  /**
   * THE ROW MOVING UNDER THE CENTRE KEEPS WHAT WAS CENTRED.
   *
   * A scan changes the rows under the same query — a song's tags are read and
   * its album re-sorts, albums whose titles sort first arrive — and the cover
   * at the centre's index is then a different one. Adopting it silently showed
   * another album where the reader had left theirs, so a cover that is not the
   * one recorded is looked for, and the centre goes to it; only one that is
   * gone from the row lets the centre take what now stands there. Every move
   * made on purpose records its id first (`setCentre`, the hand-offs), so a
   * difference here is the row moving, never the reader.
   *
   * With nothing recorded yet — the centre was moved onto a page still out —
   * the cover that arrives is simply what is centred.
   *
   * Before the paint, and from the rows held when they have it — they
   * usually do, a scan's insertions being near — so the other cover is never
   * drawn at the centre for a frame; only a cover past the held pages waits
   * on the store.
   */
  const centreId = itemAt(currentIndex)?.id;
  const heldPositionOfRef = useRef(heldPositionOf);
  heldPositionOfRef.current = heldPositionOf;
  useLayoutEffect(() => {
    const wanted = centredId.current;
    if (centreId === undefined || wanted === centreId) {
      return undefined;
    }
    if (wanted === undefined) {
      centredId.current = centreId;
      return undefined;
    }
    const held = heldPositionOfRef.current(wanted);
    if (held !== undefined) {
      if (held >= 0) {
        keepAt(held);
      } else {
        centredId.current = centreId;
      }
      return undefined;
    }
    let isCurrent = true;
    positionOfRef
      .current(wanted)
      .then((index) => {
        if (!isCurrent) {
          return undefined;
        }
        if (index >= 0) {
          keepAt(index);
        } else {
          centredId.current = centreId;
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [centreId]);

  /**
   * A DIFFERENT ROW — a new sort, a search, another shelf — keeps what was
   * centred, wherever it now stands. Asked of the store, because it can be
   * anywhere in the new row; one that is not in it leaves the centre where
   * it was, clamped to the row's length.
   */
  const listKey = list?.query === undefined ? '' : JSON.stringify(list.query);
  useEffect(() => {
    const id = centredId.current;
    // A centre request waiting for this row is what the row goes to.
    if (id === undefined || pendingRequest.current !== undefined) {
      return undefined;
    }
    let isCurrent = true;
    positionOfRef
      .current(id)
      .then((index) => {
        if (isCurrent && index >= 0 && pendingRequest.current === undefined) {
          placeAt(index);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [listKey]);
  // Clamped whenever the row gets shorter under a scan.
  useEffect(() => {
    setCurrentIndex((current) => clampIndex(current, count));
  }, [count]);

  /**
   * The workspace already had something open when this view was chosen, so
   * go to it: centre that cover and show its detail underneath. Once per id,
   * not once per answer: the row changes under a scan several times a
   * second, and an effect that centred on `openId` every time dragged the row
   * back to it the instant the reader turned away.
   */
  useEffect(() => {
    if (openId === undefined) {
      appliedOpenId.current = undefined;
      return undefined;
    }
    if (appliedOpenId.current === openId) {
      return undefined;
    }
    let isCurrent = true;
    positionOfRef
      .current(openId)
      .then((index) => {
        // Not in the row yet: a scan still running can produce it, and the
        // hand-off should still happen when it does — so not marked applied.
        if (!isCurrent || index < 0) {
          return undefined;
        }
        appliedOpenId.current = openId;
        centredId.current = openId;
        placeAt(index);
        setExpandedId(openId);
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [openId, listKey, count]);

  /**
   * Song mode's own hand-off: centre the row on a song the workspace asked
   * for. In the other modes the id is a container's and matches no cover, so
   * this stands aside and `openId` above does the work.
   */
  const revealNonce = revealTrack?.nonce;
  const revealTrackId = revealTrack?.trackId;
  useEffect(() => {
    if (revealTrackId === undefined || browseMode !== 'song') {
      return undefined;
    }
    let isCurrent = true;
    positionOfRef
      .current(revealTrackId)
      .then((index) => {
        if (isCurrent && index >= 0) {
          centredId.current = revealTrackId;
          placeAt(index);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
    // Keyed on the request, not on the row changing under a scan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealTrackId, revealNonce]);

  /**
   * Any cover the workspace asks for, in any mode: Surprise me's pick.
   *
   * Answered by the row that holds it, which is not always the row on screen
   * when it is asked: a pick from outside the folder the reader stood in
   * steps the shelf out of that folder in the same breath, and the narrowed
   * row has no such cover. Asked of that row alone, the request found
   * nothing, and the whole shelf then arrived centred on whatever had been
   * centred before — the pick nowhere in sight. So a request not yet found
   * stays pending across a change of row, and the row-change effect above
   * stands aside for it.
   */
  const requestedNonce = centreRequest?.nonce;
  const requestedId = centreRequest?.id;
  useEffect(() => {
    if (
      requestedId === undefined ||
      requestedNonce === undefined ||
      appliedRequestNonce.current === requestedNonce
    ) {
      return undefined;
    }
    pendingRequest.current = { id: requestedId, nonce: requestedNonce };
    let isCurrent = true;
    positionOfRef
      .current(requestedId)
      .then((index) => {
        if (isCurrent && index >= 0) {
          appliedRequestNonce.current = requestedNonce;
          pendingRequest.current = undefined;
          centredId.current = requestedId;
          placeAt(index);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
    // Keyed on the request and on the row, never on the row's length: a scan
    // must not drag the reader back to an old pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedId, requestedNonce, listKey]);

  /**
   * The first cover under each letter of the rail, in the row's current
   * order — a rail that jumps to "the first D" is honest under any sort; one
   * that assumed A-Z would send the reader somewhere arbitrary sorted by
   * year. Asked of the store for the whole row, once per row: not at every
   * change a scan makes, which would walk the list again several times a
   * second, but once more when the scan is done.
   *
   * A letter with nothing under it stays on the rail and is disabled: a
   * jumper whose buttons come and go is one nobody builds muscle memory for.
   */
  const [jumpTargets, setJumpTargets] = useState<Map<string, number>>(
    () => new Map(),
  );
  useEffect(() => {
    if (isPlaylists) {
      setJumpTargets(new Map());
      return undefined;
    }
    const asked = list?.query;
    if (asked === undefined) {
      return undefined;
    }
    let isCurrent = true;
    window.electron.ipcRenderer
      .queryLibrary({ type: 'letters', query: asked })
      .then((letters) => {
        if (isCurrent) {
          setJumpTargets(new Map(Object.entries(letters)));
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
    // `list.query` is what `listKey` spells.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey, isPlaylists, isScanning]);

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
   * `pressCount` is the system's own click count: the second press of a
   * double-press starts the song again, as a row does (`LibraryTrackRow`).
   */
  const activateCurrent = (pressCount: number) => {
    const item = itemAt(currentIndex);
    if (!item) {
      return;
    }
    if (
      browseMode === 'album' ||
      browseMode === 'artist' ||
      browseMode === 'genre' ||
      browseMode === 'folder' ||
      browseMode === 'playlist'
    ) {
      openPanel(expandedId === item.id ? undefined : item.id);
      return;
    }
    if (pressCount > 1) {
      (onRestartTrack ?? onPlayTrack)?.(item.id);
      return;
    }
    onPlayTrack?.(item.id);
  };

  // The covers the listbox names: the window either side of the centre,
  // those whose page has come back.
  const options: { item: ICoverFlowItem; index: number }[] = [];
  for (
    let index = Math.max(0, currentIndex - COVER_FLOW_NEIGHBOURS);
    index <= Math.min(count - 1, currentIndex + COVER_FLOW_NEIGHBOURS);
    index += 1
  ) {
    const item = itemAt(index);
    if (item !== undefined) {
      options.push({ item, index });
    }
  }

  // Open is open. Whether what it names still exists is the panel's own
  // question: `LibraryDetail` closes itself when its record is gone (a rescan
  // dropped the album, the root was removed). It used to be asked here as
  // "is it one of the covers", which with the row read a page at a time would
  // close the panel whenever the reader turned the row far enough from it —
  // and a folder holding only folders is never a cover at all.
  const isOpen = hasDrillIn && expandedId !== undefined;

  /** What the scene draws, read again on every render: the row's covers as
   * pictures, and the one the music is coming from. */
  const source: ICoverFlowSource = {
    count,
    itemAt: (index) => {
      const item = itemAt(index);
      return item === undefined
        ? undefined
        : {
            id: item.id,
            artId: item.artId,
            label: item.title,
            isFolder: browseMode === 'folder',
            isPending: item.isPending,
          };
    },
    playingId: playingItemId,
  };
  const { sceneRef, isDrawn, borrow } = useCoverFlowScene({
    hostRef,
    source,
    centre: currentIndex,
    hovered: hoveredIndex,
    isExpanded: isOpen,
    isReducedMotion: prefersReducedMotion(),
  });
  jumpSceneRef.current = (index: number) => sceneRef.current?.jumpTo(index);
  // Surprise me spinning this row: the songs panel folds for its length and
  // opens again when the row is given back.
  const drawCaption = useCoverFlowSurprise({
    stageRef: surpriseStageRef,
    sceneRef,
    borrow,
    browseMode,
    positionOfRef,
  });
  const isDrawing = drawCaption !== undefined;
  const isExpanded = isOpen && !isDrawing;

  // The keys, the wheel, a drag and a press (`useCoverFlowGestures.ts`).
  const {
    moveBy,
    onStageKeyDown,
    onStageWheel,
    onStagePointerDown,
    onStagePointerMove,
    endDrag,
    onStageClick,
  } = useCoverFlowGestures({
    currentIndex,
    count,
    setCentre,
    activateCurrent,
    // The scene says which cover is drawn under the pointer. With no scene
    // (still loading, or no WebGL) the one cover on show is the centre.
    coverIndexAt: (clientX, clientY) => {
      const scene = sceneRef.current;
      if (scene) {
        return scene.coverAt(clientX, clientY);
      }
      return count > 0 ? currentIndex : undefined;
    },
    onDragPosition: (position) => sceneRef.current?.setDrag(position),
    expandedId,
    openPanel,
    itemAt,
    setHoveredIndex,
  });

  const centreItem = itemAt(currentIndex);

  /** What the stage says when the row has nothing in it, once the store has
   * answered: a search that matched nothing, or a shelf with nothing here. */
  const isEmpty = isPlaylists
    ? count === 0
    : list?.isLoaded === true && count === 0;
  const searchText = (list?.query?.search ?? '').trim();
  let emptyNote: { title: string; hint: string } | undefined;
  if (isEmpty) {
    emptyNote =
      searchText === ''
        ? {
            title: t('library.coverflow.emptyTitle'),
            hint: t('library.coverflow.emptyHint'),
          }
        : {
            title: t('library.coverflow.noMatchTitle', { query: searchText }),
            hint: t('library.coverflow.noMatchHint'),
          };
  }
  const optionId = (id: string) => `library-coverflow-option-${id}`;

  /**
   * Which half of a search the centre is in, when the search was made from
   * inside a folder: its matches come first, then the rest of the library
   * (`libraryRows.ts`). The row has no rows to put a heading between, so the
   * heading is said over the row, for the cover in front of the reader.
   */
  const nearQuery = list?.query;
  const isSectioned =
    !isPlaylists &&
    nearQuery?.near !== undefined &&
    (nearQuery.search ?? '').trim() !== '' &&
    // The row on screen, which is the one before while the next is read: a
    // cover pressed under a search moves the folder the search stands in,
    // and gated on the new row this line went for that moment and took the
    // letters, the row and the songs up with it (Ivan, 2026-11-17).
    list?.hasAnswer === true;
  let centreSection: 'near' | 'nearEmpty' | 'elsewhere' | undefined;
  if (isSectioned && list !== undefined) {
    if (list.nearCount === 0) {
      centreSection = 'nearEmpty';
    } else {
      centreSection = currentIndex < list.nearCount ? 'near' : 'elsewhere';
    }
  }

  return (
    <div
      className={`library-coverflow${isExpanded ? ' is-expanded' : ''}${isDrawing ? ' is-drawing' : ''}`}
    >
      {/* Which half of a search the cover in front of the reader is in. */}
      {centreSection !== undefined && (
        <p
          className={`library-section library-coverflow__section library-section--${centreSection}`}
          aria-live="polite"
        >
          <MenuIcon
            name={centreSection === 'elsewhere' ? 'folderTree' : 'folder'}
            className="library-section__icon"
          />
          <span className="library-section__label">
            {sectionLabel(centreSection, nearQuery?.near)}
          </span>
        </p>
      )}
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
            jumpLetterOf(centreItem.railTitle) === letter;
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
      {/* The row and the songs under it share this box and nothing else, so
          the stage's full share is the room left under the letter rail: a
          basis of the whole card put the stage one rail taller than its box,
          and focusing it scrolled the rail out of sight. */}
      <div className="library-coverflow__body">
        <LibraryCoverFlowStage
          stageRef={stageRef}
          hostRef={hostRef}
          browseMode={browseMode}
          options={options}
          currentIndex={currentIndex}
          count={count}
          centreItem={centreItem}
          drawCaption={drawCaption}
          isDrawn={isDrawn}
          isOverCover={hoveredIndex !== undefined}
          empty={emptyNote}
          optionId={optionId}
          moveBy={moveBy}
          onKeyDown={onStageKeyDown}
          onWheel={onStageWheel}
          onClick={onStageClick}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerEnd={endDrag}
          onPointerLeave={() => setHoveredIndex(undefined)}
        />
        {/* The drill-in itself, under the row rather than instead of it.
          `LibraryDetail` verbatim — the same header, the same Play button,
          the same track table with its badges and reveal menu that the list
          and grid open. A second, near-identical panel was written here
          first and was exactly the kind of thing that drifts: one of the two
          would grow a column the other never got. Back is the place bar's,
          over the views; closing a record there collapses this panel and
          leaves the row where it was, which is the whole point of this
          view. */}
        {isExpanded && (
          <div className="library-coverflow__panel">
            <LibraryDetail
              albumId={browseMode === 'album' ? expandedId : undefined}
              artistId={browseMode === 'artist' ? expandedId : undefined}
              genreId={browseMode === 'genre' ? expandedId : undefined}
              folderPath={browseMode === 'folder' ? expandedId : undefined}
              playlistId={browseMode === 'playlist' ? expandedId : undefined}
              // Walking deeper is opening a different cover, which this view
              // already knows how to do.
              onOpenFolder={(path) => openPanel(path)}
              // Up one level in the tree, not out of it: Back from
              // `Artist/Album` is `Artist`, the same as it is everywhere else
              // this library is walked. At a root there is nothing above, and
              // `parentFolderPath` says so by answering nothing — which closes
              // the panel, which is what Back has always done there.
              onBack={() =>
                openPanel(
                  browseMode === 'folder' && expandedId !== undefined
                    ? parentFolderPath(expandedId, folderRoots)
                    : undefined,
                )
              }
              onPlayTrack={(trackId) => onPlayTrack?.(trackId)}
              onRestartTrack={onRestartTrack}
              onQueueTracks={onQueueTracks}
              playingTrackId={playingTrackId}
              revealTrack={revealTrack}
              query={query}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryCoverFlow;
