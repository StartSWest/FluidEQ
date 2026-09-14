/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { TPlusCategory } from './plusGallery';

/**
 * The category each official FluidEQ scene is published under, for filing
 * installed ones in the graph's picker.
 *
 * An installed pack carries no category — not in its pack.json, not in the
 * scene catalogue, not in the listing the main process sends — and the
 * gallery's rows, which do, are only in memory once somebody has browsed the
 * gallery this session, and only signed in. The picker has to file every
 * installed scene on first open, offline included, so the official
 * collection's own filing is kept here: copied from `OFFICIAL_CATEGORIES` in
 * fluideq-premium's `tools/official-gallery.mjs`, which is what publishes it.
 * When the gallery's row for a scene is in memory it wins (`lookPickerRows`),
 * so a scene refiled on the server is not held in its old place.
 *
 * A scene missing here is filed as abstract, as the server files one with no
 * row of its own.
 */
const OFFICIAL_CATEGORIES: Readonly<Partial<Record<string, TPlusCategory>>> = {
  alpine: 'nature',
  aurora: 'nature',
  bloom: 'abstract',
  chrome: 'abstract',
  coral: 'animals',
  crystal: 'abstract',
  dunes: 'nature',
  eclipse: 'space',
  ember: 'fire-light',
  fireflies: 'animals',
  galaxy: 'space',
  glacier: 'nature',
  hyperdrive: 'space',
  jellyfish: 'animals',
  kaleidoscope: 'abstract',
  'lantern-lake': 'water',
  laser: 'fire-light',
  magnetic: 'abstract',
  nebula: 'space',
  'nebula-heart': 'space',
  'neon-city': 'cities',
  'neon-horizon': 'cities',
  ocean: 'water',
  orbital: 'space',
  prism: 'abstract',
  'prism-bloom': 'abstract',
  rain: 'water',
  'reef-light': 'animals',
  'road-trip-3d': 'worlds-3d',
  silk: 'abstract',
  singularity: 'space',
  storm: 'nature',
  supernova: 'space',
  'truss-3d': 'worlds-3d',
  tunnel: 'worlds-3d',
  vortex: 'abstract',
};

const officialSceneCategory = (packId: string): TPlusCategory =>
  (Object.prototype.hasOwnProperty.call(OFFICIAL_CATEGORIES, packId)
    ? OFFICIAL_CATEGORIES[packId]
    : undefined) ?? 'abstract';

export default officialSceneCategory;
