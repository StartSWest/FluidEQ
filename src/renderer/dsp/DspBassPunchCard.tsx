/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IBassPunchSettings } from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';
import DspBassPunchBar from './DspBassPunchBar';
import DspBassPunchGraph from './DspBassPunchGraph';
import { Dial, ProcessorCard } from './DspControls';
import Switch from '../widgets/Switch';

interface IDspBassPunchCardProps {
  bassPunch: IBassPunchSettings;
  onPatch: (next: IBassPunchSettings) => void;
  onCommit: () => void;
}

/**
 * The Bass Punch page: what the stage is doing to time, then the six
 * decisions behind it.
 *
 * The dials sit in one group, the way Forge's do and unlike the paired boxes
 * the Maximizer and Dimension use, because this stage's decisions do not
 * divide into two either: Attack and Sustain are the two halves of one note,
 * Bloom and its decay are a single control in two numbers, and Duck buys the
 * same weight from somewhere else entirely. Split feeds every one of them.
 *
 * Attack and Sustain are bipolar. Zero is not off here: it is the stage
 * running, hearing the note, and deciding to change nothing about it — which
 * is why they carry a default of 0 and a range symmetric about it rather than
 * an amount that starts at nothing. `Knob` reads that symmetry off the range
 * itself and grows the arc from the centre, so the rest position draws no arc
 * at all; the EQ's band gain and the side bar's preamp answer to the same
 * rule, and nothing here had to ask for it.
 */
const DspBassPunchCard = ({
  bassPunch,
  onPatch,
  onCommit,
}: IDspBassPunchCardProps) => {
  const { t } = useTranslation();

  /**
   * Any change to the sound makes the result Custom; bypass does not.
   *
   * The same rule as the Exciter's, Maximizer's, Dimension's and Forge's
   * pages. A profile the user has since edited must stop claiming to be that
   * profile, or the picker is naming something that is no longer on screen.
   */
  const patch = (next: Partial<IBassPunchSettings>) =>
    onPatch({ ...bassPunch, ...next, presetId: '' });

  return (
    <ProcessorCard
      id="dsp-bass-punch"
      titleKey="dsp.bassPunch.title"
      isEnabled={bassPunch.enabled}
      onToggle={() => {
        onPatch({ ...bassPunch, enabled: !bassPunch.enabled });
        onCommit();
      }}
      toolbar={
        <DspBassPunchBar
          bassPunch={bassPunch}
          onChange={onPatch}
          onCommit={onCommit}
        />
      }
      beforePower={
        /* The same labelled switch, in the same place, as the three stages
           that already have one. Through `onPatch` rather than `patch`:
           `patch` clears `presetId` because a sound edit stops a profile being
           that profile, and listening to a stage is not editing it. */
        <div
          className="dsp-monitor-isolate"
          title={
            bassPunch.isolate
              ? t('dsp.bassPunch.isolateOn')
              : t('dsp.bassPunch.isolateHint')
          }
        >
          <span
            className={`dsp-monitor-isolate-label${
              bassPunch.isolate ? ' is-on' : ''
            }`}
            aria-hidden="true"
          >
            {t('dsp.bassPunch.isolate')}
          </span>
          <Switch
            id="dsp-bass-punch-isolate"
            isOn={bassPunch.isolate}
            isDisabled={!bassPunch.enabled}
            handleToggle={() => {
              onPatch({ ...bassPunch, isolate: !bassPunch.isolate });
              onCommit();
            }}
            ariaLabel={t('dsp.bassPunch.isolate')}
          />
        </div>
      }
    >
      <DspBassPunchGraph bassPunch={bassPunch} />

      <div className="dsp-band dsp-bass-punch-controls">
        <div className="dsp-band-dials">
          {/* First, because every other dial on this page acts on the band
              this one defines — and on the band it leaves behind, which is
              what Duck pulls down. Bounds mirror `RANGES.bassSplitHz`, which
              is what clamps them. */}
          <Dial
            labelKey="dsp.bassPunch.splitHz"
            value={bassPunch.splitHz}
            defaultValue={DSP_DEFAULTS.bassPunch.splitHz}
            min={40}
            max={200}
            unit="Hz"
            step={5}
            isDisabled={!bassPunch.enabled}
            onCommit={onCommit}
            onChange={(splitHz) => patch({ splitHz })}
          />
          {/* Bipolar, and the centre is where it rests. Left of it softens the
              leading edge, right of it hardens it; zero leaves the transient
              exactly as it arrived. Bounds mirror `RANGES.bassPunchShape`. */}
          <Dial
            labelKey="dsp.bassPunch.attack"
            value={bassPunch.attack}
            defaultValue={DSP_DEFAULTS.bassPunch.attack}
            min={-1}
            max={1}
            unit=""
            step={0.01}
            isDisabled={!bassPunch.enabled}
            onCommit={onCommit}
            onChange={(attack) => patch({ attack })}
          />
          {/* Beside Attack because the two never fight over the same
              milliseconds: attack scales how far the fast follower stands
              above the slow one, which is only ever nonzero during a rise,
              and this shapes the tail after they have converged. A profile can
              hit hard and decay short. */}
          <Dial
            labelKey="dsp.bassPunch.sustain"
            value={bassPunch.sustain}
            defaultValue={DSP_DEFAULTS.bassPunch.sustain}
            min={-1}
            max={1}
            unit=""
            step={0.01}
            isDisabled={!bassPunch.enabled}
            onCommit={onCommit}
            onChange={(sustain) => patch({ sustain })}
          />
          {/* Not a longer sustain: this ADDS a short mono decay under the
              note, which is real tail energy and the one thing a neighbour
              through a wall can hear. */}
          <Dial
            labelKey="dsp.bassPunch.bloomAmount"
            value={bassPunch.bloomAmount}
            defaultValue={DSP_DEFAULTS.bassPunch.bloomAmount}
            min={0}
            max={1}
            unit=""
            step={0.01}
            isDisabled={!bassPunch.enabled}
            onCommit={onCommit}
            onChange={(bloomAmount) => patch({ bloomAmount })}
          />
          {/* How long that tail lasts. Inert rather than meaningless while the
              amount is zero, which is why four profiles still carry a figure
              here. Bounds mirror `RANGES.bassPunchBloomDecayMs`. */}
          <Dial
            labelKey="dsp.bassPunch.bloomDecayMs"
            value={bassPunch.bloomDecayMs}
            defaultValue={DSP_DEFAULTS.bassPunch.bloomDecayMs}
            min={40}
            max={250}
            unit="ms"
            step={5}
            isDisabled={!bassPunch.enabled}
            onCommit={onCommit}
            onChange={(bloomDecayMs) => patch({ bloomDecayMs })}
          />
          {/* Last, and the only one that touches nothing below the split: it
              pulls mid and high down under the low band's own envelope, so
              bass gets room rather than more level. */}
          <Dial
            labelKey="dsp.bassPunch.duck"
            value={bassPunch.duck}
            defaultValue={DSP_DEFAULTS.bassPunch.duck}
            min={0}
            max={1}
            unit=""
            step={0.01}
            isDisabled={!bassPunch.enabled}
            onCommit={onCommit}
            onChange={(duck) => patch({ duck })}
          />
        </div>
      </div>

      {/* The strip above draws two different kinds of measurement and has to
          say so. Nothing on the canvas can: the difference is in how the three
          numbers are SAMPLED, and a picture that looked uniform would be
          claiming they read alike. */}
      <p className="dsp-dimension-note">{t('dsp.bassPunch.meterNote')}</p>
    </ProcessorCard>
  );
};

export default DspBassPunchCard;
