/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ReactNode, useState } from 'react';
import {
  DSP_DEFAULTS,
  IBandSettings,
  IDspSettings,
  clampDspSettings,
} from '../../common/dsp/chain';
import { DSP_PRESETS } from '../../common/dsp/presets';
import { TranslationKey } from '../../common/i18n/en';
import LabelledKnob from '../components/LabelledKnob';
import DspEqCard from './DspEqCard';
import DspSideTabs from './DspSideTabs';
import { TDspSection } from './sections';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import { TDspEngineState, useDspSampleRate } from './store';
import '../styles/Dsp.scss';

interface IDspPanelProps {
  settings: IDspSettings;
  /** Applied immediately, so a drag is audible while it happens. */
  onChange: (next: IDspSettings) => void;
  /** Called when a knob is released — this is where the value is saved. */
  onCommit: () => void;
  /**
   * What the engine is doing, in three states rather than two.
   *
   * `idle` is not a failure and must not read as one: the engine lives in
   * `LibraryPlayerProvider`, which does not mount until the Library has been
   * opened, so opening this tab first leaves it genuinely unstarted.
   */
  engineState: TDspEngineState;
}

interface IDialProps {
  labelKey: TranslationKey;
  value: number;
  min: number;
  max: number;
  unit: string;
  step: number;
  /** Where Ctrl+click returns this dial to. */
  defaultValue: number;
  isDisabled: boolean;
  onChange: (next: number) => void;
  onCommit: () => void;
}

/**
 * One parameter of the chain, as `LabelledKnob`.
 *
 * A thin wrapper and deliberately so: all it adds is translating the label key
 * and making `defaultValue` required, because every parameter here HAS a
 * factory value in `DSP_DEFAULTS` and a dial in this rack that ignored
 * Ctrl+click would be the odd one out.
 */
const Dial = ({
  labelKey,
  value,
  min,
  max,
  unit,
  step,
  defaultValue,
  isDisabled,
  onChange,
  onCommit,
}: IDialProps) => {
  const { t } = useTranslation();
  return (
    <LabelledKnob
      label={t(labelKey)}
      value={value}
      min={min}
      max={max}
      unit={unit}
      step={step}
      defaultValue={defaultValue}
      isDisabled={isDisabled}
      onChange={onChange}
      onCommit={onCommit}
    />
  );
};

interface IProcessorCardProps {
  titleKey: TranslationKey;
  /** Omitted where the page speaks for itself — the EQ's graph does. */
  descriptionKey?: TranslationKey;
  id: string;
  isEnabled: boolean;
  onToggle: () => void;
  children: ReactNode;
}

const ProcessorCard = ({
  titleKey,
  descriptionKey,
  id,
  isEnabled,
  onToggle,
  children,
}: IProcessorCardProps) => {
  const { t } = useTranslation();
  return (
    <section
      className={`dsp-card${isEnabled ? ' is-active' : ''}`}
      aria-labelledby={`${id}-title`}
    >
      {/* The description on the left, the on/off on the RIGHT.

          The switch used to lead the row, which put the least-used control in
          the position the eye reads first and left the page starting with a
          toggle rather than with what the page is. Reading order now runs
          description → controls → switch, and the switch sits at the end of
          the header where a plugin's bypass button lives.

          The name itself lives on the rail, which is where it is chosen; the
          heading stays for `aria-labelledby` and is visually hidden. */}
      <header className={`dsp-card-header${descriptionKey ? '' : ' is-bare'}`}>
        <div className="dsp-card-titles">
          <h3 className="dsp-card-title is-visually-hidden" id={`${id}-title`}>
            {t(titleKey)}
          </h3>
          {descriptionKey ? (
            <p className="dsp-card-description">{t(descriptionKey)}</p>
          ) : undefined}
        </div>
        {/* The switch says which state it is IN, not what pressing it does.
            A bare toggle with no word beside it leaves the user reading a
            colour, and on a rack where four of these sit behind four pages
            that is a guess every time. */}
        <div className="dsp-card-power">
          <span
            className={`dsp-card-power-label${isEnabled ? ' is-on' : ''}`}
            aria-hidden="true"
          >
            {isEnabled ? t('dsp.enabled') : t('dsp.bypassed')}
          </span>
          <Switch
            id={id}
            isOn={isEnabled}
            isDisabled={false}
            handleToggle={onToggle}
            ariaLabel={t(titleKey)}
          />
        </div>
      </header>
      <div className="dsp-card-body">{children}</div>
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
const DspPanel = ({
  settings,
  onChange,
  onCommit,
  engineState,
}: IDspPanelProps) => {
  const { t } = useTranslation();
  const { eq, exciter, compressor, maximizer } = settings;
  /**
   * The rate the filters will actually run at, from the engine.
   *
   * Not a nominal 48 kHz: the same shelf placed at 16 kHz behaves differently
   * at 44.1 than at 48, and that difference is precisely what a curve drawn
   * from coefficients exists to show. Drawing at a rate the audio is not using
   * would hide the one error the display is for.
   */
  const sampleRate = useDspSampleRate();
  // Which processor has the page. Local state: it is where the user is
  // looking, not part of the chain, and nothing outside this panel needs it.
  const [section, setSection] = useState<TDspSection>('eq');

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
        <div className="dsp-header-line">
          <h2 className="dsp-title">{t('dsp.title')}</h2>
          <div className="dsp-presets">
            <span className="dsp-presets-label">{t('dsp.presets')}</span>
            {DSP_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="button small subtle"
                onClick={() => {
                  onChange(preset.settings);
                  onCommit();
                }}
              >
                {t(preset.labelKey as TranslationKey)}
              </button>
            ))}
          </div>
        </div>
        <p className="dsp-scope">{t('dsp.scopeNotice')}</p>
        {engineState === 'idle' ? (
          <p className="dsp-idle">{t('dsp.idle')}</p>
        ) : undefined}
        {engineState === 'failed' ? (
          <p className="dsp-unavailable">{t('dsp.unavailable')}</p>
        ) : undefined}
      </header>

      <div className="dsp-body">
        <DspSideTabs
          active={section}
          onSelect={setSection}
          enabled={{
            eq: eq.enabled,
            exciter: exciter.enabled,
            compressor: compressor.enabled,
            maximizer: maximizer.enabled,
          }}
        />

        <div className="dsp-stage">
          {section === 'eq' && (
            <ProcessorCard
              id="dsp-eq"
              titleKey="dsp.eq.title"
              isEnabled={eq.enabled}
              onToggle={() => patch({ eq: { ...eq, enabled: !eq.enabled } })}
            >
              <DspEqCard
                eq={eq}
                sampleRate={sampleRate}
                onChange={(next) => patch({ eq: next })}
                onCommit={onCommit}
              />
            </ProcessorCard>
          )}

          {section === 'exciter' && (
            <ProcessorCard
              id="dsp-exciter"
              titleKey="dsp.exciter.title"
              descriptionKey="dsp.exciter.description"
              isEnabled={exciter.enabled}
              onToggle={() =>
                patch({ exciter: { ...exciter, enabled: !exciter.enabled } })
              }
            >
              <Dial
                labelKey="dsp.exciter.crossover"
                value={exciter.crossoverHz}
                defaultValue={DSP_DEFAULTS.exciter.crossoverHz}
                min={1_000}
                max={12_000}
                unit="Hz"
                step={100}
                isDisabled={!exciter.enabled}
                onCommit={onCommit}
                onChange={(crossoverHz) =>
                  patch({ exciter: { ...exciter, crossoverHz } })
                }
              />
              <Dial
                labelKey="dsp.exciter.drive"
                value={exciter.drive}
                defaultValue={DSP_DEFAULTS.exciter.drive}
                min={1}
                max={10}
                unit=""
                step={0.1}
                isDisabled={!exciter.enabled}
                onCommit={onCommit}
                onChange={(drive) => patch({ exciter: { ...exciter, drive } })}
              />
              <Dial
                labelKey="dsp.exciter.mix"
                value={exciter.mix}
                defaultValue={DSP_DEFAULTS.exciter.mix}
                min={0}
                max={1}
                unit=""
                step={0.01}
                isDisabled={!exciter.enabled}
                onCommit={onCommit}
                onChange={(mix) => patch({ exciter: { ...exciter, mix } })}
              />
            </ProcessorCard>
          )}

          {section === 'compressor' && (
            <ProcessorCard
              id="dsp-compressor"
              titleKey="dsp.compressor.title"
              descriptionKey="dsp.compressor.description"
              isEnabled={compressor.enabled}
              onToggle={() =>
                patch({
                  compressor: { ...compressor, enabled: !compressor.enabled },
                })
              }
            >
              <div className="dsp-crossovers">
                <Dial
                  labelKey="dsp.compressor.crossoverLow"
                  value={compressor.crossoverHz[0]}
                  defaultValue={DSP_DEFAULTS.compressor.crossoverHz[0]}
                  min={60}
                  max={600}
                  unit="Hz"
                  step={10}
                  isDisabled={!compressor.enabled}
                  onCommit={onCommit}
                  onChange={(low) =>
                    patch({
                      compressor: {
                        ...compressor,
                        crossoverHz: [low, compressor.crossoverHz[1]],
                      },
                    })
                  }
                />
                <Dial
                  labelKey="dsp.compressor.crossoverHigh"
                  value={compressor.crossoverHz[1]}
                  defaultValue={DSP_DEFAULTS.compressor.crossoverHz[1]}
                  min={1_000}
                  max={10_000}
                  unit="Hz"
                  step={100}
                  isDisabled={!compressor.enabled}
                  onCommit={onCommit}
                  onChange={(high) =>
                    patch({
                      compressor: {
                        ...compressor,
                        crossoverHz: [compressor.crossoverHz[0], high],
                      },
                    })
                  }
                />
              </div>
              {compressor.bands.map((band, index) => (
                <div className="dsp-band" key={bandLabels[index]}>
                  <span className="dsp-band-title">{t(bandLabels[index])}</span>
                  <div className="dsp-band-dials">
                    <Dial
                      labelKey="dsp.compressor.threshold"
                      value={band.thresholdDb}
                      defaultValue={
                        DSP_DEFAULTS.compressor.bands[index].thresholdDb
                      }
                      min={-60}
                      max={0}
                      unit="dB"
                      step={0.5}
                      isDisabled={!compressor.enabled}
                      onCommit={onCommit}
                      onChange={(thresholdDb) =>
                        patchBand(index, { thresholdDb })
                      }
                    />
                    <Dial
                      labelKey="dsp.compressor.ratio"
                      value={band.ratio}
                      defaultValue={DSP_DEFAULTS.compressor.bands[index].ratio}
                      min={1}
                      max={20}
                      unit=":1"
                      step={0.1}
                      isDisabled={!compressor.enabled}
                      onCommit={onCommit}
                      onChange={(ratio) => patchBand(index, { ratio })}
                    />
                    <Dial
                      labelKey="dsp.compressor.attack"
                      value={band.attackMs}
                      defaultValue={
                        DSP_DEFAULTS.compressor.bands[index].attackMs
                      }
                      min={0.1}
                      max={200}
                      unit="ms"
                      step={0.1}
                      isDisabled={!compressor.enabled}
                      onCommit={onCommit}
                      onChange={(attackMs) => patchBand(index, { attackMs })}
                    />
                    <Dial
                      labelKey="dsp.compressor.release"
                      value={band.releaseMs}
                      defaultValue={
                        DSP_DEFAULTS.compressor.bands[index].releaseMs
                      }
                      min={5}
                      max={2_000}
                      unit="ms"
                      step={5}
                      isDisabled={!compressor.enabled}
                      onCommit={onCommit}
                      onChange={(releaseMs) => patchBand(index, { releaseMs })}
                    />
                    <Dial
                      labelKey="dsp.compressor.makeup"
                      value={band.makeupDb}
                      defaultValue={
                        DSP_DEFAULTS.compressor.bands[index].makeupDb
                      }
                      min={0}
                      max={24}
                      unit="dB"
                      step={0.1}
                      isDisabled={!compressor.enabled}
                      onCommit={onCommit}
                      onChange={(makeupDb) => patchBand(index, { makeupDb })}
                    />
                  </div>
                </div>
              ))}
            </ProcessorCard>
          )}

          {section === 'maximizer' && (
            <ProcessorCard
              id="dsp-maximizer"
              titleKey="dsp.maximizer.title"
              descriptionKey="dsp.maximizer.description"
              isEnabled={maximizer.enabled}
              onToggle={() =>
                patch({
                  maximizer: { ...maximizer, enabled: !maximizer.enabled },
                })
              }
            >
              <Dial
                labelKey="dsp.maximizer.ceiling"
                value={maximizer.ceilingDb}
                defaultValue={DSP_DEFAULTS.maximizer.ceilingDb}
                min={-12}
                max={0}
                unit="dB"
                step={0.1}
                isDisabled={!maximizer.enabled}
                onCommit={onCommit}
                onChange={(ceilingDb) =>
                  patch({ maximizer: { ...maximizer, ceilingDb } })
                }
              />
              <Dial
                labelKey="dsp.maximizer.lookAhead"
                value={maximizer.lookAheadMs}
                defaultValue={DSP_DEFAULTS.maximizer.lookAheadMs}
                min={0}
                max={20}
                unit="ms"
                step={0.1}
                isDisabled={!maximizer.enabled}
                onCommit={onCommit}
                onChange={(lookAheadMs) =>
                  patch({ maximizer: { ...maximizer, lookAheadMs } })
                }
              />
              <Dial
                labelKey="dsp.maximizer.release"
                value={maximizer.releaseMs}
                defaultValue={DSP_DEFAULTS.maximizer.releaseMs}
                min={5}
                max={1_000}
                unit="ms"
                step={5}
                isDisabled={!maximizer.enabled}
                onCommit={onCommit}
                onChange={(releaseMs) =>
                  patch({ maximizer: { ...maximizer, releaseMs } })
                }
              />
            </ProcessorCard>
          )}
        </div>
      </div>
    </div>
  );
};

export default DspPanel;
