/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDynamicsSettings } from '../../common/dsp/dynamicsStage';
import {
  engineRunsDynamics,
  engineReportsDynamics,
} from '../../common/engineHealth';
import { requestEngineUpdate } from '../utils/engineUpdateRequest';
import { useTranslation } from '../utils/I18nContext';
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';
import { ProcessorCard } from './DspControls';
import DspDynamicsControls from './DspDynamicsControls';
import DspDynamicsBar from './DspDynamicsBar';
import DspDynamicsGraph from './DspDynamicsGraph';

interface IDspDynamicsCardProps {
  dynamics: IDynamicsSettings;
  onPatch: (next: IDynamicsSettings) => void;
  onCommit: () => void;
}

/**
 * Dynamics' page: what each band does to its level, drawn from the engine's
 * own curve, then each band's lift and hold, then how fast. On an engine from
 * before the stage, the one thing the page cannot show: that it is not heard
 * yet, with the update beside it.
 */
const DspDynamicsCard = ({
  dynamics,
  onPatch,
  onCommit,
}: IDspDynamicsCardProps) => {
  const { t } = useTranslation();
  // What the window already holds, never a new ask on mount.
  const status = useKnownAudioEngineStatus();
  const isHeard =
    status?.engine !== 'fluid' || engineRunsDynamics(status.fluid?.dllVersion);
  const needsLiveUpdate =
    isHeard &&
    status?.engine === 'fluid' &&
    !engineReportsDynamics(status.fluid?.dllVersion);

  return (
    <ProcessorCard
      id="dsp-dynamics"
      titleKey="dsp.dynamics.title"
      isEnabled={dynamics.enabled}
      onToggle={() => {
        onPatch({ ...dynamics, enabled: !dynamics.enabled });
        onCommit();
      }}
      toolbar={
        <DspDynamicsBar
          dynamics={dynamics}
          onChange={onPatch}
          onCommit={onCommit}
        />
      }
    >
      {!isHeard || needsLiveUpdate ? (
        <div className="dsp-footsteps-engine">
          <p>
            {t(
              needsLiveUpdate
                ? 'dsp.dynamics.engineLiveOld'
                : 'dsp.dynamics.engineOld',
            )}
          </p>
          {status?.fluidUpdateReady === true ? (
            <button
              type="button"
              className="button small"
              onClick={requestEngineUpdate}
            >
              {t('engineUpdate.action')}
            </button>
          ) : null}
        </div>
      ) : null}

      <DspDynamicsGraph dynamics={dynamics} />

      <DspDynamicsControls
        dynamics={dynamics}
        onPatch={onPatch}
        onCommit={onCommit}
      />
    </ProcessorCard>
  );
};

export default DspDynamicsCard;
