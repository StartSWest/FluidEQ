/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useAccount } from '../account/accountStore';
import { useKnownWithoutClip, useSceneClip } from '../plus/cardClip';
import type { ILookThumbnailRef } from './lookThumbnails';
import { createTileWatcher } from './lookTileWatcher';

/**
 * The look picker's scene tiles play their published clips while they are
 * in the picker's scroller, in the grid and in the Details list alike (Ivan,
 * 2026-11-24: "about the plus viz showing the videos on elements that are in
 * the view I want that too"), as the standard looks beside them draw live.
 * Only ever the clip - the same ten silent seconds a gallery card plays -
 * never the scene: a tile starts no scene worker and no GL context, and a
 * scene with no clip keeps the picture it was published with ("we only show
 * videos as thumbnail, not the actual viz").
 *
 * LIGHT ("make sure they are very light, we don't want to block the user's
 * PC"; "make sure it doesn't animate when outside of the view"):
 * - a tile asks for its clip only while it is in the scroller, on the
 *   watcher the standard looks go by (`lookTileWatcher.ts`), and one
 *   scrolled out drops its video, which lets go of its decoder, and its
 *   bytes (`useSceneClip`, `SceneClip`);
 * - at most twelve play at once where the graphics chip decodes them and
 *   four where it does not (`CLIPS_DECODED_IN_HARDWARE`), the first in
 *   reading order;
 * - nothing plays while the window is hidden: every clip is let go, not only
 *   paused, so a minimized FluidEQ holds no decoder at all;
 * - the picker closed unmounts every tile, and Animations off (the app's own
 *   switch, or the system's) takes every clip away at once and leaves the
 *   pictures.
 * The tile under the pointer or the keyboard always plays, slot or not, so a
 * member reaching for a scene past the bound still sees it move.
 */

/**
 * Clips playing at once, at most. Each clip is a 1280x720 VP9 stream at 30
 * frames a second whatever the tile's size (`scenePreviewMedia.ts`), so its
 * cost is the decoder's, not the plate's. Measured 2026-11-24 in the tiles
 * harness, headless Chrome with no graphics chip (every frame decoded in
 * software), a 1400x900 picker with 30 scene tiles in view, all processes
 * of the browser over ten seconds:
 *
 *   clips playing    0     1     4     6     12     30
 *   share of a core  21%   34%   74%   93%   117%   378%
 *   memory, MB       398   407   476   510   635    992
 *
 * About 10-12% of a core and 20 MB for each clip; the page's own script and
 * tasks stay under 15 ms a second at any count, because the decoding is the
 * media threads'. Every clip in view, as the standard looks are, would be
 * four cores on such a machine. So the bound follows the decoder:
 * - where the graphics chip decodes VP9 (`powerEfficient`, as on every chip
 *   since about 2016 and on Ivan's), the processor does little of that
 *   work, and twelve play - every whole tile of the picker at 1100x700;
 * - where it does not, four: under one core in all, on the machines least
 *   able to spare one.
 * Until the answer is in (a few ms after the first picker opens), the lower.
 */
export const CLIPS_DECODED_IN_HARDWARE = 12;
export const CLIPS_DECODED_IN_SOFTWARE = 4;

/** The format of the clips the Studio publishes, as the decoder is asked. */
const PUBLISHED_CLIP: MediaDecodingConfiguration = {
  type: 'file',
  video: {
    contentType: 'video/webm; codecs="vp09.00.10.08"',
    width: 1280,
    height: 720,
    bitrate: 1_100_000,
    framerate: 30,
  },
};

/** Whether the clips decode in hardware: asked once, for the session. */
let decodedInHardware: boolean | undefined;
let askingDecoder: Promise<boolean> | undefined;

const askDecoder = (): Promise<boolean> => {
  if (!askingDecoder) {
    const capabilities =
      typeof navigator === 'undefined'
        ? undefined
        : navigator.mediaCapabilities;
    askingDecoder = (
      capabilities
        ? capabilities
            .decodingInfo(PUBLISHED_CLIP)
            .then((answer) => answer.supported && answer.powerEfficient)
        : Promise.resolve(false)
    )
      // Not known is not cheap.
      .catch(() => false)
      .then((cheap) => {
        decodedInHardware = cheap;
        return cheap;
      });
  }
  return askingDecoder;
};

const clipBound = () =>
  decodedInHardware ? CLIPS_DECODED_IN_HARDWARE : CLIPS_DECODED_IN_SOFTWARE;

/** For tests: ask the decoder again. */
export const forgetClipDecoder = () => {
  decodedInHardware = undefined;
  askingDecoder = undefined;
};

interface IClipSlots {
  /** Follows whether the tile is in the scroller until the call returned. */
  track: (tile: symbol, element: Element) => () => void;
  /** The pointer or the keyboard is on the tile, or no longer. */
  point: (tile: symbol, pointed: boolean) => void;
  holds: (tile: symbol) => boolean;
  subscribe: (listener: () => void) => () => void;
  dispose: () => void;
}

const same = (a: ReadonlySet<symbol>, b: ReadonlySet<symbol>) =>
  a.size === b.size && [...a].every((tile) => b.has(tile));

const createClipSlots = (): IClipSlots => {
  const watcher = createTileWatcher();
  const inView = new Map<symbol, Element>();
  const pointed = new Set<symbol>();
  const listeners = new Set<() => void>();
  let holders: ReadonlySet<symbol> = new Set();

  /**
   * Slots go to the tiles in view in the order they read, top row first,
   * rather than the order they came into view: a picker scrolled back up
   * would otherwise leave its top row still while tiles under it play.
   */
  const settle = () => {
    const next = new Set<symbol>();
    if (!document.hidden) {
      [...inView]
        .sort(([, a], [, b]) =>
          // eslint-disable-next-line no-bitwise -- a DOM position bit mask
          a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
            ? -1
            : 1,
        )
        .slice(0, clipBound())
        .forEach(([tile]) => next.add(tile));
      pointed.forEach((tile) => next.add(tile));
    }
    if (!same(next, holders)) {
      holders = next;
      listeners.forEach((listener) => listener());
    }
  };

  document.addEventListener('visibilitychange', settle);
  let disposed = false;
  if (decodedInHardware === undefined) {
    askDecoder()
      .then(() => {
        if (!disposed) {
          settle();
        }
        return undefined;
      })
      .catch(() => undefined);
  }

  return {
    track: (tile, element) => {
      const stop = watcher.watch(element, (visible) => {
        if (visible) {
          inView.set(tile, element);
        } else {
          inView.delete(tile);
        }
        settle();
      });
      return () => {
        stop();
        inView.delete(tile);
        settle();
      };
    },
    point: (tile, on) => {
      if (on) {
        pointed.add(tile);
      } else {
        pointed.delete(tile);
      }
      settle();
    },
    holds: (tile) => holders.has(tile),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      disposed = true;
      document.removeEventListener('visibilitychange', settle);
      watcher.dispose();
      inView.clear();
      pointed.clear();
      holders = new Set();
    },
  };
};

const ClipSlotsContext = createContext<IClipSlots | undefined>(undefined);

/**
 * The clip slots one list of scene tiles shares: the picker's grid of
 * scenes, or the scene rows of its Details list. It adds no element.
 */
export const SceneClipScope = ({ children }: { children: ReactNode }) => {
  const [slots] = useState(createClipSlots);
  useEffect(() => () => slots.dispose(), [slots]);
  return (
    <ClipSlotsContext.Provider value={slots}>
      {children}
    </ClipSlotsContext.Provider>
  );
};

const NO_LISTENING = () => () => undefined;

/**
 * The clip a scene tile plays, as an object URL, while it holds a slot - in
 * view and within the bound, or pointed at - and the scene
 * has a published clip; undefined otherwise, and the tile shows its picture.
 * A tile outside any scope (drawn alone) plays only while pointed at.
 */
const useTileClip = (
  thumbnail: ILookThumbnailRef | undefined,
  element: Element | null,
  pointed: boolean,
): string | undefined => {
  const slots = useContext(ClipSlotsContext);
  const [tile] = useState(() => Symbol('scene tile'));
  // A picture handed in as it is (Help's made-up scenes) is never asked about.
  const published =
    thumbnail?.still === undefined ? thumbnail?.published : undefined;
  const me = useAccount().identity?.id;
  const scene = published && {
    authorId: published.authorId,
    sceneId: published.sceneId,
    version: published.version,
    updatedAt: published.revision,
  };
  // A scene found to have no clip takes no slot from one that has.
  const withoutClip = useKnownWithoutClip(scene, me);
  const playable = scene !== undefined && !withoutClip;

  useEffect(
    () =>
      slots && element && playable ? slots.track(tile, element) : undefined,
    [slots, element, playable, tile],
  );
  useEffect(() => {
    if (!slots) {
      return undefined;
    }
    slots.point(tile, pointed && playable);
    return () => slots.point(tile, false);
  }, [slots, pointed, playable, tile]);

  const holding = useSyncExternalStore(
    slots ? slots.subscribe : NO_LISTENING,
    () => (slots ? slots.holds(tile) : pointed),
  );
  return useSceneClip(scene, me, holding && playable);
};

export default useTileClip;
