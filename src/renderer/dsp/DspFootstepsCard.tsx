/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IFootstepsSettings } from '../../common/dsp/footsteps';
import { engineRunsFootsteps } from '../../common/engineHealth';
import { requestEngineUpdate } from '../utils/engineUpdateRequest';
import { useTranslation } from '../utils/I18nContext';
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';
import Switch from '../widgets/Switch';
import { ProcessorCard } from './DspControls';
import DspFootstepsBar from './DspFootstepsBar';
import DspFootstepsControls from './DspFootstepsControls';
import DspFootstepsGraph from './DspFootstepsGraph';

interface IDspFootstepsCardProps {
  footsteps: IFootstepsSettings;
  onPatch: (next: IFootstepsSettings) => void;
  onCommit: () => void;
}

/**
 * Footsteps' page: what it lifted (`DspFootstepsGraph`), then its two dials
 * and the bands they act on (`DspFootstepsControls`). Before them, on an
 * engine from before the stage, the one thing the page cannot show: that it
 * is not heard yet.
 */
const DspFootstepsCard = ({
  footsteps,
  onPatch,
  onCommit,
}: IDspFootstepsCardProps) => {
  const { t } = useTranslation();
  // What the window already holds, never a new ask on mount.
  const status = useKnownAudioEngineStatus();
  const isEngineBehind =
    status?.engine === 'fluid' &&
    !engineRunsFootsteps(status.fluid?.dllVersion);

  /** A sound edit stops a profile being that profile; bypass does not. */
  const patch = (next: Partial<IFootstepsSettings>) =>
    onPatch({ ...footsteps, ...next, presetId: '' });

  return (
    <ProcessorCard
      id="dsp-footsteps"
      titleKey="dsp.footsteps.title"
      isEnabled={footsteps.enabled}
      onToggle={() => {
        // Disarmed on the way past, as every other monitor in the rack is.
        onPatch({ ...footsteps, enabled: !footsteps.enabled, isolate: false });
        onCommit();
      }}
      toolbar={
        <DspFootstepsBar
          footsteps={footsteps}
          onChange={onPatch}
          onCommit={onCommit}
        />
      }
      beforePower={
        /* Through `onPatch`, not `patch`: listening to a stage is not
           editing it, so the profile keeps its name. */
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
              onPatch({ ...footsteps, isolate: !footsteps.isolate });
              onCommit();
            }}
            ariaLabel={t('dsp.footsteps.isolate')}
          />
        </div>
      }
    >
      {isEngineBehind ? (
        <div className="dsp-footsteps-engine">
          <p>{t('dsp.footsteps.engineOld')}</p>
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

      <DspFootstepsGraph
        enabled={footsteps.enabled}
        isolate={footsteps.isolate}
      />

      <DspFootstepsControls
        footsteps={footsteps}
        onEdit={patch}
        onCommit={onCommit}
      />
    </ProcessorCard>
  );
};

export default DspFootstepsCard;
