/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import {
  DSP_DEFAULTS,
  IBandSettings,
  IDspSettings,
  MAXIMIZER_MAX_CEILING_DB,
  MAXIMIZER_MIN_LOOK_AHEAD_MS,
  MAXIMIZER_MIN_RELEASE_MS,
  clampDspSettings,
} from '../../common/dsp/chain';
import { DSP_PRESETS } from '../../common/dsp/presets';
import { TranslationKey } from '../../common/i18n/en';
import { Dial, ProcessorCard } from './DspControls';
import DspEqBar from './DspEqBar';
import DspEqCard from './DspEqCard';
import DspExciterCard from './DspExciterCard';
import DspMasterCard from './DspMasterCard';
import DspNormalizerCard from './DspNormalizerCard';
import { withInputTrim } from './rack';
import DspSideTabs from './DspSideTabs';
import { TDspSection } from './sections';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import {
  TDspEngineState,
  setDspOutputSafetyEnabled,
  useDspOutputSafetyEnabled,
  useDspOutputSafetyMeter,
  useDspSampleRate,
  useDspInputAnalysis,
} from './store';
import '../styles/Dsp.scss';
import { masterLoudnessGainDb } from './inputNormalizer';

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
  const { normalizer, eq, exciter, compressor, maximizer, master } = settings;
  /**
   * The rate the filters will actually run at, from the engine.
   *
   * Not a nominal 48 kHz: the same shelf placed at 16 kHz behaves differently
   * at 44.1 than at 48, and that difference is precisely what a curve drawn
   * from coefficients exists to show. Drawing at a rate the audio is not using
   * would hide the one error the display is for.
   */
  const sampleRate = useDspSampleRate();
  const outputSafetyEnabled = useDspOutputSafetyEnabled();
  const outputSafetyMeter = useDspOutputSafetyMeter();
  const inputAnalysis = useDspInputAnalysis();
  const loudnessGainDb = masterLoudnessGainDb(
    master,
    normalizer,
    inputAnalysis.analysis,
  );
  // Which processor has the page. Local state: it is where the user is
  // looking, not part of the chain, and nothing outside this panel needs it.
  const [section, setSection] = useState<TDspSection>('normalizer');

  /**
   * Isolate is an audition state owned by the page that exposes its switch.
   *
   * Keep the latest external-store snapshot for the panel-unmount cleanup. A
   * user can leave the whole DSP workspace without first changing the local
   * section, and ordinary playback must be restored in that path too.
   */
  const latest = useRef({ settings, onChange, onCommit });
  latest.current = { settings, onChange, onCommit };
  useEffect(
    () => () => {
      const {
        settings: last,
        onChange: change,
        onCommit: commit,
      } = latest.current;
      if (!last.eq.isolate && !last.exciter.isolate) {
        return;
      }
      change({
        ...last,
        eq: { ...last.eq, isolate: false },
        exciter: { ...last.exciter, isolate: false },
      });
      commit();
    },
    [],
  );

  /**
   * Every change to the chain passes the same trust and EQ-headroom boundary.
   *
   * `withInputTrim` intentionally regulates only the EQ curve. Calling it from
   * the shared patch path keeps preset and import changes from bypassing that
   * calculation without making another processor borrow the EQ's preamp.
   */
  const patch = (next: Partial<IDspSettings>) =>
    onChange(
      withInputTrim(clampDspSettings({ ...settings, ...next }), sampleRate),
    );

  const patchBand = (index: number, next: Partial<IBandSettings>) =>
    patch({
      compressor: {
        ...compressor,
        bands: compressor.bands.map((band, at) =>
          at === index ? { ...band, ...next } : band,
        ),
      },
    });

  /** Clear the monitor before its control disappears behind another page. */
  const selectSection = (next: TDspSection) => {
    if (next === section) {
      return;
    }
    let clearedIsolate = false;
    if (section === 'eq' && eq.isolate) {
      patch({ eq: { ...eq, isolate: false } });
      clearedIsolate = true;
    } else if (section === 'exciter' && exciter.isolate) {
      patch({ exciter: { ...exciter, isolate: false } });
      clearedIsolate = true;
    }
    if (clearedIsolate) {
      onCommit();
    }
    setSection(next);
  };

  const bandLabels: TranslationKey[] = [
    'dsp.compressor.band.low',
    'dsp.compressor.band.mid',
    'dsp.compressor.band.high',
  ];

  return (
    <div className="dsp-panel">
      <header className="dsp-header">
        <div className="dsp-header-line">
          <h2 className="dsp-title">
            {t('dsp.title')}
            {engineState === 'running' ? (
              <span className="dsp-title-rate">
                {(sampleRate / 1_000).toFixed(1).replace('.0', '')} kHz
              </span>
            ) : undefined}
          </h2>
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
          onSelect={selectSection}
          enabled={{
            normalizer: normalizer.mode !== 'off',
            eq: eq.enabled,
            exciter: exciter.enabled,
            compressor: compressor.enabled,
            maximizer: maximizer.enabled,
            master: master.enabled,
          }}
        />

        <div className="dsp-stage">
          {section === 'normalizer' && (
            <DspNormalizerCard
              normalizer={normalizer}
              analysisState={inputAnalysis}
              onPatch={(next) => patch({ normalizer: next })}
              onCommit={onCommit}
            />
          )}

          {section === 'eq' && (
            <ProcessorCard
              id="dsp-eq"
              titleKey="dsp.eq.title"
              isEnabled={eq.enabled}
              onToggle={() => {
                patch({
                  eq: { ...eq, enabled: !eq.enabled, isolate: false },
                });
                onCommit();
              }}
              beforePower={
                <div
                  className="dsp-monitor-isolate"
                  title={
                    eq.isolate ? t('dsp.eq.isolateOn') : t('dsp.eq.isolateHint')
                  }
                >
                  <span
                    className={`dsp-monitor-isolate-label${
                      eq.isolate ? ' is-on' : ''
                    }`}
                    aria-hidden="true"
                  >
                    {t('dsp.eq.isolate')}
                  </span>
                  <Switch
                    id="dsp-eq-isolate"
                    isOn={eq.isolate}
                    isDisabled={!eq.enabled}
                    handleToggle={() => {
                      patch({ eq: { ...eq, isolate: !eq.isolate } });
                      onCommit();
                    }}
                    ariaLabel={t('dsp.eq.isolate')}
                  />
                </div>
              }
              toolbar={
                <DspEqBar
                  eq={eq}
                  sampleRate={sampleRate}
                  onChange={(next) => patch({ eq: next })}
                  onCommit={onCommit}
                />
              }
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
            <DspExciterCard
              exciter={exciter}
              onPatch={(next) => patch({ exciter: next })}
              onCommit={onCommit}
            />
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
                max={MAXIMIZER_MAX_CEILING_DB}
                unit="dBTP"
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
                min={MAXIMIZER_MIN_LOOK_AHEAD_MS}
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
                min={MAXIMIZER_MIN_RELEASE_MS}
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

          {section === 'master' && (
            <DspMasterCard
              master={master}
              meter={outputSafetyMeter}
              safetyEnabled={outputSafetyEnabled}
              loudnessGainDb={loudnessGainDb}
              onSafetyToggle={() =>
                setDspOutputSafetyEnabled(!outputSafetyEnabled)
              }
              onPatch={(next) => patch({ master: next })}
              onCommit={onCommit}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DspPanel;
