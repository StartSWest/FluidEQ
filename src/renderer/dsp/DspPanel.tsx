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
import Knob from '../widgets/Knob';
import Switch from '../widgets/Switch';
import { TDspEngineState } from './store';
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
  /** Shown under the number and read out by assistive tech, as on the preamp. */
  unit: string;
  step: number;
  isDisabled: boolean;
  onChange: (next: number) => void;
  onCommit: () => void;
}

/**
 * One parameter, as the round knob the preamp and the band inspector use.
 *
 * The same `Knob` widget, not a copy of it: a rack of dials that behaved even
 * slightly differently from the one already in the sidebar would be a second
 * control to learn for no reason.
 */
const Dial = ({
  labelKey,
  value,
  min,
  max,
  unit,
  step,
  isDisabled,
  onChange,
  onCommit,
}: IDialProps) => {
  const { t } = useTranslation();
  return (
    // The commit rides on the container: `Knob` reports every value as it
    // turns and has no separate release callback to hand out. `pointerup`
    // bubbles from the dial, and `keyup` covers the arrow keys.
    //
    // Not interactive itself — a layout box that happens to be where two
    // events surface — so no role and no tab stop. The knob inside is the
    // control and already has both.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="dsp-dial" onPointerUp={onCommit} onKeyUp={onCommit}>
      <Knob
        name={t(labelKey)}
        value={value}
        min={min}
        max={max}
        step={step}
        unit={unit}
        isDisabled={isDisabled}
        handleChange={async (next: number) => onChange(next)}
      />
      <span className="dsp-dial-label">{t(labelKey)}</span>
    </div>
  );
};

interface IProcessorCardProps {
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
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
      <header className="dsp-card-header">
        <Switch
          id={id}
          isOn={isEnabled}
          isDisabled={false}
          handleToggle={onToggle}
          ariaLabel={t(titleKey)}
        />
        <div className="dsp-card-titles">
          <h3 className="dsp-card-title" id={`${id}-title`}>
            {t(titleKey)}
          </h3>
          <p className="dsp-card-description">{t(descriptionKey)}</p>
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

      <div className="dsp-rack">
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
            min={0}
            max={1}
            unit=""
            step={0.01}
            isDisabled={!exciter.enabled}
            onCommit={onCommit}
            onChange={(mix) => patch({ exciter: { ...exciter, mix } })}
          />
        </ProcessorCard>

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
                  min={-60}
                  max={0}
                  unit="dB"
                  step={0.5}
                  isDisabled={!compressor.enabled}
                  onCommit={onCommit}
                  onChange={(thresholdDb) => patchBand(index, { thresholdDb })}
                />
                <Dial
                  labelKey="dsp.compressor.ratio"
                  value={band.ratio}
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

        <ProcessorCard
          id="dsp-maximizer"
          titleKey="dsp.maximizer.title"
          descriptionKey="dsp.maximizer.description"
          isEnabled={maximizer.enabled}
          onToggle={() =>
            patch({ maximizer: { ...maximizer, enabled: !maximizer.enabled } })
          }
        >
          <Dial
            labelKey="dsp.maximizer.ceiling"
            value={maximizer.ceilingDb}
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
      </div>
    </div>
  );
};

export default DspPanel;
