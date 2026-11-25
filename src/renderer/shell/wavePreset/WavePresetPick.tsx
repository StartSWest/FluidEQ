/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import type { IDspCatalogEntry } from '../../dsp/dspPresetCatalog';
import { presetGlyph } from '../../components/useVoicingPick';
import type { TPresetBrowse } from './usePresetBrowse';
import WavePresetEntry from './WavePresetEntry';
import WavePresetRow from './WavePresetRow';
import { markedText } from './WavePresetText';

interface IWavePresetPickProps {
  browse: TPresetBrowse;
  preset: IDspCatalogEntry;
  /** Its place among the rows the keys walk. */
  index: number;
  /** The words typed, lit in its name when the name is what was found. */
  nameTerms?: readonly string[];
  /** Why it was found, when that is not its name; else what it does. */
  shownHint?: ReactNode;
  hint?: string;
  isGone?: boolean;
}

/**
 * A preset the panel offers, a favourite or a find: its row and its star,
 * wired to the panel's keys, its favourites and the press that plays it.
 */
const WavePresetPick = ({
  browse,
  preset,
  index,
  nameTerms,
  shownHint,
  hint,
  isGone,
}: IWavePresetPickProps) => {
  const { note } = browse.edits;
  const isActive = index === browse.activeIndex;
  const focus = () => browse.setActiveIndex(index);
  return (
    <WavePresetEntry
      name={preset.name}
      isActive={isActive}
      isFavourite={browse.starred.has(preset.id)}
      isPopping={note?.kind === 'add' && note.id === preset.id}
      onFocus={focus}
      onStar={() => browse.edits.toggle(preset.id)}
    >
      <WavePresetRow
        id={browse.rowId(index)}
        glyph={presetGlyph(preset, 'wave-preset-menu__glyph')}
        name={preset.name}
        shownName={markedText(preset.name, nameTerms)}
        hint={hint ?? browse.hintOf(preset)}
        shownHint={shownHint}
        checked={preset.id === browse.activeId}
        disabled={browse.isDisabled}
        isActive={isActive}
        isGone={isGone}
        onFocus={focus}
        onPress={() => browse.play(preset.id)}
      />
    </WavePresetEntry>
  );
};

export default WavePresetPick;
