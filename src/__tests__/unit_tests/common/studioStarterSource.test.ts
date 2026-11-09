/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

import fs from 'fs';
import path from 'path';
import STUDIO_STARTER_SOURCE, {
  isStarterSource,
} from '../../../common/studioStarterSource';
import {
  STARTER_ANIMATION,
  STARTER_ARTWORK,
  starterManifest,
} from '../../../main/memberScenes/starterScene';

/** The starter as it was from 2026-10-24, before its picture and swallow. */
const PULSE_2026_10_24 = fs.readFileSync(
  path.join(
    __dirname,
    '../../data/read_only/studioStarter/pulse-2026-10-24.frag',
  ),
  'utf8',
);

describe('telling the starter from a scene somebody changed', () => {
  it('knows the starter New project writes now', () => {
    expect(isStarterSource(STUDIO_STARTER_SOURCE)).toBe(true);
  });

  // A project made before the starter changed still holds the old text; its
  // labels still fit it and nobody has asked an AI about it yet.
  it('knows an earlier starter, untouched, as a starter too', () => {
    expect(PULSE_2026_10_24).not.toBe(STUDIO_STARTER_SOURCE);
    expect(isStarterSource(PULSE_2026_10_24)).toBe(true);
  });

  it('knows neither once one number in it is changed', () => {
    expect(isStarterSource(STUDIO_STARTER_SOURCE.replace('0.26', '0.27'))).toBe(
      false,
    );
    expect(isStarterSource(PULSE_2026_10_24.replace('0.26', '0.27'))).toBe(
      false,
    );
  });
});

/** A `const vec4 NAME = vec4(...)` or `vec2` from the source, as numbers. */
const vectorOf = (name: string) => {
  const found = new RegExp(
    `const vec[24] ${name} = vec[24]\\(([^)]*)\\);`,
  ).exec(STUDIO_STARTER_SOURCE);
  return found?.[1].split(',').map(Number);
};

const floatOf = (name: string) => {
  const found = new RegExp(`const float ${name} = ([0-9.]+);`).exec(
    STUDIO_STARTER_SOURCE,
  );
  return found ? Number(found[1]) : undefined;
};

describe("the starter's picture and swallow in scene.frag", () => {
  const pack = JSON.parse(starterManifest('My First Scene', 'my-first-scene'));

  // The shader samples these numbers itself; a pack that moved a place
  // without it would draw the moon's corner in the orb, or half a swallow.
  it('samples the image at the size and the places pack.json gives', () => {
    expect(vectorOf('ART_SIZE')).toEqual([
      STARTER_ARTWORK.width,
      STARTER_ARTWORK.height,
    ]);
    const [orb] = pack.pictures;
    expect(vectorOf('ORB_PICTURE')).toEqual([
      orb.x,
      orb.y,
      orb.width,
      orb.height,
    ]);
    const [swallow] = pack.artworkRegions;
    expect(vectorOf('SWALLOW_SHEET')).toEqual([
      swallow.x,
      swallow.y,
      swallow.width,
      swallow.height,
    ]);
  });

  it('cuts the swallow into the frames the Animations tab shows', () => {
    expect(floatOf('SWALLOW_FRAMES')).toBe(STARTER_ANIMATION.count);
    expect(floatOf('SWALLOW_COLUMNS')).toBe(STARTER_ANIMATION.columns);
  });
});
