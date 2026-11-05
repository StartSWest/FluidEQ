/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IGameProfile } from '../../common/games';
import Chevron from '../icons/Chevron';
import VoicingIcon from '../icons/VoicingIcon';
import { useTranslation } from '../utils/I18nContext';
import GameIcon from './GameIcon';
import { openGamingLab } from './gamingLabEvents';
import usePlayingGamePreset from './usePlayingGamePreset';
import { useSoundingIsTuned } from './useGamingData';

/**
 * The presets pick while a game's own sound is loaded (Ivan, 2026-11-03).
 *
 * The game is the preset then: named as the game, and "(custom)" once tuned
 * away from its profile. It is not changed from here — a preset picked into
 * a game's sound on the main screen would be a second place to tune one
 * game, which he would not have ("that will complicate things") — so a press
 * opens the Gaming Lab, where it is ("if they click there they go to gaming
 * lab"). Drawn as the pick it stands in for, its chevron turned to the side
 * to say it goes somewhere rather than opens a list. After the game's name,
 * the preset its sound is playing with its own glyph ("Competitive"), the
 * way the chip names it; it folds away below three columns, and the amp
 * never shows it, because the amp grows to whatever its head holds.
 */
const GameSoundPresetButton = ({ game }: { game: IGameProfile }) => {
  const { t } = useTranslation();
  const isTuned = useSoundingIsTuned();
  const preset = usePlayingGamePreset();
  return (
    <div className="rich-pick voicing-pick">
      <button
        type="button"
        className="rich-pick__trigger is-active voicing-pick__game"
        title={t('gaming.preset.openHint', { game: game.name })}
        onClick={openGamingLab}
      >
        <GameIcon program={game} className="rich-pick__glyph" />
        <span className="rich-pick__label">
          {isTuned ? t('gaming.preset.tuned', { game: game.name }) : game.name}
        </span>
        {preset && (
          <span className="voicing-pick__game-preset">
            <VoicingIcon
              profileId={preset.glyph}
              className="voicing-pick__game-glyph"
            />
            {preset.name}
          </span>
        )}
        <Chevron className="rich-pick__caret voicing-pick__go" />
      </button>
    </div>
  );
};

export default GameSoundPresetButton;
