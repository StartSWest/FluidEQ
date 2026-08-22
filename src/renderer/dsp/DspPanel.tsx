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
import Slider from '../components/Slider';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import { TDspEngineState } from './store';
import '../styles/Dsp.scss';

/**
 * How tall a fader is here.
 *
 * Shorter than the equaliser's 150px on purpose: the compressor alone carries
 * seventeen of them, and at full height one processor would fill the panel and
 * push the other two off the page. 108px still gives the thumb enough travel
 * to be aimed at.
 */
const FADER_HEIGHT = '108px';

interface IDspPanelProps {
  settings: IDspSettings;
  /** Applied immediately, so a drag is audible while it happens. */
  onChange: (next: IDspSettings) => void;
  /** Called when a fader is released — this is where the value is saved. */
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

interface IFaderProps {
  labelKey: TranslationKey;
  value: number;
  min: number;
  max: number;
  unit?: string;
  isDisabled: boolean;
  onChange: (next: number) => void;
  onCommit: () => void;
}

/**
 * One parameter, as the vertical fader the equaliser's bands already use.
 *
 * `Slider` owns the thumb while a drag is in flight and only reports the
 * settled value on release, which is exactly the split this panel needs:
 * `handleChange` colours the sound, `handleMouseUp` writes it down.
 */
const Fader = ({
  labelKey,
  value,
  min,
  max,
  unit,
  isDisabled,
  onChange,
  onCommit,
}: IFaderProps) => {
  const { t } = useTranslation();
  return (
    // The commit rides on the container rather than going into `Slider`, which
    // has no release callback of its own to hand out. `pointerup` bubbles from
    // the thumb, and the input captures the pointer, so this arrives even when
    // the drag ends outside the column. `keyup` covers the arrow keys.
    //
    // Not interactive itself — it is a layout box that happens to be where two
    // events surface — so no role and no tab stop; the fader inside is the
    // control, and it already has both.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="dsp-fader" onPointerUp={onCommit} onKeyUp={onCommit}>
      <Slider
        name={t(labelKey)}
        value={value}
        min={min}
        max={max}
        sliderHeight={FADER_HEIGHT}
        isDisabled={isDisabled}
        showNumberInput
        setValue={async (next: number) => onChange(next)}
      />
      <span className="dsp-fader-label">
        {t(labelKey)}
        {unit ? <span className="dsp-fader-unit">{unit}</span> : undefined}
      </span>
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
          <Fader
            labelKey="dsp.exciter.crossover"
            value={exciter.crossoverHz}
            min={1_000}
            max={12_000}
            unit="Hz"
            isDisabled={!exciter.enabled}
            onCommit={onCommit}
            onChange={(crossoverHz) =>
              patch({ exciter: { ...exciter, crossoverHz } })
            }
          />
          <Fader
            labelKey="dsp.exciter.drive"
            value={exciter.drive}
            min={1}
            max={10}
            isDisabled={!exciter.enabled}
            onCommit={onCommit}
            onChange={(drive) => patch({ exciter: { ...exciter, drive } })}
          />
          <Fader
            labelKey="dsp.exciter.mix"
            value={exciter.mix}
            min={0}
            max={1}
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
            <Fader
              labelKey="dsp.compressor.crossoverLow"
              value={compressor.crossoverHz[0]}
              min={60}
              max={600}
              unit="Hz"
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
            <Fader
              labelKey="dsp.compressor.crossoverHigh"
              value={compressor.crossoverHz[1]}
              min={1_000}
              max={10_000}
              unit="Hz"
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
              <div className="dsp-band-faders">
                <Fader
                  labelKey="dsp.compressor.threshold"
                  value={band.thresholdDb}
                  min={-60}
                  max={0}
                  unit="dB"
                  isDisabled={!compressor.enabled}
                  onCommit={onCommit}
                  onChange={(thresholdDb) => patchBand(index, { thresholdDb })}
                />
                <Fader
                  labelKey="dsp.compressor.ratio"
                  value={band.ratio}
                  min={1}
                  max={20}
                  isDisabled={!compressor.enabled}
                  onCommit={onCommit}
                  onChange={(ratio) => patchBand(index, { ratio })}
                />
                <Fader
                  labelKey="dsp.compressor.attack"
                  value={band.attackMs}
                  min={0.1}
                  max={200}
                  unit="ms"
                  isDisabled={!compressor.enabled}
                  onCommit={onCommit}
                  onChange={(attackMs) => patchBand(index, { attackMs })}
                />
                <Fader
                  labelKey="dsp.compressor.release"
                  value={band.releaseMs}
                  min={5}
                  max={2_000}
                  unit="ms"
                  isDisabled={!compressor.enabled}
                  onCommit={onCommit}
                  onChange={(releaseMs) => patchBand(index, { releaseMs })}
                />
                <Fader
                  labelKey="dsp.compressor.makeup"
                  value={band.makeupDb}
                  min={0}
                  max={24}
                  unit="dB"
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
          <Fader
            labelKey="dsp.maximizer.ceiling"
            value={maximizer.ceilingDb}
            min={-12}
            max={0}
            unit="dB"
            isDisabled={!maximizer.enabled}
            onCommit={onCommit}
            onChange={(ceilingDb) =>
              patch({ maximizer: { ...maximizer, ceilingDb } })
            }
          />
          <Fader
            labelKey="dsp.maximizer.lookAhead"
            value={maximizer.lookAheadMs}
            min={0}
            max={20}
            unit="ms"
            isDisabled={!maximizer.enabled}
            onCommit={onCommit}
            onChange={(lookAheadMs) =>
              patch({ maximizer: { ...maximizer, lookAheadMs } })
            }
          />
          <Fader
            labelKey="dsp.maximizer.release"
            value={maximizer.releaseMs}
            min={5}
            max={1_000}
            unit="ms"
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
