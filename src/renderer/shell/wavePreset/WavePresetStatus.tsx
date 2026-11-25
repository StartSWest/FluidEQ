/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import runsOnMac from '../../utils/platform';
import type { TPresetBrowse } from './usePresetBrowse';
import { fillSlot } from './WavePresetText';

/**
 * The strip at the foot of the panel's reserved box: the star just given or
 * taken, with its Undo; else, while searching or once the arrows are used,
 * which key does what. Nothing at all before then — the box keeps its height
 * either way, so the strip coming and going moves nothing.
 */
const WavePresetStatus = ({ browse }: { browse: TPresetBrowse }) => {
  const { t } = useTranslation();
  const { note } = browse.edits;
  const preset = note
    ? browse.catalog.find((one) => one.id === note.id)
    : undefined;

  if (note && preset) {
    const added = note.kind === 'add';
    return (
      <div className="wave-preset-menu__status" role="status">
        <span className="wave-preset-menu__note-line">
          <MenuIcon
            name="star"
            className={`wave-preset-menu__note-star${added ? ' is-on' : ''}`}
          />
          <span className="wave-preset-menu__note-words">
            {fillSlot(
              t(added ? 'wavePreset.starred' : 'wavePreset.unstarred'),
              'name',
              <b>{preset.name}</b>,
            )}
          </span>
        </span>
        <button
          type="button"
          className="wave-preset-menu__undo"
          onClick={browse.edits.undo}
        >
          {t('wavePreset.undo')}
        </button>
      </div>
    );
  }

  if (browse.query === '' && !browse.usedKeys) {
    return null;
  }
  const keys: Array<[string[], string]> = [
    [['↑', '↓'], t('wavePreset.keys.move')],
    [[t('wavePreset.key.enter')], t('wavePreset.keys.play')],
    [
      [t(runsOnMac() ? 'wavePreset.key.starMac' : 'wavePreset.key.star')],
      t('wavePreset.keys.star'),
    ],
    [
      [t('wavePreset.key.esc')],
      t(
        browse.query === '' ? 'wavePreset.keys.close' : 'wavePreset.keys.clear',
      ),
    ],
  ];
  return (
    <div className="wave-preset-menu__status" aria-hidden>
      {keys.map(([caps, word]) => (
        <span key={word} className="wave-preset-menu__keys">
          {caps.map((cap) => (
            <kbd key={cap} className="wave-preset-menu__key">
              {cap}
            </kbd>
          ))}
          {word}
        </span>
      ))}
    </div>
  );
};

export default WavePresetStatus;
