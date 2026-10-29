/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useMemo, useRef } from 'react';
import type { TPlusCategory } from 'common/plusGallery';
import LookPickerBody from '../../graph/LookPickerBody';
import {
  buildStyleRows,
  type IPlusRow,
  type TPlusMaker,
} from '../../graph/lookPickerRows';
import foldForSearch from '../../utils/foldForSearch';
import { getSelectableLooks, useGraphPalette } from '../../utils/graphStyle';
import { useTranslation } from '../../utils/I18nContext';
import alpine from '../../../../assets/tour/scene-alpine.jpg';
import aurora from '../../../../assets/tour/scene-aurora.jpg';
import bloom from '../../../../assets/tour/scene-bloom.jpg';
import chrome from '../../../../assets/tour/scene-chrome.jpg';
import neonCity from '../../../../assets/tour/scene-neon-city.jpg';
import nebulaHeart from '../../../../assets/plus/nebula-heart.jpg';
import reefLight from '../../../../assets/plus/reef-light.jpg';

/**
 * The looks chapter's picker, open, drawn by the picker's own list
 * (`LookPickerBody`; `helpChapters/visuals.ts`).
 *
 * The styles are FluidEQ's own, in the reader's colours, and none of the
 * reader's saved looks. The visualizers are made up: five of FluidEQ's own
 * scenes, one of them locked as it is to somebody who has not got it yet,
 * two members' scenes and one of the reader's own — each pictured by a still
 * the app already ships, where the picker draws a scene's picture on the
 * graphics card or fetches the one its maker published.
 */

const nothing = () => undefined;

interface IMadeUpScene {
  id: string;
  name: string;
  maker: TPlusMaker;
  categories: readonly TPlusCategory[];
  swatch: readonly string[];
  still?: string;
  author?: string;
  locked?: boolean;
}

const SCENES: readonly IMadeUpScene[] = [
  {
    id: 'help-alpine',
    name: 'Alpine',
    maker: 'fluideq',
    categories: ['nature'],
    swatch: ['#4f8fd8', '#9ad7ff', '#f2f7ff'],
    still: alpine,
  },
  {
    id: 'help-aurora',
    name: 'Aurora',
    maker: 'fluideq',
    categories: ['nature', 'space'],
    swatch: ['#2ce0a0', '#3a7bff', '#b05cff'],
    still: aurora,
  },
  {
    id: 'help-bloom',
    name: 'Bloom',
    maker: 'fluideq',
    categories: ['abstract'],
    swatch: ['#ff6ad5', '#c774e8', '#94d0ff'],
    still: bloom,
  },
  {
    id: 'help-chrome',
    name: 'Chrome',
    maker: 'fluideq',
    categories: ['abstract'],
    swatch: ['#c9d6df', '#7f8c99', '#eef3f7'],
    still: chrome,
  },
  {
    id: 'help-neon-city',
    name: 'Neon City',
    maker: 'fluideq',
    categories: ['cities', 'fire-light'],
    swatch: ['#ff3cac', '#784ba0', '#2b86c5'],
    still: neonCity,
    locked: true,
  },
  {
    id: 'help-reef-light',
    name: 'Reef Light',
    maker: 'members',
    categories: ['water'],
    swatch: ['#00c2c7', '#1f6fb2', '#ffd27a'],
    still: reefLight,
    author: 'Mara Quinn',
  },
  {
    id: 'help-nebula-heart',
    name: 'Nebula Heart',
    maker: 'members',
    categories: ['space'],
    swatch: ['#ff5f9e', '#7a3cff', '#1b1446'],
    still: nebulaHeart,
    author: 'Theo Lind',
  },
  {
    id: 'help-sunset-drive',
    name: 'Sunset Drive',
    maker: 'mine',
    categories: ['retro-games'],
    swatch: ['#ff8a3d', '#ff3cac', '#3a0ca3'],
  },
];

const plusRowOf = (scene: IMadeUpScene): IPlusRow => ({
  id: scene.id,
  name: scene.name,
  swatch: scene.swatch,
  maker: scene.maker,
  categories: scene.categories,
  locked: scene.locked ?? false,
  search: foldForSearch(scene.name),
  ...(scene.author ? { author: scene.author } : {}),
  ...(scene.still
    ? { thumbnail: { lookId: scene.id, version: '1', still: scene.still } }
    : {}),
});

const PLUS_ROWS = SCENES.map(plusRowOf);

/** The picker as it opens, on the first of the styles. */
const LookPickerDrawing = () => {
  const { t } = useTranslation();
  const palette = useGraphPalette();
  const searchRef = useRef<HTMLInputElement>(null);
  const styleRows = useMemo(
    () => buildStyleRows(getSelectableLooks([], palette, [], []), t),
    [palette, t],
  );
  return (
    <div
      className="graph-look-menu look-picker__menu"
      role="dialog"
      aria-label={t('graph.picker.label')}
    >
      <LookPickerBody
        value={styleRows[0]?.id ?? ''}
        styleRows={styleRows}
        plusRows={PLUS_ROWS}
        query=""
        styleFilter="all"
        plusFilter="all"
        onQuery={nothing}
        onStyleFilter={nothing}
        onPlusFilter={nothing}
        onChoose={nothing}
        searchRef={searchRef}
      />
    </div>
  );
};

export default LookPickerDrawing;
