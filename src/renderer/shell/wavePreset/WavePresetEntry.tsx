/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import runsOnMac from '../../utils/platform';

interface IWavePresetEntryProps {
  /** The preset's name, for what the star says it does. */
  name: string;
  /** The row the panel's keys are on: its star shows. */
  isActive: boolean;
  isFavourite: boolean;
  /** Just starred: the star arrives with a small pop. */
  isPopping: boolean;
  /** The row the star stands on is the one Ctrl+D would star. */
  onFocus: () => void;
  onStar: () => void;
  /** The row itself (`WavePresetRow`). */
  children: ReactNode;
}

/**
 * A preset's row with its star beside the check (design A, 2026-11-25): an
 * outline that shows with the pointer or the keys on the row, and a filled
 * star in the favourites' yellow that stays. A sibling of the row, not inside
 * it, so the star is a button of its own and a press on it plays nothing.
 */
const WavePresetEntry = ({
  name,
  isActive,
  isFavourite,
  isPopping,
  onFocus,
  onStar,
  children,
}: IWavePresetEntryProps) => {
  const { t } = useTranslation();
  const action = isFavourite
    ? t('wavePreset.unstar', { name })
    : t('wavePreset.star', { name });
  const key = t(runsOnMac() ? 'wavePreset.key.starMac' : 'wavePreset.key.star');
  return (
    <div className={`wave-preset-menu__entry${isActive ? ' is-active' : ''}`}>
      {children}
      <button
        type="button"
        className={`wave-preset-menu__star${isFavourite ? ' is-on' : ''}${
          isPopping ? ' is-popping' : ''
        }`}
        aria-pressed={isFavourite}
        aria-label={action}
        title={`${action} (${key})`}
        onFocus={onFocus}
        onClick={onStar}
      >
        <MenuIcon name="star" />
      </button>
    </div>
  );
};

export default WavePresetEntry;
