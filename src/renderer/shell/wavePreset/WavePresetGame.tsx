/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { IGameProfile } from '../../../common/games';
import type { ErrorDescription } from '../../../common/errors';
import { useDspPresetCatalog } from '../../dsp/dspPresetCatalog';
import GameIcon from '../../games/GameIcon';
import { useLoadedGame } from '../../games/gameSoundStore';
import { openGamingLab } from '../../games/gamingLabEvents';
import usePlayingGamePreset from '../../games/usePlayingGamePreset';
import { putMusicSoundBack } from '../../games/useGameSound';
import Chevron from '../../icons/Chevron';
import MenuIcon from '../../icons/MenuIcon';
import VoicingIcon from '../../icons/VoicingIcon';
import { useFluidEqShell } from '../../utils/FluidEqContext';
import { useTranslation } from '../../utils/I18nContext';
import useWaveMenu from './useWaveMenu';
import WavePresetPanel from './WavePresetPanel';
import WavePresetRow from './WavePresetRow';

/**
 * The plate while a game's own sound is on: the game's name with the live
 * dot its Gaming Lab tab wears, and on a press the panel headed by the game,
 * with the way back to the music sound — naming the preset it brings back —
 * and the Gaming Lab.
 *
 * No None and no favourites: a game's sound is tuned in the Gaming Lab and
 * nowhere else (Ivan, 2026-11-03: a preset picked into a game's sound from
 * the main screen "will complicate things"; kept 2026-11-21 for the panel).
 */
const WavePresetGame = ({ game }: { game: IGameProfile }) => {
  const { t } = useTranslation();
  const { setGlobalError } = useFluidEqShell();
  const preset = usePlayingGamePreset();
  const { musicDsp } = useLoadedGame();
  const { catalog } = useDspPresetCatalog(t);
  const musicName = musicDsp?.presetId
    ? catalog.find((one) => one.id === musicDsp.presetId)?.name
    : undefined;
  const menu = useWaveMenu();
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const liveDot = (
    <span className="workspace-tab__live wave-preset__live" aria-hidden />
  );

  return (
    <div className="wave-preset__holder" ref={menu.holderRef}>
      <button
        ref={menu.plateRef}
        type="button"
        className="wave-preset__plate is-game"
        aria-haspopup="menu"
        aria-expanded={menu.isOpen}
        aria-label={t('wavePreset.gameLabel', { game: game.name })}
        onClick={menu.toggle}
      >
        <GameIcon program={game} className="wave-preset__glyph" />
        <span className="wave-preset__name">{game.name}</span>
        {liveDot}
        <Chevron className="wave-preset__caret" />
      </button>
      <span ref={setAnchor} className="wave-preset__anchor" aria-hidden />

      <WavePresetPanel
        anchor={anchor}
        isOpen={menu.isOpen}
        arrive={menu.arrive}
        close={menu.close}
        header={
          <>
            <div className="wave-preset-head">
              <GameIcon program={game} className="wave-preset-head__glyph" />
              <strong className="wave-preset-head__name">
                {game.name}
                {liveDot}
              </strong>
              <span className="wave-preset-head__line">
                {t('wavePreset.gameOn', { game: game.name })}
              </span>
            </div>
            {/* The curve the game's sound plays, named as its chip names it
                ("Competitive"). */}
            {preset && (
              <div className="eq-preset-tab__stages wave-preset-head__stages">
                <ul>
                  <li className="wave-preset-head__chip">
                    <VoicingIcon
                      profileId={preset.glyph}
                      className="wave-preset-head__chip-glyph"
                    />
                    {preset.name}
                  </li>
                </ul>
              </div>
            )}
          </>
        }
      >
        <div className="wave-preset-menu__lead">
          <WavePresetRow
            glyph={
              <VoicingIcon
                profileId="music"
                className="wave-preset-menu__glyph"
              />
            }
            name={t('wavePreset.backToMusic')}
            hint={musicName}
            isLoud
            disabled={isBusy}
            onPress={() => {
              menu.close();
              setIsBusy(true);
              putMusicSoundBack()
                .catch((error: unknown) =>
                  setGlobalError(error as ErrorDescription),
                )
                .finally(() => setIsBusy(false));
            }}
          />
          <WavePresetRow
            glyph={
              <MenuIcon name="gamepad" className="wave-preset-menu__glyph" />
            }
            name={t('wavePreset.openLab')}
            onPress={() => {
              menu.close();
              openGamingLab();
            }}
          />
        </div>
      </WavePresetPanel>
    </div>
  );
};

export default WavePresetGame;
