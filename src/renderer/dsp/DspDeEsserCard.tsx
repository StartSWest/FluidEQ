/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IDeEsserSettings } from '../../common/dsp/deEsser';
import { engineRunsDeEsser } from '../../common/engineHealth';
import { requestEngineUpdate } from '../utils/engineUpdateRequest';
import { useTranslation } from '../utils/I18nContext';
import { useKnownAudioEngineStatus } from '../utils/useAudioEngineStatus';
import Switch from '../widgets/Switch';
import { ProcessorCard } from './DspControls';
import DspDeEsserBar from './DspDeEsserBar';
import DspDeEsserControls from './DspDeEsserControls';
import DspDeEsserGraph from './DspDeEsserGraph';

interface IDspDeEsserCardProps {
  deEsser: IDeEsserSettings;
  onPatch: (next: IDeEsserSettings) => void;
  onCommit: () => void;
}

/**
 * The De-esser's page: what it did (`DspDeEsserGraph`), then its four
 * decisions (`DspDeEsserControls`). Before them, on an engine from before the
 * stage, the one thing the page cannot show: that it is not heard yet.
 */
const DspDeEsserCard = ({
  deEsser,
  onPatch,
  onCommit,
}: IDspDeEsserCardProps) => {
  const { t } = useTranslation();
  // What the window already holds, never a new ask on mount.
  const status = useKnownAudioEngineStatus();
  const isEngineBehind =
    status?.engine === 'fluid' && !engineRunsDeEsser(status.fluid?.dllVersion);

  /** A sound edit stops a profile being that profile; bypass does not. */
  const patch = (next: Partial<IDeEsserSettings>) =>
    onPatch({ ...deEsser, ...next, presetId: '' });

  const isOff = !deEsser.enabled;

  return (
    <ProcessorCard
      id="dsp-de-esser"
      titleKey="dsp.deEsser.title"
      isEnabled={deEsser.enabled}
      onToggle={() => {
        // Disarmed on the way past, as every other monitor in the rack is.
        onPatch({ ...deEsser, enabled: !deEsser.enabled, isolate: false });
        onCommit();
      }}
      toolbar={
        <DspDeEsserBar
          deEsser={deEsser}
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
            deEsser.isolate
              ? t('dsp.deEsser.isolateOn')
              : t('dsp.deEsser.isolateHint')
          }
        >
          <span
            className={`dsp-monitor-isolate-label${
              deEsser.isolate ? ' is-on' : ''
            }`}
            aria-hidden="true"
          >
            {t('dsp.deEsser.isolate')}
          </span>
          <Switch
            id="dsp-de-esser-isolate"
            isOn={deEsser.isolate}
            isDisabled={isOff}
            handleToggle={() => {
              onPatch({ ...deEsser, isolate: !deEsser.isolate });
              onCommit();
            }}
            ariaLabel={t('dsp.deEsser.isolate')}
          />
        </div>
      }
    >
      {isEngineBehind ? (
        <div className="dsp-de-esser-engine">
          <p>{t('dsp.deEsser.engineOld')}</p>
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

      <DspDeEsserGraph deEsser={deEsser} />

      <DspDeEsserControls
        deEsser={deEsser}
        onEdit={patch}
        onCommit={onCommit}
      />
    </ProcessorCard>
  );
};

export default DspDeEsserCard;
