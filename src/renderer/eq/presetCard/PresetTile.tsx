/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDspCatalogEntry } from '../../dsp/dspPresetCatalog';
import { genreNotesFor } from '../../dsp/genreNotesModel';
import { openGenreNotes } from '../../dsp/genreNotesStore';
import MenuIcon from '../../icons/MenuIcon';
import VoicingIcon from '../../icons/VoicingIcon';
import { useTranslation } from '../../utils/I18nContext';
import PresetCardCurve from './PresetCardCurve';
import PresetMenu, { type IPresetMenuItem, usePresetMenu } from './PresetMenu';
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
  /** A preset of the listener's own made from this one, opened to edit. */
  onEditCopy: () => void;
}

/**
 * One factory preset on the Preset tab: pressed, it plays; its glyph, name
 * and what it runs, its curve along its foot, its star and its ⋯.
 *
 * The star and the ⋯ beside the tile, never inside it: a button cannot hold
 * a button, and neither must put the preset on. The same star, list and
 * labels as the preset picks' menus, so a star given here files the preset
 * first there too (Ivan, 2026-11-20: "on presets how do I add one to fav or
 * remove"). The ⋯ — and a right-click, and the keyboard's menu key — opens
 * what can be done with it: Edit a copy, its star, and a genre's full notes.
 * The preset itself is never edited (Ivan, 2026-11-26: "not the original but
 * the copy").
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
  onEditCopy,
}: IPresetTileProps) => {
  const { t } = useTranslation();
  const menu = usePresetMenu();
  const items: IPresetMenuItem[] = [
    {
      key: 'copy',
      icon: 'duplicate',
      label: t('eq.own.editCopy'),
      run: onEditCopy,
      isDisabled,
    },
    { key: 'star', icon: 'star', label: starLabel, run: onToggleStar },
    ...(genreNotesFor(preset.id)
      ? [
          {
            key: 'notes',
            icon: 'notes',
            label: t('genre.notes.full'),
            run: () => openGenreNotes(preset.id),
            startsGroup: true,
          } satisfies IPresetMenuItem,
        ]
      : []),
  ];
  return (
    <div
      className="eq-preset-tab__cell"
      data-preset-id={preset.id}
      onContextMenu={menu.onContextMenu}
    >
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
        onPointerEnter={onPoint}
        onClick={onToggleStar}
      >
        <MenuIcon name="star" />
      </button>
      <PresetMenu
        subject={preset.name}
        label={t('eq.own.more', { name: preset.name })}
        items={items}
        isOpen={menu.isOpen}
        onOpenChange={menu.setOpen}
        buttonClassName="own-preset-tile__more eq-preset-tab__more"
        onPoint={onPoint}
      />
    </div>
  );
};

export default PresetTile;
