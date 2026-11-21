/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDspCatalogEntry } from '../../dsp/dspPresetCatalog';
import MenuIcon from '../../icons/MenuIcon';
import VoicingIcon from '../../icons/VoicingIcon';
import PresetCardCurve from './PresetCardCurve';
import type { IPresetCurveDesign } from './presetCardDrawing';

interface IPresetTileProps {
  preset: IDspCatalogEntry;
  /** What the rack runs, or the APO note. */
  hint: string;
  isPlaying: boolean;
  isDisabled: boolean;
  /** Starred: it files first in Favourites and in the preset picks. */
  isFavourite: boolean;
  /** What the star does now, give or take away, as the picks say it. */
  starLabel: string;
  design: IPresetCurveDesign;
  onToggleStar: () => void;
  onApply: () => void;
  onPoint: () => void;
}

/**
 * One factory preset on the Preset tab: pressed, it plays; its glyph, name
 * and what it runs, its curve along its foot, and its star.
 *
 * The star beside the tile, never inside it: a button cannot hold a button,
 * and starring must not put the preset on. The same star, list and labels as
 * the preset picks' menus, so a star given here files the preset first there
 * too (Ivan, 2026-11-20: "on presets how do I add one to fav or remove").
 */
const PresetTile = ({
  preset,
  hint,
  isPlaying,
  isDisabled,
  isFavourite,
  starLabel,
  design,
  onToggleStar,
  onApply,
  onPoint,
}: IPresetTileProps) => (
  <div className="eq-preset-tab__cell">
    <button
      type="button"
      className="eq-preset-tab__tile"
      aria-pressed={isPlaying}
      disabled={isDisabled}
      onPointerEnter={onPoint}
      onFocus={onPoint}
      onClick={onApply}
    >
      <VoicingIcon profileId={preset.id} className="eq-preset-tab__glyph" />
      <span className="eq-preset-tab__words">
        <strong>{preset.name}</strong>
        <span>{hint}</span>
      </span>
      <PresetCardCurve
        curve={preset.curve}
        design={design}
        tone={isPlaying ? 'playing' : 'plain'}
      />
    </button>
    <button
      type="button"
      className={`rich-pick__star eq-preset-tab__star${
        isFavourite ? ' is-on' : ''
      }`}
      aria-pressed={isFavourite}
      aria-label={`${starLabel}: ${preset.name}`}
      title={starLabel}
      onClick={onToggleStar}
    >
      <MenuIcon name="star" />
    </button>
  </div>
);

export default PresetTile;
