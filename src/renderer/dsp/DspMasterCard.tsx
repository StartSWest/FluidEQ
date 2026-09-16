/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IMasterSettings } from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import { Dial, ProcessorCard } from './DspControls';
import DspMasterBar from './DspMasterBar';
import DspMasterDevSafety from './DspMasterDevSafety';
import DspMasterGraph from './DspMasterGraph';
import { IMasterLoudnessBreakdown } from './inputNormalizer';

const IS_DEV = process.env.NODE_ENV !== 'production';

interface IDspMasterCardProps {
  master: IMasterSettings;
  safetyEnabled: boolean;
  /**
   * The makeup AND why it is that number.
   *
   * One value would leave the card recomputing the explanation beside an
   * engine that computed the value, which is how two derivations of one number
   * drift until the readout contradicts the dial above it.
   */
  loudness: IMasterLoudnessBreakdown;
  onSafetyToggle: () => void;
  onPatch: (next: IMasterSettings) => void;
  onCommit: () => void;
}

/** The transparent output boundary, deliberately last in the visible chain. */
const DspMasterCard = ({
  master,
  safetyEnabled,
  loudness,
  onSafetyToggle,
  onPatch,
  onCommit,
}: IDspMasterCardProps) => {
  const { t } = useTranslation();
  // No output-safety meter on this component: it changes with every host
  // frame, so the graph and the development readout each read it themselves
  // and this page's dials are not redrawn a hundred times a second.
  const loudnessGainDb = loudness.appliedDb;
  /**
   * Any change to a delivery number makes the result Custom; the rest do not.
   *
   * The same rule as the Exciter's and the Maximizer's pages. Output gain,
   * release and matched listen are how the stage is being used rather than
   * where the result is going, so moving one of those must not make the picker
   * stop naming the destination that is still selected.
   */
  const patchDelivery = (next: Partial<IMasterSettings>) =>
    onPatch({ ...master, ...next, presetId: '' });

  return (
    <ProcessorCard
      id="dsp-master"
      titleKey="dsp.master.title"
      isEnabled={master.enabled}
      onToggle={() => {
        onPatch({ ...master, enabled: !master.enabled });
        onCommit();
      }}
      toolbar={
        <DspMasterBar master={master} onChange={onPatch} onCommit={onCommit} />
      }
    >
      <DspMasterGraph
        master={master}
        safetyEnabled={safetyEnabled}
        loudnessGainDb={loudnessGainDb}
      />
      <div className="dsp-crossovers">
        <Dial
          labelKey="dsp.master.outputTrim"
          value={master.outputTrimDb}
          defaultValue={DSP_DEFAULTS.master.outputTrimDb}
          min={-24}
          max={6}
          unit="dB"
          step={0.1}
          isDisabled={!master.enabled}
          onCommit={onCommit}
          onChange={(outputTrimDb) => onPatch({ ...master, outputTrimDb })}
        />
        <Dial
          labelKey="dsp.master.ceiling"
          value={master.ceilingDb}
          defaultValue={DSP_DEFAULTS.master.ceilingDb}
          min={-12}
          max={-0.1}
          unit="dBTP"
          step={0.1}
          isDisabled={!master.enabled || !master.loudnessMaximize}
          onCommit={onCommit}
          onChange={(ceilingDb) => patchDelivery({ ceilingDb })}
        />
        <Dial
          labelKey="dsp.master.loudnessTarget"
          value={master.loudnessTargetLufs}
          defaultValue={DSP_DEFAULTS.master.loudnessTargetLufs}
          min={-24}
          max={-6}
          unit="LUFS"
          step={0.5}
          isDisabled={!master.enabled || !master.loudnessMaximize}
          onCommit={onCommit}
          onChange={(loudnessTargetLufs) =>
            patchDelivery({ loudnessTargetLufs })
          }
        />
        {/* The control that decides whether the target is reached at all.
            Beside the target rather than under a heading of its own, because
            the two are one decision: how loud, and what it may cost. */}
        <Dial
          labelKey="dsp.master.peakLimiting"
          value={master.peakLimitingDb}
          defaultValue={DSP_DEFAULTS.master.peakLimitingDb}
          min={0}
          max={12}
          unit="dB"
          step={0.5}
          isDisabled={!master.enabled || !master.loudnessMaximize}
          onCommit={onCommit}
          onChange={(peakLimitingDb) => patchDelivery({ peakLimitingDb })}
        />
        {/* Shipped as a setting, a wire parameter and a translated string, and
            never as a control. It is the difference between limiting that is
            heard and limiting that is not, which matters far more now that the
            target actually engages the limiter. */}
        <Dial
          labelKey="dsp.master.release"
          value={master.releaseMs}
          defaultValue={DSP_DEFAULTS.master.releaseMs}
          min={40}
          max={400}
          unit="ms"
          step={5}
          isDisabled={!master.enabled || !master.loudnessMaximize}
          onCommit={onCommit}
          onChange={(releaseMs) => onPatch({ ...master, releaseMs })}
        />
      </div>

      <div className="dsp-band dsp-master-option">
        <div className="dsp-band-head">
          <span className="dsp-band-title">
            {t('dsp.master.loudnessMaximize')}
          </span>
          <Switch
            id="dsp-master-loudness-maximize"
            isOn={master.loudnessMaximize}
            isDisabled={!master.enabled}
            handleToggle={() => {
              onPatch({
                ...master,
                loudnessMaximize: !master.loudnessMaximize,
              });
              onCommit();
            }}
            ariaLabel={t('dsp.master.loudnessMaximize')}
          />
        </div>
        <p className="dsp-band-hint">
          {t('dsp.master.loudnessMaximizeHint', {
            gain: loudnessGainDb.toFixed(1),
          })}
        </p>
        {/* Which term produced that number, when it was not the target.
            Without it the dial says -9 LUFS, the hint says +2.5 dB, and there
            is nothing on the page connecting the two. */}
        {master.enabled &&
        master.loudnessMaximize &&
        loudness.limitedBy !== 'none' ? (
          <p className="dsp-normalizer-limit">
            {t(`dsp.master.limit.${loudness.limitedBy}`, {
              requested: loudness.requestedDb.toFixed(1),
              room: loudness.peakRoomDb.toFixed(1),
              limiting: loudness.limitingDb.toFixed(1),
            })}
          </p>
        ) : undefined}
      </div>

      {/* Keeping this listening option below LUFS Maximize made one bottom
          surface twice as tall as its neighbours and forced the DSP workspace
          to scroll at Full HD. It remains adjacent and dependent, but as a
          sibling the three bottom surfaces share one compact row. */}
      <div className="dsp-band dsp-master-option">
        <div className="dsp-band-head">
          <span className="dsp-band-title">
            {t('dsp.master.matchedBypass')}
          </span>
          <Switch
            id="dsp-master-matched-bypass"
            isOn={master.matchedBypass}
            isDisabled={!master.enabled || !master.loudnessMaximize}
            handleToggle={() => {
              onPatch({ ...master, matchedBypass: !master.matchedBypass });
              onCommit();
            }}
            ariaLabel={t('dsp.master.matchedBypass')}
          />
        </div>
        <p className="dsp-band-hint">
          {t('dsp.master.matchedBypassHint', {
            gain: loudnessGainDb.toFixed(1),
          })}
        </p>
      </div>

      {IS_DEV ? (
        <DspMasterDevSafety
          master={master}
          safetyEnabled={safetyEnabled}
          loudnessGainDb={loudnessGainDb}
          onSafetyToggle={onSafetyToggle}
        />
      ) : undefined}
    </ProcessorCard>
  );
};

export default DspMasterCard;
