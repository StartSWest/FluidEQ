/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { IGameProfile } from '../../../common/games';
import type { ErrorDescription } from '../../../common/errors';
import GameIcon from '../../games/GameIcon';
import { openGamingLab } from '../../games/gamingLabEvents';
import usePlayingGamePreset from '../../games/usePlayingGamePreset';
import { putMusicSoundBack } from '../../games/useGameSound';
import VoicingIcon from '../../icons/VoicingIcon';
import { useFluidEqShell } from '../../utils/FluidEqContext';
import { useTranslation } from '../../utils/I18nContext';
import useWaveCard from './useWaveCard';
import WavePresetCard from './WavePresetCard';

/**
 * The plate while a game's own sound is on: the game's name with the live
 * dot its Gaming Lab tab wears, and on a press the card with the two ways
 * out of the game's sound — the music sound back, the suggested one, and the
 * Gaming Lab beside it.
 *
 * Never a way to the presets. The game is the preset then, tuned in the
 * Gaming Lab and nowhere else (Ivan, 2026-11-03: a preset picked into a
 * game's sound from the main screen "will complicate things"), as the
 * player's deck sends a press straight to the Lab (`GameSoundPresetButton`).
 */
const WavePresetGame = ({ game }: { game: IGameProfile }) => {
  const { t } = useTranslation();
  const { setGlobalError } = useFluidEqShell();
  const preset = usePlayingGamePreset();
  const card = useWaveCard();
  const [isBusy, setIsBusy] = useState(false);

  const backToMusic = () => {
    card.close();
    setIsBusy(true);
    putMusicSoundBack()
      .catch((error: unknown) => setGlobalError(error as ErrorDescription))
      .finally(() => setIsBusy(false));
  };
  const liveDot = (
    <span className="workspace-tab__live wave-preset__live" aria-hidden />
  );

  return (
    <div className="wave-preset__holder" ref={card.holderRef}>
      <button
        ref={card.plateRef}
        type="button"
        className="wave-preset__plate is-game"
        aria-haspopup="dialog"
        aria-expanded={card.isOpen}
        aria-label={t('wavePreset.gameLabel', { game: game.name })}
        onClick={card.toggle}
      >
        <GameIcon program={game} className="wave-preset__glyph" />
        <span className="wave-preset__name">{game.name}</span>
        {liveDot}
      </button>

      {card.isOpen && (
        <WavePresetCard
          cardRef={card.cardRef}
          glyph={
            <GameIcon program={game} className="wave-preset-card__glyph" />
          }
          name={
            <>
              {game.name}
              {liveDot}
            </>
          }
          label={game.name}
          line={t('wavePreset.gameOn', { game: game.name })}
          actions={
            <>
              <button
                type="button"
                className="button small"
                disabled={isBusy}
                onClick={backToMusic}
              >
                {t('wavePreset.backToMusic')}
              </button>
              <button
                type="button"
                className="button small subtle"
                onClick={() => {
                  card.close();
                  openGamingLab();
                }}
              >
                {t('wavePreset.openLab')}
              </button>
            </>
          }
        >
          {/* The curve the game's sound plays, named as its chip names it
              ("Competitive"). */}
          {preset && (
            <div className="eq-preset-tab__stages wave-preset-card__stages">
              <ul>
                <li className="wave-preset-card__chip">
                  <VoicingIcon
                    profileId={preset.glyph}
                    className="wave-preset-card__chip-glyph"
                  />
                  {preset.name}
                </li>
              </ul>
            </div>
          )}
        </WavePresetCard>
      )}
    </div>
  );
};

export default WavePresetGame;
