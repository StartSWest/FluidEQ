/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IBassForgeSettings } from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';
import DspBassForgeBar from './DspBassForgeBar';
import DspBassForgeGraph from './DspBassForgeGraph';
import { Dial, ProcessorCard } from './DspControls';
import Switch from '../widgets/Switch';

interface IDspBassForgeCardProps {
  bassForge: IBassForgeSettings;
  onPatch: (next: IBassForgeSettings) => void;
  onCommit: () => void;
}

/**
 * The Bass Forge page: what the stage made, then the six decisions behind it.
 *
 * The dials sit in one group rather than in the paired boxes the Maximizer and
 * Dimension use, because this stage's decisions do not divide into two: Sub
 * and Presence are two ways of answering the same question — how much low end,
 * and whether the speaker can radiate it — and Texture, Drive and Amount all
 * shape what those two produced. Split feeds every one of them.
 *
 * The graph is what makes that readable: the split is drawn, the two
 * generators are drawn in their own hues either side of it, and the six
 * numbers below are the settings for a picture the user is already looking at.
 */
const DspBassForgeCard = ({
  bassForge,
  onPatch,
  onCommit,
}: IDspBassForgeCardProps) => {
  const { t } = useTranslation();

  /**
   * Any change to the sound makes the result Custom; bypass does not.
   *
   * The same rule as the Exciter's, Maximizer's and Dimension's pages. A
   * profile the user has since edited must stop claiming to be that profile,
   * or the picker is naming something that is no longer on screen.
   */
  const patch = (next: Partial<IBassForgeSettings>) =>
    onPatch({ ...bassForge, ...next, presetId: '' });

  return (
    <ProcessorCard
      id="dsp-bass-forge"
      titleKey="dsp.bassForge.title"
      isEnabled={bassForge.enabled}
      onToggle={() => {
        // Disarmed on the way past, as every other monitor in the rack is.
        // Left armed under bypass, the next enable plays the stage's
        // contribution alone with the switch that did it out of sight.
        onPatch({ ...bassForge, enabled: !bassForge.enabled, isolate: false });
        onCommit();
      }}
      toolbar={
        <DspBassForgeBar
          bassForge={bassForge}
          onChange={onPatch}
          onCommit={onCommit}
        />
      }
      beforePower={
        /* The labelled switch the EQ, the Exciter and Denoise already use, in
           the same place on the header row. It goes through `onPatch` rather
           than `patch` on purpose: `patch` clears `presetId` because a sound
           edit stops a profile being that profile, and listening to a stage is
           not editing it. */
        <div
          className="dsp-monitor-isolate"
          title={
            bassForge.isolate
              ? t('dsp.bassForge.isolateOn')
              : t('dsp.bassForge.isolateHint')
          }
        >
          <span
            className={`dsp-monitor-isolate-label${
              bassForge.isolate ? ' is-on' : ''
            }`}
            aria-hidden="true"
          >
            {t('dsp.bassForge.isolate')}
          </span>
          <Switch
            id="dsp-bass-forge-isolate"
            isOn={bassForge.isolate}
            isDisabled={!bassForge.enabled}
            handleToggle={() => {
              onPatch({ ...bassForge, isolate: !bassForge.isolate });
              onCommit();
            }}
            ariaLabel={t('dsp.bassForge.isolate')}
          />
        </div>
      }
    >
      <DspBassForgeGraph bassForge={bassForge} />

      <div className="dsp-band dsp-bass-forge-controls">
        <div className="dsp-band-dials">
          {/* First, because every other dial on this page acts on the band
              this one defines: nothing above it reaches either generator.
              Bounds mirror `RANGES.bassSplitHz`, which is what clamps them. */}
          <Dial
            labelKey="dsp.bassForge.splitHz"
            value={bassForge.splitHz}
            defaultValue={DSP_DEFAULTS.bassForge.splitHz}
            min={40}
            max={200}
            unit="Hz"
            step={5}
            isDisabled={!bassForge.enabled}
            onCommit={onCommit}
            onChange={(splitHz) => patch({ splitHz })}
          />
          {/* The real octave below, for hardware that can radiate one. */}
          <Dial
            labelKey="dsp.bassForge.subAmount"
            value={bassForge.subAmount}
            defaultValue={DSP_DEFAULTS.bassForge.subAmount}
            min={0}
            max={1}
            unit=""
            step={0.01}
            isDisabled={!bassForge.enabled}
            onCommit={onCommit}
            onChange={(subAmount) => patch({ subAmount })}
          />
          {/* Beside Sub rather than anywhere else, because it is the same
              decision answered for hardware that cannot: harmonics OF that
              octave, which let the ear reconstruct a pitch a laptop speaker
              radiates nothing at. */}
          <Dial
            labelKey="dsp.bassForge.presenceAmount"
            value={bassForge.presenceAmount}
            defaultValue={DSP_DEFAULTS.bassForge.presenceAmount}
            min={0}
            max={1}
            unit=""
            step={0.01}
            isDisabled={!bassForge.enabled}
            onCommit={onCommit}
            onChange={(presenceAmount) => patch({ presenceAmount })}
          />
          {/* 1 is pure second order — the octave up, and the clearest phantom
              fundamental. 0 is pure third, a twelfth up and an edgier read.
              The full span, unlike the Exciter's 0.7 ceiling: see
              `RANGES.bassForgeTexture` for why that ceiling does not apply. */}
          <Dial
            labelKey="dsp.bassForge.texture"
            value={bassForge.texture}
            defaultValue={DSP_DEFAULTS.bassForge.texture}
            min={0}
            max={1}
            unit=""
            step={0.01}
            isDisabled={!bassForge.enabled}
            onCommit={onCommit}
            onChange={(texture) => patch({ texture })}
          />
          {/* Not a gain in front of the generators — they are level-invariant
              and a gain has nothing to bite on. It pushes what they made into
              an asymmetric saturator, which is the whole of "hot" here. */}
          <Dial
            labelKey="dsp.bassForge.driveDb"
            value={bassForge.driveDb}
            defaultValue={DSP_DEFAULTS.bassForge.driveDb}
            min={0}
            max={12}
            unit="dB"
            step={0.1}
            isDisabled={!bassForge.enabled}
            onCommit={onCommit}
            onChange={(driveDb) => patch({ driveDb })}
          />
          {/* Last, because it scales everything to its left: how much of what
              the two generators made is allowed back into the signal. */}
          <Dial
            labelKey="dsp.bassForge.mix"
            value={bassForge.mix}
            defaultValue={DSP_DEFAULTS.bassForge.mix}
            min={0}
            max={1}
            unit=""
            step={0.01}
            isDisabled={!bassForge.enabled}
            onCommit={onCommit}
            onChange={(mix) => patch({ mix })}
          />
        </div>
      </div>

      {/* There is no mono dial to find, so the page has to say why. Forge
          generates from `(low[0] + low[1]) / 2` as a construction of the
          stage rather than as a setting, and the mono-maker that roughly
          twenty EQ profiles reference stays in the EQ where they can reach
          it. Without this line the absence reads as a missing control. */}
      <p className="dsp-dimension-note">{t('dsp.bassForge.monoNote')}</p>
    </ProcessorCard>
  );
};

export default DspBassForgeCard;
