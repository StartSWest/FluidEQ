/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IRoomSettings } from '../../../common/dsp/chain';
import {
  polar,
  radiusOf,
  ROOM_GRAPH_CENTRE,
  ROOM_GRAPH_SIZE,
  roomScaleOf,
} from '../../../renderer/dsp/roomGraphGeometry';

/**
 * The room from above, as numbers. Nothing in the suite could see the defect
 * this covers: every speaker was clamped to a ring just inside the walls, so
 * a room 2 m across with its speakers 2.2 m out drew them against its own
 * walls and turning Distance up from there moved nothing. Tests query by
 * role; they cannot see where a thing is drawn.
 */

/** The dials' own limits (`RANGES` in `chain.ts`), which this is swept over. */
const SIZES = [2, 3, 4.2, 6, 8, 10, 12];
const DISTANCES = [0.5, 0.9, 1.4, 1.8, 2.2, 3, 4.5, 6];

const room = (sizeM: number, distanceM: number): IRoomSettings => ({
  ...DSP_DEFAULTS.room,
  enabled: true,
  sizeM,
  distanceM,
  distances: DSP_DEFAULTS.room.distances.map(() => distanceM),
});

/** Every speaker's own radius, plus the ring the picture draws. */
const drawn = (settings: IRoomSettings) => {
  const scale = roomScaleOf(settings);
  return {
    scale,
    wallHalf: scale.wallHalf,
    ring: radiusOf(scale, settings.distanceM),
    speakers: settings.distances.map((metresOut) => radiusOf(scale, metresOut)),
  };
};

describe('the room picture is drawn to one scale', () => {
  it('draws a speaker outside the room when it stands outside the room', () => {
    // The defect, named: 2.2 m from the middle of a room 2 m across is
    // 1.2 m past its wall, and the picture said the speaker was against it.
    const { wallHalf, ring } = drawn(room(2, 2.2));
    expect(ring).toBeGreaterThan(wallHalf);
    // And to scale: 2.2 m against the 1 m half-side.
    expect(ring / wallHalf).toBeCloseTo(2.2 / 1, 5);
  });

  it('keeps the walls, the ring and every speaker in proportion', () => {
    SIZES.forEach((sizeM) => {
      DISTANCES.forEach((distanceM) => {
        const { wallHalf, ring, scale } = drawn(room(sizeM, distanceM));
        expect(wallHalf).toBeCloseTo((sizeM / 2) * scale.perMetre, 5);
        // Below the ring's floor the picture stops being to scale on
        // purpose — a speaker is never drawn inside the listener — and says
        // so by never being smaller than the metres ask for.
        expect(ring).toBeGreaterThanOrEqual(distanceM * scale.perMetre - 1e-9);
      });
    });
  });

  it('holds one speaker walked out on its own to the same scale as the rest', () => {
    const near = room(4.2, 1.4);
    const one: IRoomSettings = {
      ...near,
      distances: near.distances.map((metresOut, at) =>
        at === 0 ? 5 : metresOut,
      ),
    };
    const { speakers, scale } = drawn(one);
    expect(speakers[0] / speakers[1]).toBeCloseTo(5 / 1.4, 5);
    expect(speakers[0]).toBeCloseTo(5 * scale.perMetre, 5);
  });
});

describe('the room picture fits its frame', () => {
  it('keeps every speaker, its name and the room inside the frame', () => {
    // What each drawn thing needs beyond its own radius: a cabinet and the
    // name above it, and under the bottom wall the size's dimension line.
    const NAME_ROOM = 34;
    const SIZE_LINE_ROOM = 22;
    SIZES.forEach((sizeM) => {
      DISTANCES.forEach((distanceM) => {
        const settings = room(sizeM, distanceM);
        const { wallHalf, ring, speakers } = drawn(settings);
        expect(wallHalf + SIZE_LINE_ROOM).toBeLessThanOrEqual(
          ROOM_GRAPH_CENTRE,
        );
        expect(ring).toBeLessThan(ROOM_GRAPH_CENTRE);
        speakers.forEach((radius, at) => {
          const name = polar(settings.angles[at], radius + NAME_ROOM);
          expect(name.x).toBeGreaterThanOrEqual(0);
          expect(name.x).toBeLessThanOrEqual(ROOM_GRAPH_SIZE);
          expect(name.y).toBeGreaterThanOrEqual(0);
          expect(name.y).toBeLessThanOrEqual(ROOM_GRAPH_SIZE);
        });
      });
    });
  });

  it('never draws a speaker inside the listener', () => {
    // Half a metre out in a room 12 m across: to scale that is 14 px, which
    // is inside the head. The floor is the only place the picture bends.
    const { speakers, scale } = drawn(room(12, 0.5));
    speakers.forEach((radius) => {
      expect(radius).toBeGreaterThan(24 * scale.glyph);
    });
  });
});

describe('both dials always move something', () => {
  it('walks the speakers out as Distance grows, in every room', () => {
    SIZES.forEach((sizeM) => {
      const rings = DISTANCES.map((distanceM) => drawn(room(sizeM, distanceM)));
      rings.forEach((here, at) => {
        if (at === 0) {
          return;
        }
        // Never inwards…
        expect(here.ring).toBeGreaterThanOrEqual(rings[at - 1].ring - 1e-9);
        // …and the walls never grow while the speakers leave them behind.
        expect(here.wallHalf).toBeLessThanOrEqual(
          rings[at - 1].wallHalf + 1e-9,
        );
      });
      // End to end the speakers have plainly moved: pinned to the wall is
      // what they used to be, and a picture that does not move is the bug.
      expect(rings[rings.length - 1].ring).toBeGreaterThan(rings[0].ring + 40);
    });
  });

  it('grows the walls as Size grows, at every distance', () => {
    DISTANCES.forEach((distanceM) => {
      const walls = SIZES.map((sizeM) => drawn(room(sizeM, distanceM)));
      walls.forEach((here, at) => {
        if (at === 0) {
          return;
        }
        expect(here.wallHalf).toBeGreaterThanOrEqual(
          walls[at - 1].wallHalf - 1e-9,
        );
      });
      expect(walls[walls.length - 1].wallHalf).toBeGreaterThan(
        walls[0].wallHalf + 40,
      );
    });
  });
});
