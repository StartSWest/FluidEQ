/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';
import {
  gameCurveVoicing,
  gameCurveVoicingId,
} from '../../../common/dsp/gameCurves';
import { dspVoicingPresetId } from '../../../common/dsp/presetVoicing';
import { gamingProfileOf, type IGameProfile } from '../../../common/games';
import { presetLayerName } from '../../dsp/dspPresetCatalog';
import { gamingProfileEntry } from '../../games/gamingCatalog';
import {
  GamingGameHead,
  GamingGameStatus,
  GamingProfilePick,
} from '../../games/GamingGameHead';
import GamingGameRow from '../../games/GamingGameRow';
import GamingLabHead from '../../games/GamingLabHead';
import { GamingNowPlayingTag } from '../../games/GamingNowPlaying';
import GamingSaveMenu from '../../games/GamingSaveMenu';
import type { TGamingStage } from '../../games/gamingStages';
import VoicingIcon from '../../icons/VoicingIcon';
import { useTranslation } from '../../utils/I18nContext';
import Switch from '../../widgets/Switch';

/**
 * The Gaming Lab as its page draws it, in two turns: the music playing, then
 * the game in front with its own sound on — the top line naming the game and
 * its preset, Game mode switched on, the game marked Playing and Unload where
 * Try it now was. Built from the page's own parts, as Help's drawing of the
 * page is (`help/live/gamingFigures`), handed made-up state instead of the
 * reader's; inert, so nothing in it can be pressed. Two games, not Help's
 * three: the slide gives the picture a third of the dialog's width, where the
 * page folds its list over the game, and a third row pushed How to start
 * under the stage's foot.
 */

const nothing = () => undefined;

const GAMES: readonly IGameProfile[] = [
  {
    id: 'tour-cs2',
    name: 'Counter-Strike 2',
    path: 'C:\\Games\\Counter-Strike 2',
    source: 'steam',
    presetId: '',
  },
  {
    id: 'tour-cyberpunk',
    name: 'Cyberpunk 2077',
    path: 'C:\\Games\\Cyberpunk 2077',
    source: 'gog',
    presetId: '',
  },
];

const TUNED: readonly TGamingStage[] = ['footsteps', 'mainEq', 'curve'];

/**
 * Game mode as the Lab's top line shows it (`GameModeSwitch`), drawn from its
 * classes alone: the real one reads the reader's rack and engine.
 */
function GameModeTag({ on }: { on: boolean }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className={`game-mode-switch${on ? ' is-on' : ''}`}>
      <label htmlFor={id} className="game-mode-switch__label">
        <VoicingIcon profileId="games" className="game-mode-switch__icon" />
        <span className="game-mode-switch__word">
          {t('dsp.latency.gameMode')}
        </span>
      </label>
      <Switch
        id={id}
        isOn={on}
        isDisabled={false}
        handleToggle={nothing}
        ariaLabel={t('dsp.latency.gameMode')}
      />
    </div>
  );
}

function LabTurn({ playing }: { playing: boolean }) {
  const { t } = useTranslation();
  const [shown] = GAMES;
  const profile = gamingProfileEntry(gamingProfileOf(shown), [], t);
  // The curve the game plays, named and drawn as its Preset chip has it.
  const voicing = gameCurveVoicing(gameCurveVoicingId('competitive'));
  const glyph = dspVoicingPresetId(voicing);
  const name = voicing ? presetLayerName(voicing, t) : undefined;
  return (
    <div
      className={`gaming-lab-visual__turn gaming-lab-visual__turn--${
        playing ? 'game' : 'music'
      }`}
    >
      <div className="workspace-tab-panel workspace-tab-panel--games">
        <div className="workspace-tab-panel__scroll">
          <div className="gaming-lab">
            <GamingLabHead
              view="games"
              onView={nothing}
              isOn
              onToggle={nothing}
              onAdd={nothing}
              nowPlaying={
                playing ? (
                  <GamingNowPlayingTag
                    game={shown}
                    preset={glyph && name ? { glyph, name } : undefined}
                    onShow={nothing}
                  />
                ) : undefined
              }
              gameMode={<GameModeTag on={playing} />}
            />
            <div className="gaming-games">
              <div className="gaming-games__list">
                <span className="gaming-cap">
                  {t('gaming.list.count', { count: GAMES.length })}
                </span>
                {GAMES.map((game) => (
                  <GamingGameRow
                    key={game.id}
                    game={game}
                    profileName={
                      gamingProfileEntry(gamingProfileOf(game), [], t).name
                    }
                    isTuned={game.id === shown.id}
                    isSelected={game.id === shown.id}
                    isPlaying={playing && game.id === shown.id}
                    onSelect={nothing}
                  />
                ))}
              </div>
              <section className="gaming-panel" aria-label={shown.name}>
                <GamingGameHead
                  game={shown}
                  where={t('gaming.game.where', {
                    source: t('games.source.steam'),
                    output: 'Arctis Nova 7',
                  })}
                  isPlaying={playing}
                  pick={
                    <GamingProfilePick
                      profileId={gamingProfileOf(shown)}
                      yours={[]}
                      onPick={nothing}
                      disabled={false}
                    />
                  }
                  actions={
                    <>
                      <GamingSaveMenu
                        gameName={shown.name}
                        profileName={profile.name}
                        isYours={false}
                        isBusy={false}
                        onSaveNew={nothing}
                        onUpdate={nothing}
                        onReset={nothing}
                        onRename={nothing}
                        onDelete={nothing}
                      />
                      <button type="button" className="button small">
                        {t(
                          playing
                            ? 'gaming.action.unload'
                            : 'gaming.action.try',
                        )}
                      </button>
                    </>
                  }
                />
                <GamingGameStatus tuned={TUNED} profileName={profile.name} />
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GamingLabVisual() {
  const { t } = useTranslation();
  return (
    <div
      className="gaming-lab-visual"
      role="img"
      aria-label={t('tour.games.imageAlt')}
      inert
    >
      <LabTurn playing={false} />
      <LabTurn playing />
    </div>
  );
}
