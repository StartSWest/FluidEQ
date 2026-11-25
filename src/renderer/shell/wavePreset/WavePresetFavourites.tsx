/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import VoicingIcon from '../../icons/VoicingIcon';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import runsOnMac from '../../utils/platform';
import type { TPresetBrowse } from './usePresetBrowse';
import WavePresetPick from './WavePresetPick';
import WavePresetRow from './WavePresetRow';
import { fillSlot } from './WavePresetText';

/**
 * Up to this many rows the reserved box has room for the tip under them;
 * past it the tip would only push the last favourite out of sight.
 */
const TIP_UNTIL_ROWS = 6;

/**
 * What the panel holds before anything is typed: None to clear the preset in
 * one press, what plays when it is no favourite, then the listener's starred
 * presets ("only the favs, nothing more") in the Preset tab's order, and
 * while there are few of them a word on how to add more.
 *
 * Never in a game's panel: a game's sound is tuned in the Gaming Lab alone.
 */
const WavePresetFavourites = ({ browse }: { browse: TPresetBrowse }) => {
  const { t } = useTranslation();
  const { shownFavourites, playingElsewhere, activeId, edits } = browse;
  const leadRows = playingElsewhere ? 2 : 1;
  const showsTip =
    edits.note === undefined &&
    leadRows + shownFavourites.length <= TIP_UNTIL_ROWS;
  const key = t(runsOnMac() ? 'wavePreset.key.starMac' : 'wavePreset.key.star');

  return (
    <>
      <div className="wave-preset-menu__lead">
        <WavePresetRow
          id={browse.rowId(0)}
          glyph={
            <VoicingIcon profileId="none" className="wave-preset-menu__glyph" />
          }
          name={t('voicing.none')}
          hint={t('wavePreset.noneHint')}
          checked={activeId === 'none'}
          disabled={browse.isDisabled}
          isActive={browse.activeIndex === 0}
          onFocus={() => browse.setActiveIndex(0)}
          onPress={() => browse.play('none')}
        />
        {playingElsewhere && (
          <WavePresetPick
            browse={browse}
            preset={playingElsewhere}
            index={1}
            hint={t('wavePreset.playingNow')}
          />
        )}
      </div>
      <span className="wave-preset-menu__group">
        {t('dsp.favorites.title')}
        <span className="wave-preset-menu__count">{browse.starred.size}</span>
      </span>
      {shownFavourites.map((preset, place) => (
        <WavePresetPick
          key={preset.id}
          browse={browse}
          preset={preset}
          index={leadRows + place}
          isGone={edits.gone.has(preset.id)}
        />
      ))}
      {showsTip && (
        <p className="wave-preset-menu__tip">
          <MenuIcon name="star" className="wave-preset-menu__tip-star" />
          <span>
            {fillSlot(
              t('wavePreset.tip', { count: browse.searchableCount }),
              'key',
              <kbd className="wave-preset-menu__key">{key}</kbd>,
            )}
          </span>
        </p>
      )}
    </>
  );
};

export default WavePresetFavourites;
