/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import { FilterTypeEnum } from '../../common/constants';
import {
  DSP_DEFAULTS,
  EQ_MAX_BAND_COUNT,
  IEqBandSettings,
  IEqSettings,
  eqEdited,
} from '../../common/dsp/chain';
import { TranslationKey } from '../../common/i18n/en';
import LabelledKnob from '../components/LabelledKnob';
import { useTranslation } from '../utils/I18nContext';
import Dropdown from '../widgets/Dropdown';
import DspEqGraph from './DspEqGraph';
import DspFilterShapeIcon from './DspFilterShapeIcon';
import DspPhaseMeter from './DspPhaseMeter';

const BAND_TYPES: { type: FilterTypeEnum; labelKey: TranslationKey }[] = [
  { type: FilterTypeEnum.PK, labelKey: 'dsp.eq.type.peak' },
  { type: FilterTypeEnum.LSC, labelKey: 'dsp.eq.type.lowShelf' },
  { type: FilterTypeEnum.HSC, labelKey: 'dsp.eq.type.highShelf' },
  { type: FilterTypeEnum.NO, labelKey: 'dsp.eq.type.notch' },
  { type: FilterTypeEnum.LPQ, labelKey: 'dsp.eq.type.lowPass' },
  { type: FilterTypeEnum.HPQ, labelKey: 'dsp.eq.type.highPass' },
  { type: FilterTypeEnum.BP, labelKey: 'dsp.eq.type.bandPass' },
];

/** Shapes with no gain of their own — the dial would do nothing. */
const NO_GAIN = new Set<string>([
  FilterTypeEnum.NO,
  FilterTypeEnum.LPQ,
  FilterTypeEnum.HPQ,
  FilterTypeEnum.BP,
]);

interface IDspEqCardProps {
  eq: IEqSettings;
  sampleRate: number;
  onChange: (next: IEqSettings) => void;
  onCommit: () => void;
}

/**
 * The EQ page: the curve, then the controls for ONE band, centred under it.
 *
 * Every band showing its own dials put fifteen rows of three knobs on screen
 * and made the graph a decoration beside them. The graph IS the control —
 * handles are dragged — and the strip below belongs to whichever band is
 * selected, which is what every parametric EQ settled on.
 */
const DspEqCard = ({ eq, sampleRate, onChange, onCommit }: IDspEqCardProps) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(0);
  // Clamped rather than stored clamped: the rack can shrink under the
  // selection — going from thirty-one bands to six, or importing a ten-filter
  // curve — and an index left pointing past the end edits a band that is not
  // there, so the knobs move and nothing happens.
  const active = Math.min(selected, eq.bands.length - 1);
  const band = eq.bands[active];
  const fallback = DSP_DEFAULTS.eq.bands[active] ?? band;
  const isFlat = NO_GAIN.has(band.type);

  /**
   * A new band beside the selected one, on the side asked for.
   *
   * Its frequency is the geometric mean of the pair it lands between, which is
   * the midpoint on a log axis and therefore the midpoint the graph and the ear
   * both see — halfway between 100 Hz and 1 kHz is 316 Hz, not 550. Past either
   * end there is no neighbour to average with, so it goes half an octave beyond
   * the last band rather than on top of it.
   *
   * It arrives flat, at the Q of the band it was added next to. A new band that
   * changed the sound the moment it appeared would be a second edit nobody
   * asked for.
   */
  const addBand = (side: 'left' | 'right') => {
    if (eq.bands.length >= EQ_MAX_BAND_COUNT) {
      return;
    }
    const at = side === 'left' ? active : active + 1;
    const before = eq.bands[at - 1];
    const after = eq.bands[at];
    let frequency: number;
    if (before && after) {
      frequency = Math.sqrt(before.frequency * after.frequency);
    } else if (after) {
      frequency = after.frequency / Math.SQRT2;
    } else {
      frequency = before.frequency * Math.SQRT2;
    }
    const inserted: IEqBandSettings = {
      enabled: true,
      // Static, like the neighbour it was inserted beside. A band that arrived
      // already reacting to the material would be a surprise rather than a
      // feature.
      dynamic: false,
      thresholdDb: -24,
      type: FilterTypeEnum.PK,
      frequency: Math.round(Math.min(20_000, Math.max(20, frequency))),
      gainDb: 0,
      quality: band.quality,
    };
    const bands = [...eq.bands.slice(0, at), inserted, ...eq.bands.slice(at)];
    onChange({
      ...eq,
      presetId: '',
      bands,
      // The rack the user is building is now the authored curve, or the next
      // change of size would fit back to the one they were editing away from.
      sourceBands: bands,
    });
    // Follow the new band. Adding one and leaving the strip on its neighbour
    // means the next knob turn edits the wrong band.
    setSelected(at);
    onCommit();
  };

  const patchBand = (index: number, next: Partial<IEqBandSettings>) => {
    const bands = eq.bands.map((one, at) =>
      at === index ? { ...one, ...next } : one,
    );
    onChange({
      ...eq,
      // Any hand-made change means the curve is no longer the preset it came
      // from, and the picker must stop claiming otherwise.
      presetId: '',
      bands,
      // A hand edit makes THIS rack the authored curve, so a later change of
      // size reads from what is on screen rather than from a file the user has
      // since moved away from.
      sourceBands: bands,
    });
  };

  return (
    <div className="dsp-eq">
      <DspEqGraph
        eq={eq}
        sampleRate={sampleRate}
        selected={active}
        onSelect={setSelected}
        onChange={patchBand}
        onCommit={onCommit}
      />

      {/* Numbered by their place in the chain, low to high, so the strip reads
          like the graph above it. Thirty-one will not fit a narrow window, so
          the row scrolls rather than wrapping into a block that moves the graph
          up and down as the rack changes size. */}
      <div
        className="dsp-eq-picker"
        role="tablist"
        aria-label={t('dsp.eq.bands')}
      >
        {eq.bands.map((one, index) => (
          <button
            // eslint-disable-next-line react/no-array-index-key -- the rack is positional and never reorders, so the slot IS the identity; keying by frequency instead collides the moment an imported file puts two filters on one centre.
            key={`pick-${index}`}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-label={`${t('dsp.eq.band')} ${index + 1}`}
            className={`dsp-eq-pick${index === active ? ' is-active' : ''}${
              one.enabled ? '' : ' is-off'
            }`}
            onClick={() => setSelected(index)}
          >
            {index + 1}
          </button>
        ))}
      </div>

      {/* Two blocks, not one row with a rule down it. The preamp is the whole
          curve's headroom and the strip is one band's controls — they are
          different scopes, and giving each its own panel says so without a
          label having to. */}
      <div className="dsp-eq-bottom">
        <div className="dsp-eq-preamp">
          <LabelledKnob
            label={t('dsp.eq.preamp')}
            value={eq.preampDb}
            min={-24}
            max={24}
            step={0.1}
            unit="dB"
            defaultValue={0}
            isDisabled={false}
            // Deliberately does NOT clear `presetId`: the preamp is headroom,
            // not part of the curve a preset describes, so trimming it must
            // not make the picker claim the preset was abandoned.
            //
            // Nor does it switch the regulator off. The two are separate gains:
            // the regulator makes exactly the room the curve needs and this
            // says how much of it to spend, so zero here means the rack sits at
            // unity and turning it up is a decision rather than an accident.
            onChange={(preampDb) => onChange({ ...eq, preampDb })}
            onCommit={onCommit}
          />
          {/* A readout, not a control: what the regulator is taking out in
              front of the bands so the preamp beside it can start from zero.
              Written in the dials' own grammar — figure over caption — because
              it stands in a row of them and anything else reads as a control
              that has lost its knob. */}
          <span className="dsp-eq-trim" title={t('dsp.eq.trimHint')}>
            <span className="dsp-eq-trim-value">{eq.trimDb.toFixed(1)} dB</span>
            <span className="dsp-eq-trim-label">{t('dsp.eq.trim')}</span>
          </span>
          {/* How much of the chosen character to apply. At zero every one of
              them collapses to the plain cookbook, so this is the off switch
              as well as the dial. */}
          <LabelledKnob
            label={t('dsp.eq.character')}
            value={Math.round(eq.modelAmount * 100)}
            min={0}
            max={100}
            step={1}
            unit="%"
            defaultValue={100}
            isDisabled={eq.model === 'clean'}
            onChange={(percent) =>
              onChange(eqEdited(eq, { modelAmount: percent / 100 }))
            }
            onCommit={onCommit}
          />
          {/* Cone protection, not tone. Rumble below hearing still costs real
              excursion, and the woofer spends it on nothing. */}
          <LabelledKnob
            label={t('dsp.eq.subsonic')}
            value={eq.subsonicHz}
            min={0}
            max={40}
            step={1}
            unit="Hz"
            defaultValue={0}
            isDisabled={false}
            // Below the clamp's floor there is no useful filter, so the dial
            // steps straight from off to the lowest one worth having.
            onChange={(hz) =>
              onChange(
                eqEdited(eq, { subsonicHz: hz > 0 && hz < 10 ? 10 : hz }),
              )
            }
            onCommit={onCommit}
          />
          {/* The only colour in the rack that filters cannot make. Zero is off
              and costs nothing; the stage is skipped entirely. */}
          <LabelledKnob
            label={t('dsp.eq.fuzz')}
            value={Math.round(eq.fuzzAmount * 100)}
            min={0}
            max={100}
            step={1}
            unit="%"
            defaultValue={0}
            isDisabled={false}
            onChange={(percent) =>
              onChange(eqEdited(eq, { fuzzAmount: percent / 100 }))
            }
            onCommit={onCommit}
          />
          {/* The phase-cancellation fix. Bass out of phase between the two
              channels vanishes the moment they are summed, which is what a
              phone speaker does — this removes the part that can cancel and
              leaves the middle whole. */}
          <LabelledKnob
            label={t('dsp.eq.monoBelow')}
            value={eq.monoBelowHz}
            min={0}
            max={300}
            step={5}
            unit="Hz"
            defaultValue={0}
            isDisabled={false}
            onChange={(hz) =>
              onChange(
                eqEdited(eq, { monoBelowHz: hz > 0 && hz < 40 ? 40 : hz }),
              )
            }
            onCommit={onCommit}
          />
        </div>

        <DspPhaseMeter />

        <div className="dsp-eq-strip">
          <div className="dsp-eq-shape">
            <span className="dsp-eq-field-label">{t('dsp.eq.shape')}</span>
            <Dropdown
              name={t('dsp.eq.shape')}
              value={band.type}
              isDisabled={!band.enabled}
              options={BAND_TYPES.map(({ type, labelKey }) => ({
                value: type,
                label: t(labelKey),
                display: (
                  <span className="dsp-shape-option">
                    <DspFilterShapeIcon type={type} />
                    {t(labelKey)}
                  </span>
                ),
              }))}
              handleChange={(next: string) => {
                patchBand(active, { type: next });
                onCommit();
              }}
            />
          </div>

          <LabelledKnob
            label={t('dsp.eq.frequency')}
            value={band.frequency}
            min={20}
            max={20_000}
            step={1}
            unit="Hz"
            defaultValue={fallback.frequency}
            isDisabled={!band.enabled}
            onChange={(frequency) => patchBand(active, { frequency })}
            onCommit={onCommit}
          />
          <LabelledKnob
            label={t('dsp.eq.gain')}
            value={band.gainDb}
            min={-24}
            max={24}
            step={0.1}
            unit="dB"
            defaultValue={0}
            // Shown and inert rather than removed for a notch or a pass: a strip
            // whose controls appear and vanish as the shape changes is one that
            // jumps under the hand.
            isDisabled={!band.enabled || isFlat}
            onChange={(gainDb) => patchBand(active, { gainDb })}
            onCommit={onCommit}
          />
          <LabelledKnob
            label={t('dsp.eq.quality')}
            value={band.quality}
            min={0.1}
            max={18}
            step={0.01}
            unit="Q"
            defaultValue={fallback.quality}
            isDisabled={!band.enabled}
            onChange={(quality) => patchBand(active, { quality })}
            onCommit={onCommit}
          />
          {/* Where this band starts acting, and only meaningful once it is
              dynamic — greyed rather than hidden, because a control that
              appears when a switch is thrown moves everything beside it and
              the row jumps under the pointer. */}
          <LabelledKnob
            label={t('dsp.eq.threshold')}
            value={band.thresholdDb}
            min={-60}
            max={0}
            step={0.5}
            unit="dB"
            defaultValue={fallback.thresholdDb}
            isDisabled={!band.enabled || !band.dynamic}
            onChange={(thresholdDb) => patchBand(active, { thresholdDb })}
            onCommit={onCommit}
          />

          {/* Quiet, and beside the band they act on: adding a band is a step
              in building a curve, not the thing this strip is for. */}
          <div className="dsp-eq-insert">
            <button
              type="button"
              className="button small subtle"
              disabled={eq.bands.length >= EQ_MAX_BAND_COUNT}
              title={t('dsp.eq.addLeft')}
              onClick={() => addBand('left')}
            >
              + ◀
            </button>
            <button
              type="button"
              className="button small subtle"
              disabled={eq.bands.length >= EQ_MAX_BAND_COUNT}
              title={t('dsp.eq.addRight')}
              onClick={() => addBand('right')}
            >
              ▶ +
            </button>
          </div>

          {/* Quiet whichever way it is set: a band that reacts is not the
              recommended state, it is a different job from the one beside it.
              The loud style here would say "turn this on", which is wrong for
              twelve of the fifteen bands in any rack. */}
          <button
            type="button"
            className="button small subtle"
            aria-pressed={band.dynamic}
            disabled={!band.enabled}
            title={t('dsp.eq.dynamicHint')}
            onClick={() => {
              patchBand(active, { dynamic: !band.dynamic });
              onCommit();
            }}
          >
            {band.dynamic ? t('dsp.eq.dynamicOn') : t('dsp.eq.dynamic')}
          </button>

          <button
            type="button"
            className={`button small${band.enabled ? '' : ' subtle'}`}
            aria-pressed={band.enabled}
            onClick={() => {
              patchBand(active, { enabled: !band.enabled });
              onCommit();
            }}
          >
            {band.enabled ? t('dsp.enabled') : t('dsp.eq.bandOff')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DspEqCard;
