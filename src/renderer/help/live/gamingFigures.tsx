/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { DSP_DEFAULTS } from 'common/dsp/chain';
import { gamingProfileOf, IGameProfile } from 'common/games';
import type { IGameCopySound } from 'common/gaming';
import { FLAT_TONE } from 'common/tone';
import gameSeedFor from '../../games/gameSeed';
import { gamingProfileEntry } from '../../games/gamingCatalog';
import {
  GamingGameHead,
  GamingGameStatus,
  GamingProfilePick,
} from '../../games/GamingGameHead';
import GamingGameRow from '../../games/GamingGameRow';
import GamingLabFrame, { drawnRailWidth } from '../../games/GamingLabFrame';
import GamingLabHead from '../../games/GamingLabHead';
import GamingSaveMenu from '../../games/GamingSaveMenu';
import GamingStageRail from '../../games/GamingStageRail';
import GamingStageWaiting from '../../games/GamingStageWaiting';
import type { TGamingStage } from '../../games/gamingStages';
import { useTranslation } from '../../utils/I18nContext';

/**
 * The Gaming Lab chapter's page, drawn by the page's own parts
 * (`helpChapters/sound.ts`), in two figures.
 *
 * Three made-up games, the first in front and tuned: the page's top line,
 * the list, and the chosen game's header — its profile picker, Save as
 * profile and Try it now — with the line saying what was tuned; then its
 * parts (`GamingPartsDrawing`). Every part here is the page's own component,
 * handed these games instead of the reader's; nothing is read from the
 * reader's games, profiles or outputs, and nothing acts.
 */

const nothing = () => undefined;

const GAMES: readonly IGameProfile[] = [
  {
    id: 'help-cs2',
    name: 'Counter-Strike 2',
    path: 'C:\\Games\\Counter-Strike 2',
    source: 'steam',
    presetId: '',
    copyName: 'Ranked nights',
  },
  {
    id: 'help-cyberpunk',
    name: 'Cyberpunk 2077',
    path: 'C:\\Games\\Cyberpunk 2077',
    source: 'gog',
    presetId: '',
  },
  {
    id: 'help-stardew',
    name: 'Stardew Valley',
    path: 'C:\\Games\\Stardew Valley',
    source: 'steam',
    presetId: '',
  },
];

const TUNED: readonly TGamingStage[] = ['footsteps', 'mainEq', 'curve'];

/**
 * What a ready-made profile's first copy plays, as main makes it from the
 * seed (`gameCopyFromSeed`): a new profile's sound — no bands, a flat Tone,
 * no correction — with the profile's rack and game curve. The drawing asks
 * main nothing, so it is made here from the same seed.
 */
const soundOfProfile = (profileId: string): IGameCopySound | undefined => {
  const seed = gameSeedFor(profileId, DSP_DEFAULTS);
  return seed?.kind === 'rack'
    ? {
        dsp: seed.dsp,
        ...(seed.gameCurve ? { curveId: seed.gameCurve } : {}),
        bands: 0,
        tone: FLAT_TONE,
        hasCorrection: false,
      }
    : undefined;
};

const GamingLabDrawing = () => {
  const { t } = useTranslation();
  const [shown] = GAMES;
  const profile = gamingProfileEntry(gamingProfileOf(shown), [], t);
  return (
    <div className="workspace-tab-panel workspace-tab-panel--games">
      <div className="workspace-tab-panel__scroll">
        <GamingLabFrame
          count={GAMES.length}
          isOn
          isPinned
          onPinned={nothing}
          railWidth={drawnRailWidth}
          onAdd={nothing}
          rows={GAMES.map((game) => (
            <GamingGameRow
              key={game.id}
              game={game}
              profileName={
                gamingProfileEntry(gamingProfileOf(game), [], t).name
              }
              isTuned={game.id === shown.id}
              isSelected={game.id === shown.id}
              isPlaying={game.id === shown.id}
              onSelect={nothing}
            />
          ))}
          head={
            <GamingLabHead
              view="games"
              onView={nothing}
              isOn
              onToggle={nothing}
            />
          }
        >
          <section className="gaming-panel" aria-label={shown.name}>
            <GamingGameHead
              game={shown}
              where={t('gaming.game.where', {
                source: t('games.source.steam'),
                output: 'Arctis Nova 7',
              })}
              isPlaying
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
                    {t('gaming.action.try')}
                  </button>
                </>
              }
            />
            <GamingGameStatus
              tuned={TUNED}
              profileName={profile.name}
              copyName={shown.copyName}
            />
          </section>
        </GamingLabFrame>
      </div>
    </div>
  );
};

/**
 * The same game's parts, in the panel's card: the rail of every part of its
 * sound and the editor beside it as it stands while the sound is not on. A
 * figure of its own, because drawn under the header its sixteen stages made
 * one figure so tall that the header's call-outs had to cross the page to
 * reach a margin.
 */
export const GamingPartsDrawing = () => {
  const [shown] = GAMES;
  return (
    <div className="workspace-tab-panel workspace-tab-panel--games">
      <div className="workspace-tab-panel__scroll">
        <div className="gaming-lab">
          <div className="gaming-lab__main">
            <section className="gaming-panel" aria-label={shown.name}>
              <div className="dsp-body gaming-panel__body">
                <GamingStageRail
                  active="footsteps"
                  onSelect={nothing}
                  tuned={TUNED}
                />
                <GamingStageWaiting
                  game={shown}
                  sound={soundOfProfile(gamingProfileOf(shown))}
                  stage="footsteps"
                  isBusy={false}
                  onTune={nothing}
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamingLabDrawing;
