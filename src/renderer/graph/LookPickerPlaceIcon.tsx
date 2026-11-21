/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TPlusCategory } from 'common/plusGallery';
import MenuIcon, { type MenuIconName } from '../icons/MenuIcon';
import type { TPickerPlace } from './lookPickerFilter';

/**
 * A glyph for each of the gallery's categories, drawn at the menu icons'
 * own weight (MenuIcon's 1.7 on a 24 grid is 1.13 on this 16 one), so a
 * category in the picker's rail stands in the same column as the Library's
 * shelves. None of them had a picture before: they were words on pills.
 */
const CATEGORY_PATHS: Record<TPlusCategory, string> = {
  nature: 'M8 14c0-5 3-9 7-11-1 6-3 9-7 11zM8 14C6 11 3 10 1 10c2 3 4 4 7 4z',
  cities: 'M2 14V7h4v7M6 14V3h5v11M11 14V8h3v6M1 14h14',
  space:
    'M8 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM1.5 10.5c2 1.6 11-1.6 13-5',
  water: 'M1 6c2-2 3-2 5 0s3 2 5 0 3-2 4-1M1 10c2-2 3-2 5 0s3 2 5 0 3-2 4-1',
  'fire-light':
    'M8 15c3 0 5-2 5-5 0-3-3-5-3-8-2 1-3 3-3 5-1-1-2-2-2-3-1 2-2 4-2 6 0 3 2 5 5 5z',
  'retro-games':
    'M3 5h10a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4.5 7v3M3 8.5h3M10.5 8h.01M12 9.5h.01',
  animals:
    'M8 14c2 0 4-1 4-3s-2-3-4-3-4 1-4 3 2 3 4 3zM3 6.5v.1M13 6.5v.1M6 3.5v.1M10 3.5v.1',
  abstract: 'M5 2.5l3.5 6h-7zM11 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 10.5h5v4H2z',
  'worlds-3d':
    'M8 1.5l6 3.3v6.4L8 14.5 2 11.2V4.8zM8 8l6-3.2M8 8L2 4.8M8 8v6.5',
};

/**
 * Every place's glyph: the categories their own, the rest the app's menu
 * glyphs. A record over every place, so a new category or family cannot
 * reach the rail without one.
 */
const GLYPHS: Record<TPickerPlace, { menu: MenuIconName } | { path: string }> =
  {
    everything: { menu: 'viewGrid' },
    fresh: { menu: 'star' },
    'all-scenes': { menu: 'scene' },
    analysis: { menu: 'graph' },
    scenes: { menu: 'eqBars' },
    lines: { menu: 'graph' },
    fills: { menu: 'graph' },
    bars: { menu: 'eqBars' },
    points: { menu: 'eqBars' },
    nature: { path: CATEGORY_PATHS.nature },
    cities: { path: CATEGORY_PATHS.cities },
    space: { path: CATEGORY_PATHS.space },
    water: { path: CATEGORY_PATHS.water },
    'fire-light': { path: CATEGORY_PATHS['fire-light'] },
    'retro-games': { path: CATEGORY_PATHS['retro-games'] },
    animals: { path: CATEGORY_PATHS.animals },
    abstract: { path: CATEGORY_PATHS.abstract },
    'worlds-3d': { path: CATEGORY_PATHS['worlds-3d'] },
  };

export default function LookPickerPlaceIcon({
  place,
  className,
}: {
  place: TPickerPlace;
  className: string;
}) {
  const glyph = GLYPHS[place];
  if ('menu' in glyph) {
    return <MenuIcon name={glyph.menu} className={className} />;
  }
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.15"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={glyph.path} />
    </svg>
  );
}
