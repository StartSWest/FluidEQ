/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ReactNode } from 'react';
import {
  IBandSettings,
  IDspSettings,
  clampDspSettings,
} from '../../common/dsp/chain';
import { DSP_PRESETS } from '../../common/dsp/presets';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import NumberInput from '../widgets/NumberInput';
import Switch from '../widgets/Switch';
import '../styles/Dsp.scss';

interface IDspPanelProps {
  settings: IDspSettings;
  onChange: (next: IDspSettings) => void;
  /** False when the audio engine could not start; the panel says so. */
  isActive: boolean;
}

interface IFieldProps {
  labelKey: TranslationKey;
  value: number;
  min: number;
  max: number;
  unit?: string;
  precision?: number;
  isDisabled: boolean;
  onChange: (next: number) => void;
}

const Field = ({
  labelKey,
  value,
  min,
  max,
  unit,
  precision,
  isDisabled,
  onChange,
}: IFieldProps) => {
  const { t } = useTranslation();
  // A `div` and not a `label`: `NumberInput` names its own control from
  // `name`, so wrapping it in a label with nothing to point `htmlFor` at
  // would give the field two accessible names and the outer one no control.
  return (
    <div className="dsp-field">
      <span className="dsp-field-label" aria-hidden="true">
        {t(labelKey)}
      </span>
      <NumberInput
        name={t(labelKey)}
        value={value}
        min={min}
        max={max}
        isDisabled={isDisabled}
        floatPrecision={precision ?? 0}
        showArrows
        showLabel={false}
        handleSubmit={async (next: number) => onChange(next)}
      />
      {unit ? <span className="dsp-field-unit">{unit}</span> : undefined}
    </div>
  );
};

interface ISectionProps {
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  id: string;
  isEnabled: boolean;
  onToggle: () => void;
  children: ReactNode;
}

const Section = ({
  titleKey,
  descriptionKey,
  id,
  isEnabled,
  onToggle,
  children,
}: ISectionProps) => {
  const { t } = useTranslation();
  return (
    <section className="dsp-section">
      <header className="dsp-section-header">
        <Switch
          id={id}
          isOn={isEnabled}
          isDisabled={false}
          handleToggle={onToggle}
          ariaLabel={t(titleKey)}
        />
        <div className="dsp-section-titles">
          <h3 className="dsp-section-title">{t(titleKey)}</h3>
          <p className="dsp-section-description">{t(descriptionKey)}</p>
        </div>
      </header>
      <div className="dsp-controls">{children}</div>
    </section>
  );
};

/**
 * The DSP chain's controls.
 *
 * The scope notice is visible text in the header rather than a tooltip, and
 * that is not decoration. Every other pill in the EQ group configures
 * Equalizer APO and therefore all system audio; this one processes only what
 * FluidEQ itself plays. A user who assumes otherwise does not report a
 * misunderstanding — they report the feature as broken.
 */
const DspPanel = ({ settings, onChange, isActive }: IDspPanelProps) => {
  const { t } = useTranslation();
  const { exciter, compressor, maximizer } = settings;

  const patch = (next: Partial<IDspSettings>) =>
    onChange(clampDspSettings({ ...settings, ...next }));

  const patchBand = (index: number, next: Partial<IBandSettings>) =>
    patch({
      compressor: {
        ...compressor,
        bands: compressor.bands.map((band, at) =>
          at === index ? { ...band, ...next } : band,
        ),
      },
    });

  const bandLabels: TranslationKey[] = [
    'dsp.compressor.band.low',
    'dsp.compressor.band.mid',
    'dsp.compressor.band.high',
  ];

  return (
    <div className="dsp-panel">
      <header className="dsp-header">
        <h2 className="dsp-title">{t('dsp.title')}</h2>
        <p className="dsp-scope">{t('dsp.scopeNotice')}</p>
        {isActive ? undefined : (
          <p className="dsp-unavailable">{t('dsp.unavailable')}</p>
        )}
      </header>

      <div className="dsp-presets">
        <span className="dsp-presets-label">{t('dsp.presets')}</span>
        {DSP_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="button small subtle"
            onClick={() => onChange(preset.settings)}
          >
            {t(preset.labelKey as TranslationKey)}
          </button>
        ))}
      </div>

      <Section
        id="dsp-exciter"
        titleKey="dsp.exciter.title"
        descriptionKey="dsp.exciter.description"
        isEnabled={exciter.enabled}
        onToggle={() =>
          patch({ exciter: { ...exciter, enabled: !exciter.enabled } })
        }
      >
        <Field
          labelKey="dsp.exciter.crossover"
          value={exciter.crossoverHz}
          min={1_000}
          max={12_000}
          unit="Hz"
          isDisabled={!exciter.enabled}
          onChange={(crossoverHz) =>
            patch({ exciter: { ...exciter, crossoverHz } })
          }
        />
        <Field
          labelKey="dsp.exciter.drive"
          value={exciter.drive}
          min={1}
          max={10}
          precision={1}
          isDisabled={!exciter.enabled}
          onChange={(drive) => patch({ exciter: { ...exciter, drive } })}
        />
        <Field
          labelKey="dsp.exciter.mix"
          value={exciter.mix}
          min={0}
          max={1}
          precision={2}
          isDisabled={!exciter.enabled}
          onChange={(mix) => patch({ exciter: { ...exciter, mix } })}
        />
      </Section>

      <Section
        id="dsp-compressor"
        titleKey="dsp.compressor.title"
        descriptionKey="dsp.compressor.description"
        isEnabled={compressor.enabled}
        onToggle={() =>
          patch({ compressor: { ...compressor, enabled: !compressor.enabled } })
        }
      >
        <Field
          labelKey="dsp.compressor.crossoverLow"
          value={compressor.crossoverHz[0]}
          min={60}
          max={600}
          unit="Hz"
          isDisabled={!compressor.enabled}
          onChange={(low) =>
            patch({
              compressor: {
                ...compressor,
                crossoverHz: [low, compressor.crossoverHz[1]],
              },
            })
          }
        />
        <Field
          labelKey="dsp.compressor.crossoverHigh"
          value={compressor.crossoverHz[1]}
          min={1_000}
          max={10_000}
          unit="Hz"
          isDisabled={!compressor.enabled}
          onChange={(high) =>
            patch({
              compressor: {
                ...compressor,
                crossoverHz: [compressor.crossoverHz[0], high],
              },
            })
          }
        />
        {compressor.bands.map((band, index) => (
          <fieldset className="dsp-band" key={bandLabels[index]}>
            <legend className="dsp-band-title">{t(bandLabels[index])}</legend>
            <Field
              labelKey="dsp.compressor.threshold"
              value={band.thresholdDb}
              min={-60}
              max={0}
              unit="dB"
              isDisabled={!compressor.enabled}
              onChange={(thresholdDb) => patchBand(index, { thresholdDb })}
            />
            <Field
              labelKey="dsp.compressor.ratio"
              value={band.ratio}
              min={1}
              max={20}
              precision={1}
              isDisabled={!compressor.enabled}
              onChange={(ratio) => patchBand(index, { ratio })}
            />
            <Field
              labelKey="dsp.compressor.attack"
              value={band.attackMs}
              min={0.1}
              max={200}
              unit="ms"
              precision={1}
              isDisabled={!compressor.enabled}
              onChange={(attackMs) => patchBand(index, { attackMs })}
            />
            <Field
              labelKey="dsp.compressor.release"
              value={band.releaseMs}
              min={5}
              max={2_000}
              unit="ms"
              isDisabled={!compressor.enabled}
              onChange={(releaseMs) => patchBand(index, { releaseMs })}
            />
            <Field
              labelKey="dsp.compressor.makeup"
              value={band.makeupDb}
              min={0}
              max={24}
              unit="dB"
              precision={1}
              isDisabled={!compressor.enabled}
              onChange={(makeupDb) => patchBand(index, { makeupDb })}
            />
          </fieldset>
        ))}
      </Section>

      <Section
        id="dsp-maximizer"
        titleKey="dsp.maximizer.title"
        descriptionKey="dsp.maximizer.description"
        isEnabled={maximizer.enabled}
        onToggle={() =>
          patch({ maximizer: { ...maximizer, enabled: !maximizer.enabled } })
        }
      >
        <Field
          labelKey="dsp.maximizer.ceiling"
          value={maximizer.ceilingDb}
          min={-12}
          max={0}
          unit="dB"
          precision={1}
          isDisabled={!maximizer.enabled}
          onChange={(ceilingDb) =>
            patch({ maximizer: { ...maximizer, ceilingDb } })
          }
        />
        <Field
          labelKey="dsp.maximizer.lookAhead"
          value={maximizer.lookAheadMs}
          min={0}
          max={20}
          unit="ms"
          precision={1}
          isDisabled={!maximizer.enabled}
          onChange={(lookAheadMs) =>
            patch({ maximizer: { ...maximizer, lookAheadMs } })
          }
        />
        <Field
          labelKey="dsp.maximizer.release"
          value={maximizer.releaseMs}
          min={5}
          max={1_000}
          unit="ms"
          isDisabled={!maximizer.enabled}
          onChange={(releaseMs) =>
            patch({ maximizer: { ...maximizer, releaseMs } })
          }
        />
      </Section>
    </div>
  );
};

export default DspPanel;
