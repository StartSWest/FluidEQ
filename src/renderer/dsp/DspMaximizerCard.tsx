/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  IMaximizerSettings,
  MAXIMIZER_MAX_CEILING_DB,
  MAXIMIZER_MAX_LOOK_AHEAD_MS,
  MAXIMIZER_MIN_LOOK_AHEAD_MS,
  MAXIMIZER_MIN_RELEASE_MS,
} from '../../common/dsp/chain';
import { RANGES } from '../../common/dsp/chainDefaults';
import { useTranslation } from '../utils/I18nContext';
import { Dial, ProcessorCard } from './DspControls';
import DspMaximizerBar from './DspMaximizerBar';
import DspMaximizerGraph from './DspMaximizerGraph';

interface IDspMaximizerCardProps {
  maximizer: IMaximizerSettings;
  onPatch: (next: IMaximizerSettings) => void;
  onCommit: () => void;
}

/**
 * The Maximizer's page: what it is doing, then the two decisions it is made of.
 *
 * Its own file for the same reason the Exciter's page is: it stopped being four
 * dials in a row. `DspPanel` had this stage inline while the whole page was one
 * meter, and the panel was already at the size this project allows.
 *
 * The dials are grouped rather than listed. Drive and Ceiling set the fixed
 * gain and the peak limit. Look-ahead and release shape how the limiter
 * handles each peak. Grouping the dials makes those relationships visible.
 */
const DspMaximizerCard = ({
  maximizer,
  onPatch,
  onCommit,
}: IDspMaximizerCardProps) => {
  const { t } = useTranslation();

  /**
   * Any change to the sound makes the result Custom; bypass does not.
   *
   * The same rule as the Exciter's page. A profile the user has since edited
   * must stop claiming to be that profile, or the picker is naming something
   * that is no longer on screen.
   */
  const patch = (next: Partial<IMaximizerSettings>) =>
    onPatch({ ...maximizer, ...next, presetId: '' });

  return (
    <ProcessorCard
      id="dsp-maximizer"
      titleKey="dsp.maximizer.title"
      isEnabled={maximizer.enabled}
      onToggle={() => {
        onPatch({ ...maximizer, enabled: !maximizer.enabled });
        onCommit();
      }}
      toolbar={
        <DspMaximizerBar
          maximizer={maximizer}
          onChange={onPatch}
          onCommit={onCommit}
        />
      }
    >
      <DspMaximizerGraph maximizer={maximizer} />

      <div className="dsp-maximizer-controls">
        <div className="dsp-band">
          <div className="dsp-band-head">
            <span className="dsp-band-title">
              {t('dsp.maximizer.group.loudness')}
            </span>
          </div>
          <p className="dsp-band-hint">
            {t('dsp.maximizer.group.loudnessHint')}
          </p>
          <div className="dsp-band-dials">
            {/* A cut here reserves headroom before the limiter. */}
            <Dial
              labelKey="dsp.maximizer.drive"
              value={maximizer.driveDb}
              defaultValue={DSP_DEFAULTS.maximizer.driveDb}
              min={RANGES.maximizerDriveDb.min}
              max={RANGES.maximizerDriveDb.max}
              unit="dB"
              step={0.1}
              isDisabled={!maximizer.enabled}
              onCommit={onCommit}
              onChange={(driveDb) => patch({ driveDb })}
            />
            <Dial
              labelKey="dsp.maximizer.ceiling"
              value={maximizer.ceilingDb}
              defaultValue={DSP_DEFAULTS.maximizer.ceilingDb}
              min={-12}
              max={MAXIMIZER_MAX_CEILING_DB}
              unit="dBTP"
              step={0.1}
              isDisabled={!maximizer.enabled}
              onCommit={onCommit}
              onChange={(ceilingDb) => patch({ ceilingDb })}
            />
          </div>
        </div>

        <div className="dsp-band">
          <div className="dsp-band-head">
            <span className="dsp-band-title">
              {t('dsp.maximizer.group.timing')}
            </span>
          </div>
          <p className="dsp-band-hint">{t('dsp.maximizer.group.timingHint')}</p>
          <div className="dsp-band-dials">
            <Dial
              labelKey="dsp.maximizer.lookAhead"
              value={maximizer.lookAheadMs}
              defaultValue={DSP_DEFAULTS.maximizer.lookAheadMs}
              min={MAXIMIZER_MIN_LOOK_AHEAD_MS}
              max={MAXIMIZER_MAX_LOOK_AHEAD_MS}
              unit="ms"
              step={0.1}
              isDisabled={!maximizer.enabled}
              onCommit={onCommit}
              onChange={(lookAheadMs) => patch({ lookAheadMs })}
            />
            <Dial
              labelKey="dsp.maximizer.release"
              value={maximizer.releaseMs}
              defaultValue={DSP_DEFAULTS.maximizer.releaseMs}
              min={MAXIMIZER_MIN_RELEASE_MS}
              max={1_000}
              unit="ms"
              step={5}
              isDisabled={!maximizer.enabled}
              onCommit={onCommit}
              onChange={(releaseMs) => patch({ releaseMs })}
            />
          </div>
        </div>
      </div>
    </ProcessorCard>
  );
};

export default DspMaximizerCard;
