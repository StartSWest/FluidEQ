/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum, FilterTypeToLabelMap } from '../../common/constants';
import {
  DSP_DEFAULTS,
  IEqBandSettings,
  IEqSettings,
} from '../../common/dsp/chain';
import { TranslationKey } from '../../common/i18n/en';
import LabelledKnob from '../components/LabelledKnob';
import { useTranslation } from '../utils/I18nContext';
import DspEqCurve from './DspEqCurve';

/** The shapes offered per band, in the order a desk lists them. */
const BAND_TYPES: FilterTypeEnum[] = [
  FilterTypeEnum.PK,
  FilterTypeEnum.LSC,
  FilterTypeEnum.HSC,
  FilterTypeEnum.NO,
  FilterTypeEnum.LPQ,
  FilterTypeEnum.HPQ,
  FilterTypeEnum.BP,
];

/** Shapes with no gain of their own — the knob would do nothing. */
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

const DspEqCard = ({ eq, sampleRate, onChange, onCommit }: IDspEqCardProps) => {
  const { t } = useTranslation();

  const patchBand = (index: number, next: Partial<IEqBandSettings>) =>
    onChange({
      ...eq,
      bands: eq.bands.map((band, at) =>
        at === index ? { ...band, ...next } : band,
      ),
    });

  return (
    <div className="dsp-eq">
      <DspEqCurve eq={eq} sampleRate={sampleRate} />
      <div className="dsp-eq-bands">
        {eq.bands.map((band, index) => {
          const isFlat = NO_GAIN.has(band.type);
          const fallback = DSP_DEFAULTS.eq.bands[index];
          return (
            <div
              className={`dsp-eq-band${band.enabled ? '' : ' is-off'}`}
              key={`${index === 0 ? 'first' : ''}band-${fallback.frequency}`}
            >
              <div className="dsp-eq-band-head">
                <div className="dsp-eq-band-type">
                  <span className="dsp-eq-band-index" aria-hidden="true">
                    {index + 1}
                  </span>
                  {/* A `div` and not a `label`: the select names itself with
                      `aria-label`, and a label with nothing to point `htmlFor`
                      at would give the control two names and the wrapper
                      none. */}
                  <select
                    value={band.type}
                    aria-label={t('dsp.eq.shape')}
                    onChange={(event) => {
                      patchBand(index, { type: event.target.value });
                      onCommit();
                    }}
                  >
                    {BAND_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {FilterTypeToLabelMap[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="button small subtle"
                  aria-pressed={band.enabled}
                  onClick={() => {
                    patchBand(index, { enabled: !band.enabled });
                    onCommit();
                  }}
                >
                  {band.enabled ? t('dsp.enabled') : t('dsp.eq.bandOff')}
                </button>
              </div>
              <div className="dsp-eq-band-dials">
                <LabelledKnob
                  label={t('dsp.eq.frequency' as TranslationKey)}
                  value={band.frequency}
                  min={20}
                  max={20_000}
                  step={1}
                  unit="Hz"
                  defaultValue={fallback.frequency}
                  isDisabled={!band.enabled}
                  onChange={(frequency) => patchBand(index, { frequency })}
                  onCommit={onCommit}
                />
                <LabelledKnob
                  label={t('dsp.eq.gain' as TranslationKey)}
                  value={band.gainDb}
                  min={-24}
                  max={24}
                  step={0.1}
                  unit="dB"
                  defaultValue={0}
                  // A notch, a pass or a band pass has no gain of its own, so
                  // the knob is shown and inert rather than removed: a band
                  // whose controls appear and vanish as its shape changes is a
                  // card that jumps under the hand.
                  isDisabled={!band.enabled || isFlat}
                  onChange={(gainDb) => patchBand(index, { gainDb })}
                  onCommit={onCommit}
                />
                <LabelledKnob
                  label={t('dsp.eq.quality' as TranslationKey)}
                  value={band.quality}
                  min={0.1}
                  max={18}
                  step={0.01}
                  unit="Q"
                  defaultValue={fallback.quality}
                  isDisabled={!band.enabled}
                  onChange={(quality) => patchBand(index, { quality })}
                  onCommit={onCommit}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DspEqCard;
