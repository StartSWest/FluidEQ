/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAccount } from '../account/accountStore';
import { useSceneClip } from '../plus/cardClip';
import type { ILookThumbnailRef } from './lookThumbnails';

/**
 * The look picker's scene tiles play their published clips (Ivan,
 * 2026-11-20: "scenes videos needs to play on the thumbnail too") - the same
 * ten silent seconds a gallery card plays under the pointer, never the scene
 * itself: a tile starts no scene worker and no GL context.
 *
 * Cheap by construction:
 * - a tile asks only while at least half of it shows in the picker's own
 *   scroller, and a tile scrolled away drops its video and its bytes;
 * - at most `MAX_TILE_CLIPS` play at once, the first tiles to come into view
 *   first, and a tile that leaves hands its slot to the next one waiting;
 * - the picker closed unmounts every tile, so nothing plays behind it, and a
 *   hidden window pauses what is playing (`SceneClip`).
 * Main keeps each clip on disk by version, so a tile seen twice downloads
 * once.
 */

/**
 * Clips playing at once. The picker opens at 880 by 600 with nine tiles in
 * view, twelve whole ones at 1100 by 700, and about thirty at its largest.
 * Each clip is a 720p VP9 stream; decoded in software (headless Chrome, no
 * GPU, 2026-11-20) one costs 9-10% of a core and twelve add 117% to an idle
 * picker's 17%, which is the worst case - a graphics chip that decodes VP9,
 * as every one since 2016 does, takes most of that off the processor.
 */
export const MAX_TILE_CLIPS = 12;

/** A tile is in view once this much of it shows in the scroller. */
const IN_VIEW = 0.5;

/** Tiles in view, by the element each is observed through. */
const inView = new Map<symbol, Element>();
/** The tiles holding a slot: the first in view in reading order. */
let holders: ReadonlySet<symbol> = new Set();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Slots go to the tiles in view in the order they read, top row first,
 * rather than the order they came into view: a picker resized or scrolled
 * back up would otherwise leave its top row still while tiles under it play.
 */
const settle = () => {
  holders = new Set(
    [...inView]
      .sort(([, a], [, b]) =>
        // eslint-disable-next-line no-bitwise -- a DOM position bit mask
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
      )
      .slice(0, MAX_TILE_CLIPS)
      .map(([tile]) => tile),
  );
  listeners.forEach((listener) => listener());
};

const comeIntoView = (tile: symbol, element: Element) => {
  if (inView.get(tile) !== element) {
    inView.set(tile, element);
    settle();
  }
};

const leaveView = (tile: symbol) => {
  if (inView.delete(tile)) {
    settle();
  }
};

const holdsSlot = (tile: symbol) => holders.has(tile);

/** For tests: no tile in view. */
export const resetTileClips = () => {
  inView.clear();
  settle();
};

/**
 * The clip a scene tile plays, as an object URL, while the tile is in view,
 * holds one of the slots and the scene has a published clip; undefined
 * otherwise, and the tile shows its picture.
 */
export const useTileClip = (
  thumbnail: ILookThumbnailRef | undefined,
  element: Element | null,
): string | undefined => {
  // A picture handed in as it is (Help's made-up scenes) is never asked about.
  const published =
    thumbnail?.still === undefined ? thumbnail?.published : undefined;
  const [tile] = useState(() => Symbol('look tile'));
  const me = useAccount().identity?.id;
  const hasClipToAsk = published !== undefined;

  useEffect(() => {
    if (
      !element ||
      !hasClipToAsk ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return undefined;
    }
    // The picker's own scroller rather than the window: a tile scrolled out
    // of the list is still inside the window.
    const observer = new IntersectionObserver(
      (entries) => {
        const latest = entries[entries.length - 1];
        if (latest.isIntersecting && latest.intersectionRatio >= IN_VIEW) {
          comeIntoView(tile, element);
        } else {
          leaveView(tile);
        }
      },
      {
        root: element.closest('[data-look-picker-scroll]'),
        threshold: IN_VIEW,
      },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      leaveView(tile);
    };
  }, [element, hasClipToAsk, tile]);

  const holding = useSyncExternalStore(subscribe, () => holdsSlot(tile));
  return useSceneClip(
    published && {
      authorId: published.authorId,
      sceneId: published.sceneId,
      version: published.version,
      updatedAt: published.revision,
    },
    me,
    holding,
  );
};
