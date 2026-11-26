/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Texture } from 'three';
import {
  COVER_FLOW_AHEAD,
  COVER_FLOW_BEHIND,
  COVER_FLOW_WINDOW,
  coverFlowSpans,
} from '../../../renderer/library/coverFlow/coverFlowGeometry';
import {
  type IArtEntry,
  artKeyOf,
  createCoverFlowArtCache,
} from '../../../renderer/library/coverFlow/coverFlowArtCache';
import {
  type ICoverFlowArtRequest,
  loadCoverFlowArt,
  releaseCoverFlowArt,
} from '../../../renderer/library/coverFlow/coverFlowArt';

jest.mock('../../../renderer/library/coverFlow/coverFlowArt', () => ({
  loadCoverFlowArt: jest.fn(),
  releaseCoverFlowArt: jest.fn(),
}));

const load = jest.mocked(loadCoverFlowArt);
const release = jest.mocked(releaseCoverFlowArt);

/**
 * The Cover Flow row keeps a picture only for the covers around where it
 * stands, a few more on the side it is heading for, and gives each back as
 * it leaves (Ivan, 2026-11-26: "we can preload some covers ahead, sure, and
 * then unload them when out of the view"; "make sure you don't go crazy
 * with RAM").
 */

const DRAWN = 2 * COVER_FLOW_WINDOW + 1;
const KEPT = DRAWN + COVER_FLOW_AHEAD + COVER_FLOW_BEHIND;

describe('Cover Flow spans', () => {
  it('keeps the short margin on both sides of a row that never moved', () => {
    const { drawn, kept } = coverFlowSpans(100, 0, 1000);
    expect(drawn).toEqual({
      first: 100 - COVER_FLOW_WINDOW,
      last: 100 + COVER_FLOW_WINDOW,
    });
    expect(kept).toEqual({
      first: 100 - COVER_FLOW_WINDOW - COVER_FLOW_BEHIND,
      last: 100 + COVER_FLOW_WINDOW + COVER_FLOW_BEHIND,
    });
  });

  it('reaches further on the side the row is heading for', () => {
    // The two margins differ, or this proves nothing about the direction.
    expect(COVER_FLOW_AHEAD).toBeGreaterThan(COVER_FLOW_BEHIND);
    const along = coverFlowSpans(100, 1, 1000).kept;
    expect(along.last).toBe(100 + COVER_FLOW_WINDOW + COVER_FLOW_AHEAD);
    expect(along.first).toBe(100 - COVER_FLOW_WINDOW - COVER_FLOW_BEHIND);
    const back = coverFlowSpans(100, -1, 1000).kept;
    expect(back.first).toBe(100 - COVER_FLOW_WINDOW - COVER_FLOW_AHEAD);
    expect(back.last).toBe(100 + COVER_FLOW_WINDOW + COVER_FLOW_BEHIND);
  });

  it('stands on the nearest cover while the row is between two', () => {
    expect(coverFlowSpans(100.4, 1, 1000).drawn.first).toBe(
      100 - COVER_FLOW_WINDOW,
    );
    expect(coverFlowSpans(100.6, 1, 1000).drawn.first).toBe(
      101 - COVER_FLOW_WINDOW,
    );
  });

  it('stops at both ends of the row and holds nothing for an empty one', () => {
    expect(coverFlowSpans(0, -1, 1000)).toEqual({
      drawn: { first: 0, last: COVER_FLOW_WINDOW },
      kept: { first: 0, last: COVER_FLOW_WINDOW + COVER_FLOW_BEHIND },
    });
    expect(coverFlowSpans(999, 1, 1000).kept.last).toBe(999);
    // A drag past the end pulls the row a little beyond its last cover.
    expect(coverFlowSpans(999.4, 1, 1000).drawn.last).toBe(999);
    const empty = coverFlowSpans(0, 0, 0);
    expect(empty.drawn.last).toBeLessThan(empty.drawn.first);
    expect(empty.kept.last).toBeLessThan(empty.kept.first);
  });

  it('never draws or keeps more than its bound, wherever the row stands', () => {
    for (let position = -0.4; position < 5000; position += 7.3) {
      [-1, 0, 1].forEach((heading) => {
        const { drawn, kept } = coverFlowSpans(position, heading, 5000);
        expect(drawn.last - drawn.first + 1).toBeLessThanOrEqual(DRAWN);
        expect(kept.last - kept.first + 1).toBeLessThanOrEqual(KEPT);
        expect(kept.first).toBeLessThanOrEqual(drawn.first);
        expect(kept.last).toBeGreaterThanOrEqual(drawn.last);
      });
    }
  });
});

/** A cover of the row as the scene asks for it. */
const slotAt = (index: number): ICoverFlowArtRequest => ({
  artId: `art${index}`,
  label: `Album ${index}`,
  isFolder: false,
  isPending: false,
});

type TPicture = Awaited<ReturnType<typeof loadCoverFlowArt>>;

/** Every decode answers at once; `made` holds each picture handed out. */
const answerEveryDecode = (made: TPicture[]) => {
  load.mockImplementation(async () => {
    const picture: TPicture = {
      source: { width: 224, height: 224 } as unknown as ImageBitmap,
      glow: [0.5, 0.5, 0.5],
    };
    made.push(picture);
    return picture;
  });
};

/** The pictures handed out and never shut. */
const unshut = (made: readonly TPicture[]): TPicture[] => {
  const shut = new Set(release.mock.calls.map(([picture]) => picture));
  return made.filter((picture) => !shut.has(picture));
};

/** Lets the decodes the last frame started land. */
const settle = async () => {
  for (let turn = 0; turn < 6; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- each turn lets one more round of promises land
    await Promise.resolve();
  }
};

/**
 * Drives the cache the way the scene's `place` does, one frame at a time:
 * every cover of the kept span asked for, nearest first, the landed ones
 * uploaded, and everything else given back.
 */
const rowOver = (count: number) => {
  const cache = createCoverFlowArtCache({
    anisotropy: 4,
    colours: { folderTop: '#000', folderBottom: '#000' },
    onReady: () => undefined,
  });
  const frame = (position: number, heading: number) => {
    const { kept } = coverFlowSpans(position, heading, count);
    const keys = new Set<string>();
    const entries: IArtEntry[] = [];
    cache.beginFrame();
    const order: number[] = [];
    for (let index = kept.first; index <= kept.last; index += 1) {
      order.push(index);
    }
    order.sort((a, b) => Math.abs(a - position) - Math.abs(b - position));
    order.forEach((index) => {
      const slot = slotAt(index);
      keys.add(artKeyOf(slot));
      const entry = cache.entryFor(slot, Math.abs(index - position));
      if (entry.ready) {
        cache.upload(entry);
      }
      entries.push(entry);
    });
    cache.endFrame(keys);
    return entries;
  };
  return { cache, frame };
};

describe('Cover Flow pictures', () => {
  let alive: Set<Texture>;
  let made: number;
  let pictures: TPicture[];
  let dispose: jest.SpyInstance;

  beforeEach(() => {
    load.mockReset();
    release.mockReset();
    pictures = [];
    answerEveryDecode(pictures);
    alive = new Set();
    made = 0;
    const realDispose = Texture.prototype.dispose;
    dispose = jest
      .spyOn(Texture.prototype, 'dispose')
      .mockImplementation(function disposeTexture(this: Texture) {
        alive.delete(this);
        realDispose.call(this);
      });
  });

  afterEach(() => {
    dispose.mockRestore();
  });

  /** Counts every texture the cache makes, through the entries it hands out. */
  const track = (entries: IArtEntry[]) => {
    entries.forEach((entry) => {
      if (entry.texture && !alive.has(entry.texture)) {
        // A texture seen for the first time is a new one, unless it was
        // already given back (a cover that left and came again is new).
        alive.add(entry.texture);
        made += 1;
      }
    });
  };

  it('asks for the covers ahead of the row before they are drawn', async () => {
    const { frame } = rowOver(1000);
    frame(100, 1);
    // Four decodes at a time: let every one of them land, frame by frame.
    for (let turn = 0; turn < 12; turn += 1) {
      // eslint-disable-next-line no-await-in-loop -- one frame at a time, as the scene draws them
      await settle();
      frame(100, 1);
    }
    const asked = new Set(load.mock.calls.map(([slot]) => slot.artId));
    const ahead = 100 + COVER_FLOW_WINDOW + COVER_FLOW_AHEAD;
    const behind = 100 - COVER_FLOW_WINDOW - COVER_FLOW_BEHIND;
    expect(asked.has(`art${ahead}`)).toBe(true);
    expect(asked.has(`art${ahead + 1}`)).toBe(false);
    expect(asked.has(`art${behind}`)).toBe(true);
    expect(asked.has(`art${behind - 1}`)).toBe(false);
  });

  it('gives back every cover the row leaves, and never holds more than the spans', async () => {
    const { frame } = rowOver(800);
    let most = 0;
    // Across the whole row and back, a quarter of a cover per frame.
    const walk: [number, number][] = [];
    for (let position = 0; position <= 799; position += 0.25) {
      walk.push([position, 1]);
    }
    for (let position = 799; position >= 0; position -= 0.25) {
      walk.push([position, -1]);
    }
    // One frame at a time, each after the last one's decodes have landed.
    await walk.reduce(async (previous, [position, heading]) => {
      await previous;
      track(frame(position, heading));
      most = Math.max(most, alive.size);
      await settle();
    }, Promise.resolve());
    // The walk did make pictures and did give them back: the bound below is
    // about a pool that turned over, not one that never filled.
    expect(made).toBeGreaterThan(800);
    expect(dispose).toHaveBeenCalled();
    expect(most).toBeLessThanOrEqual(KEPT);
    expect(alive.size).toBeLessThanOrEqual(KEPT);
    // Every picture whose cover the row has left was shut, uploaded or
    // not: only the ones still standing in the last spans may be open.
    expect(pictures.length).toBeGreaterThan(800);
    expect(unshut(pictures).length).toBeLessThanOrEqual(KEPT);
  });

  it('shuts a picture that lands after its cover has gone', async () => {
    let answer: (value: TPicture) => void = () => undefined;
    load.mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    const { frame } = rowOver(1000);
    frame(0, 0);
    // The row is carried far away before the first decode comes back.
    frame(500, 1);
    const picture = {
      source: { width: 224, height: 224 } as unknown as ImageBitmap,
      glow: [0.5, 0.5, 0.5] as [number, number, number],
    };
    answer(picture);
    await settle();
    expect(release).toHaveBeenCalledWith(picture);
  });

  it('gives back everything when the scene goes', async () => {
    const { cache, frame } = rowOver(1000);
    frame(100, 1);
    await settle();
    track(frame(100, 1));
    expect(alive.size).toBeGreaterThan(0);
    // Nothing draws here, so no upload has shut these: like covers got ready
    // ahead of the row and never drawn, only their going can.
    expect(unshut(pictures).length).toBeGreaterThan(0);
    cache.dispose();
    expect(alive.size).toBe(0);
    // A decode still out when the scene went is shut as it lands.
    await settle();
    expect(unshut(pictures)).toEqual([]);
  });
});
