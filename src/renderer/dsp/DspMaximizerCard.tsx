/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  IMaximizerSettings,
  MAXIMIZER_MAX_CEILING_DB,
  MAXIMIZER_MIN_LOOK_AHEAD_MS,
  MAXIMIZER_MIN_RELEASE_MS,
} from '../../common/dsp/chain';
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
 * The dials are grouped rather than listed. Drive and Ceiling are one decision
 * — how much louder, against a line that never moves — and look-ahead and
 * release are the other, which is whether that loudness is heard as level or as
 * the limiter working. In one flat row of four they read as four unrelated
 * numbers, and the pairing is most of what somebody needs to know to set them.
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
            {/* First, because it is the control that makes this a maximizer
                rather than a limiter: gain goes in and the ceiling holds the
                top. Everything under the peaks comes up. */}
            <Dial
              labelKey="dsp.maximizer.drive"
              value={maximizer.driveDb}
              defaultValue={DSP_DEFAULTS.maximizer.driveDb}
              min={0}
              max={12}
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
              max={20}
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
