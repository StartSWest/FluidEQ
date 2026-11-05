/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import type { ErrorDescription } from '../../common/errors';
import { GAME_SOUND_PARTS } from '../../common/gameSoundParts';
import { gamingProfileOf, IGameProfile, TGameSource } from '../../common/games';
import {
  gamingProfileRef,
  IYoursGamingProfile,
  yoursGamingProfileId,
} from '../../common/gaming';
import type { TranslationKey } from '../../common/i18n/en';
import { useDspSettings } from '../dsp/store';
import useOutputName from '../player/useOutputName';
import { useFluidEqContext } from '../utils/FluidEqContext';
import {
  deleteGameSound,
  resetGameSound,
  saveGamingProfile,
  updateGamingProfile,
} from '../utils/gamingApi';
import { useTranslation } from '../utils/I18nContext';
import {
  GamingGameHead,
  GamingGameStatus,
  GamingProfilePick,
} from './GamingGameHead';
import GamingSaveMenu from './GamingSaveMenu';
import GamingStageEditor from './GamingStageEditor';
import GamingStageRail from './GamingStageRail';
import GamingStageWaiting from './GamingStageWaiting';
import { gamingProfileEntry } from './gamingCatalog';
import gameSeedFor from './gameSeed';
import { removeGameProfile, updateGameProfile } from './gameProfiles';
import { gamingStageIsOn, TGamingStage } from './gamingStages';
import { putGameSoundOn, putMusicSoundBack } from './useGameSound';
import usePlayingGamePreset from './usePlayingGamePreset';
import {
  sayGameCopyChanged,
  sayGamingProfilesChanged,
  useGameTuned,
} from './useGamingData';

const sourceKey = (source: TGameSource): TranslationKey =>
  `games.source.${source}` as TranslationKey;

interface IGamingGamePanelProps {
  game: IGameProfile;
  yours: readonly IYoursGamingProfile[];
  /** Whether this game's copy is the sound on now. */
  isLoaded: boolean;
  isPlaying: boolean;
}

/**
 * One game's own sound: where it came from, what has been tuned away from
 * that, and every part of it to tune, on one page (Ivan, 2026-11-02).
 */
const GamingGamePanel = ({
  game,
  yours,
  isLoaded,
  isPlaying,
}: IGamingGamePanelProps) => {
  const { t } = useTranslation();
  const { setGlobalError, filters, tone, headphone, headset } =
    useFluidEqContext();
  const rack = useDspSettings();
  const outputName = useOutputName();
  const tuned = useGameTuned(game.id, isLoaded);
  // The game's own curve lights the Curve part as a correction does (Ivan,
  // 2026-11-03: "curve tab needs to be on on game curve too"): it is one of
  // that part's chips, and the lamp read only the headphone layers.
  const playingPreset = usePlayingGamePreset();
  const profileId = gamingProfileOf(game);
  const profile = gamingProfileEntry(profileId, yours, t);
  const yoursId = gamingProfileRef(profileId);
  const [stage, setStage] = useState<TGamingStage>('footsteps');
  const [busy, setBusy] = useState(false);

  const run = (work: () => Promise<void>) => {
    setBusy(true);
    work()
      .catch((error: unknown) => setGlobalError(error as ErrorDescription))
      .finally(() => setBusy(false));
  };

  const seedOf = (id: string) => {
    const seed = gameSeedFor(id, rack);
    if (!seed) {
      throw new Error(`No Gaming profile to start ${game.name} from.`);
    }
    return seed;
  };

  /** The copy made again from a profile, heard at once if it is on. */
  const startFrom = (id: string) =>
    run(async () => {
      await resetGameSound(game.id, seedOf(id));
      sayGameCopyChanged();
    });

  const pickProfile = (id: string) => {
    if (id === profileId) {
      return;
    }
    updateGameProfile(game.id, { profileId: id });
    startFrom(id);
  };

  const lamps = isLoaded
    ? Object.fromEntries(
        GAME_SOUND_PARTS.map((part) => [
          part,
          gamingStageIsOn(part, rack, {
            hasBands: Object.values(filters).some((band) => band.gain !== 0),
            tone,
            hasCurve:
              Boolean(headphone) ||
              Boolean(headset) ||
              playingPreset !== undefined,
          }),
        ]),
      )
    : undefined;

  return (
    <section className="gaming-panel" aria-label={game.name}>
      <GamingGameHead
        game={game}
        where={
          outputName
            ? t('gaming.game.where', {
                source: t(sourceKey(game.source)),
                output: outputName,
              })
            : t(sourceKey(game.source))
        }
        isPlaying={isPlaying}
        pick={
          <GamingProfilePick
            profileId={profileId}
            yours={yours}
            onPick={pickProfile}
            disabled={busy}
          />
        }
        actions={
          <>
            <GamingSaveMenu
              gameName={game.name}
              profileName={profile.name}
              isYours={yoursId?.kind === 'yours'}
              isBusy={busy}
              onSaveNew={(name) =>
                run(async () => {
                  const saved = await saveGamingProfile(
                    game.id,
                    name,
                    game.name,
                  );
                  updateGameProfile(game.id, {
                    profileId: yoursGamingProfileId(saved.id),
                  });
                  sayGamingProfilesChanged();
                  sayGameCopyChanged();
                })
              }
              onUpdate={() =>
                run(async () => {
                  if (yoursId?.kind === 'yours') {
                    await updateGamingProfile(yoursId.id, game.id);
                    sayGamingProfilesChanged();
                    sayGameCopyChanged();
                  }
                })
              }
              onReset={() => startFrom(profileId)}
              onRename={(name) =>
                updateGameProfile(game.id, { copyName: name })
              }
              onDelete={() =>
                run(async () => {
                  await deleteGameSound(game.id);
                  removeGameProfile(game.id);
                })
              }
            />
            {isLoaded ? (
              <button
                type="button"
                className="button small"
                title={t('gaming.action.unloadHint')}
                disabled={busy}
                onClick={() => run(putMusicSoundBack)}
              >
                {t('gaming.action.unload')}
              </button>
            ) : (
              <button
                type="button"
                className="button small"
                title={t('gaming.action.tryHint', { game: game.name })}
                disabled={busy}
                onClick={() => run(() => putGameSoundOn(game, rack))}
              >
                {t('gaming.action.try')}
              </button>
            )}
          </>
        }
      />

      <GamingGameStatus
        tuned={tuned}
        profileName={profile.name}
        copyName={game.copyName}
      />

      <div className="dsp-body gaming-panel__body">
        <GamingStageRail
          active={stage}
          onSelect={setStage}
          lamps={lamps}
          tuned={tuned}
        />
        {isLoaded ? (
          <GamingStageEditor stage={stage} />
        ) : (
          <GamingStageWaiting
            gameName={game.name}
            isBusy={busy}
            onTryNow={() => run(() => putGameSoundOn(game, rack))}
          />
        )}
      </div>
    </section>
  );
};

export default GamingGamePanel;
