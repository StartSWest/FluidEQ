/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IFootstepsSettings } from '../../common/dsp/footsteps';
import { IGameRack } from '../../common/dsp/gameRoom';
import { engineRunsFootsteps, engineRunsGame } from '../../common/engineHealth';
import { requestEngineUpdate } from '../utils/engineUpdateRequest';
import { useTranslation } from '../utils/I18nContext';
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';
import Switch from '../widgets/Switch';
import { ProcessorCard } from './DspControls';
import DspFootstepsBar from './DspFootstepsBar';
import DspFootstepsControls from './DspFootstepsControls';
import DspFootstepsGraph from './DspFootstepsGraph';
import DspGameEnvironment from './DspGameEnvironment';
import DspGameVoices from './DspGameVoices';

interface IDspFootstepsCardProps {
  /** The filter, and the Room a game's pick switches (`pickGame`). */
  game: IGameRack;
  onPatch: (next: Partial<IGameRack>) => void;
  onCommit: () => void;
}

/**
 * The Game filter's page: the game picked, what Footsteps lifted
 * (`DspFootstepsGraph`), then its three parts — Footsteps, Dialogue and
 * Environment. Before them, on an engine from before the filter or before
 * its later parts, the one thing the page cannot show: that they are not
 * heard yet. The Room has no part here: its own filter stands beside this
 * one in the same rail, and a second editor of it was one too many (Ivan,
 * 2026-11-03). A game's pick still sets it.
 */
const DspFootstepsCard = ({
  game,
  onPatch,
  onCommit,
}: IDspFootstepsCardProps) => {
  const { t } = useTranslation();
  const { footsteps } = game;
  // What the window already holds, never a new ask on mount.
  const status = useKnownAudioEngineStatus();
  const onFluid = status?.engine === 'fluid';
  const runsFootsteps =
    !onFluid || engineRunsFootsteps(status.fluid?.dllVersion);
  const runsGame = !onFluid || engineRunsGame(status.fluid?.dllVersion);

  /** A sound edit stops a preset being that preset; the listener's do not. */
  const patch = (next: Partial<IFootstepsSettings>) =>
    onPatch({ footsteps: { ...footsteps, ...next, presetId: '' } });
  const patchListener = (next: Partial<IFootstepsSettings>) =>
    onPatch({ footsteps: { ...footsteps, ...next } });

  const update =
    status?.fluidUpdateReady === true ? (
      <button
        type="button"
        className="button small"
        onClick={requestEngineUpdate}
      >
        {t('engineUpdate.action')}
      </button>
    ) : null;

  return (
    <ProcessorCard
      id="dsp-footsteps"
      titleKey="dsp.footsteps.title"
      isEnabled={footsteps.enabled}
      onToggle={() => {
        // Disarmed on the way past, as every other monitor in the rack is.
        onPatch({
          footsteps: {
            ...footsteps,
            enabled: !footsteps.enabled,
            isolate: false,
          },
        });
        onCommit();
      }}
      toolbar={
        <DspFootstepsBar game={game} onChange={onPatch} onCommit={onCommit} />
      }
      beforePower={
        /* Through `onPatch`, not `patch`: listening to a stage is not
           editing it, so the preset keeps its name. */
        <div
          className="dsp-monitor-isolate"
          title={
            footsteps.isolate
              ? t('dsp.footsteps.isolateOn')
              : t('dsp.footsteps.isolateHint')
          }
        >
          <span
            className={`dsp-monitor-isolate-label${
              footsteps.isolate ? ' is-on' : ''
            }`}
            aria-hidden="true"
          >
            {t('dsp.footsteps.isolate')}
          </span>
          <Switch
            id="dsp-footsteps-isolate"
            isOn={footsteps.isolate}
            isDisabled={!footsteps.enabled}
            handleToggle={() => {
              patchListener({ isolate: !footsteps.isolate });
              onCommit();
            }}
            ariaLabel={t('dsp.footsteps.isolate')}
          />
        </div>
      }
    >
      {!runsFootsteps ? (
        <div className="dsp-footsteps-engine">
          <p>{t('dsp.footsteps.engineOld')}</p>
          {update}
        </div>
      ) : null}
      {runsFootsteps && !runsGame ? (
        <div className="dsp-footsteps-engine">
          <p>{t('dsp.game.engineOld')}</p>
          {update}
        </div>
      ) : null}

      <DspFootstepsGraph
        enabled={footsteps.enabled}
        isolate={footsteps.isolate}
      />

      <div className="dsp-game-parts">
        <DspFootstepsControls
          footsteps={footsteps}
          onEdit={patch}
          onCommit={onCommit}
        />
        <DspGameVoices
          footsteps={footsteps}
          isHeard={runsGame}
          onEdit={patch}
          onCommit={onCommit}
        />
        <DspGameEnvironment
          footsteps={footsteps}
          isHeard={runsGame}
          onEdit={patch}
          onCommit={onCommit}
        />
      </div>
    </ProcessorCard>
  );
};

export default DspFootstepsCard;
