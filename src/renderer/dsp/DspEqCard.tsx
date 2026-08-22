/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import { FilterTypeEnum } from '../../common/constants';
import {
  DSP_DEFAULTS,
  IEqBandSettings,
  IEqSettings,
} from '../../common/dsp/chain';
import { TranslationKey } from '../../common/i18n/en';
import LabelledKnob from '../components/LabelledKnob';
import { useTranslation } from '../utils/I18nContext';
import Dropdown from '../widgets/Dropdown';
import DspEqGraph from './DspEqGraph';
import DspFilterShapeIcon from './DspFilterShapeIcon';

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
  const band = eq.bands[selected] ?? eq.bands[0];
  const fallback = DSP_DEFAULTS.eq.bands[selected] ?? DSP_DEFAULTS.eq.bands[0];
  const isFlat = NO_GAIN.has(band.type);

  const patchBand = (index: number, next: Partial<IEqBandSettings>) => {
    onChange({
      ...eq,
      // Any hand-made change means the curve is no longer the preset it came
      // from, and the picker must stop claiming otherwise.
      presetId: '',
      bands: eq.bands.map((one, at) =>
        at === index ? { ...one, ...next } : one,
      ),
    });
  };

  return (
    <div className="dsp-eq">
      <DspEqGraph
        eq={eq}
        sampleRate={sampleRate}
        selected={selected}
        onSelect={setSelected}
        onChange={patchBand}
        onCommit={onCommit}
      />

      {/* Numbered by their place in the chain, low to high, so the strip reads
          like the graph above it. Fifteen of them fit one row at any panel
          width because each is a fixed 24px. */}
      <div
        className="dsp-eq-picker"
        role="tablist"
        aria-label={t('dsp.eq.bands')}
      >
        {eq.bands.map((one, index) => (
          <button
            key={`pick-${DSP_DEFAULTS.eq.bands[index].frequency}`}
            type="button"
            role="tab"
            aria-selected={index === selected}
            aria-label={`${t('dsp.eq.band')} ${index + 1}`}
            className={`dsp-eq-pick${index === selected ? ' is-active' : ''}${
              one.enabled ? '' : ' is-off'
            }`}
            onClick={() => setSelected(index)}
          >
            {index + 1}
          </button>
        ))}
      </div>

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
              patchBand(selected, { type: next });
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
          onChange={(frequency) => patchBand(selected, { frequency })}
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
          onChange={(gainDb) => patchBand(selected, { gainDb })}
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
          onChange={(quality) => patchBand(selected, { quality })}
          onCommit={onCommit}
        />

        <button
          type="button"
          className={`button small${band.enabled ? '' : ' subtle'}`}
          aria-pressed={band.enabled}
          onClick={() => {
            patchBand(selected, { enabled: !band.enabled });
            onCommit();
          }}
        >
          {band.enabled ? t('dsp.enabled') : t('dsp.eq.bandOff')}
        </button>
      </div>
    </div>
  );
};

export default DspEqCard;
