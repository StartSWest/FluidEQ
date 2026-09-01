/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DSP_DEFAULTS,
  IBandSettings,
  IDspSettings,
  clampDspSettings,
} from '../../common/dsp/chain';
import { TranslationKey } from '../../common/i18n/en';
import DspBassForgeCard from './DspBassForgeCard';
import DspBassPunchCard from './DspBassPunchCard';
import { Dial, ProcessorCard } from './DspControls';
import DspEqBar from './DspEqBar';
import DspEqCard from './DspEqCard';
import DspCrossfadeCard from './DspCrossfadeCard';
import DspExciterCard from './DspExciterCard';
import DspDimensionCard from './DspDimensionCard';
import DspMasterCard from './DspMasterCard';
import DspMaximizerCard from './DspMaximizerCard';
import DspDenoiseCard, { IDspVoiceModelState } from './DspDenoiseCard';
import DspNormalizerCard from './DspNormalizerCard';
import DspChainPresetBar from './DspChainPresetBar';
import DspSideTabs from './DspSideTabs';
import { TDspSection } from './sections';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import {
  TDspEngineState,
  setDspOutputSafetyEnabled,
  useDspNativeState,
  useDspOutputSafetyEnabled,
  useDspOutputSafetyMeter,
  useDspSampleRate,
  useDspInputAnalysis,
} from './store';
import '../styles/Dsp.scss';
import { masterLoudnessBreakdown } from './inputNormalizer';
import { useNativeMeters } from './useNativeBackend';

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
  /**
   * Native analysis belongs to the surface that draws it.
   *
   * Keeping this beside the player left three FFTs, a scope capture, large
   * host frames and every meter-store write running while the DSP tab was not
   * mounted. This panel is mounted only while its tab is visible, so its
   * lifetime is the exact demand signal the host needs.
   */
  useNativeMeters();
  const {
    normalizer,
    denoise,
    crossfade,
    eq,
    exciter,
    bassForge,
    bassPunch,
    dimension,
    compressor,
    maximizer,
    master,
  } = settings;
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
  const nativeState = useDspNativeState();
  /**
   * Whether anything below this actually reaches the music.
   *
   * The switch is not the only thing that can make the answer no. The native
   * engine is the ONLY engine — `useDspEngine` stands the worklet down
   * unconditionally — so when the host has not started, every control in the
   * rack is a knob wired to nothing. Leaving them live let a user spend an
   * evening voicing a chain that was never in the signal path, with one line of
   * text as the only clue.
   *
   * An enabled preference is not an active rack. The native path now engages
   * only while Library audio is actually playing, so idle controls are dimmed
   * and the global switch reads off instead of claiming silent processing is
   * active.
   */
  const isRackLive = settings.enabled && nativeState === 'engaged';
  const outputSafetyMeter = useDspOutputSafetyMeter();
  const inputAnalysis = useDspInputAnalysis();
  const loudness = masterLoudnessBreakdown(
    master,
    normalizer,
    inputAnalysis.analysis,
  );
  // Which processor has the page. Local state: it is where the user is
  // looking, not part of the chain, and nothing outside this panel needs it.
  const [section, setSection] = useState<TDspSection>('normalizer');

  /**
   * The Voice model's download, which is a fact about the machine.
   *
   * Local rather than in the DSP store because it is not a setting and does
   * not travel to the engine: it is whether a file exists on this disk, and
   * the panel is the only thing that asks.
   */
  const [voiceModel, setVoiceModel] = useState<IDspVoiceModelState>({
    state: 'missing',
    fraction: 0,
  });

  /**
   * The two bridge calls this panel needs, each checked for individually.
   *
   * Not just "is there a bridge": this panel is rendered by tests that have no
   * preload at all AND by ones that supply a partial one, so the object being
   * present says nothing about the method being there. An absent call means
   * the model state is simply unknown, which is what `missing` already says —
   * no separate state, and no throw during a render.
   */
  const readModelState = window.electron?.ipcRenderer?.readDspDenoiseModelState;
  const downloadModel = window.electron?.ipcRenderer?.downloadDspDenoiseModel;

  useEffect(() => {
    if (typeof readModelState !== 'function') {
      return undefined;
    }
    let cancelled = false;
    readModelState()
      .then((present) => {
        if (!cancelled && present) {
          setVoiceModel({ state: 'ready', fraction: 1 });
        }
        return present;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [readModelState]);

  const downloadVoiceModel = useCallback(() => {
    if (typeof downloadModel !== 'function') {
      return;
    }
    setVoiceModel({ state: 'downloading', fraction: 0 });
    downloadModel((received, total) => {
      setVoiceModel({
        state: 'downloading',
        fraction: total > 0 ? received / total : 0,
      });
    })
      .then((ok) => {
        // `ok` is false when the bytes arrived but the engine has not taken
        // them yet — a host that is not running. The file is still on disk, so
        // the state is re-read rather than assumed failed.
        setVoiceModel(
          ok
            ? { state: 'ready', fraction: 1 }
            : { state: 'missing', fraction: 0 },
        );
        return ok;
      })
      .catch(() => setVoiceModel({ state: 'missing', fraction: 0 }));
  }, [downloadModel]);

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
      if (!last.denoise.isolate && !last.eq.isolate && !last.exciter.isolate) {
        return;
      }
      change({
        ...last,
        denoise: { ...last.denoise, isolate: false },
        eq: { ...last.eq, isolate: false },
        exciter: { ...last.exciter, isolate: false },
      });
      commit();
    },
    [],
  );

  /** Every change passes through the shared settings trust boundary. */
  const patch = (next: Partial<IDspSettings>, preservePreset = false) =>
    onChange(
      clampDspSettings({
        ...settings,
        ...next,
        presetId: preservePreset ? settings.presetId : '',
      }),
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
    if (section === 'denoise' && denoise.isolate) {
      patch({ denoise: { ...denoise, isolate: false } });
      clearedIsolate = true;
    } else if (section === 'eq' && eq.isolate) {
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
          <DspChainPresetBar
            settings={settings}
            disabled={nativeState === 'failed'}
            onChange={onChange}
            onCommit={onCommit}
          />
          <div className="dsp-global-power">
            <span
              className={`dsp-global-power-state${isRackLive ? ' is-on' : ''}`}
              aria-hidden="true"
            >
              {isRackLive ? t('dsp.enabled') : t('dsp.bypassed')}
            </span>
            <Switch
              id="dsp-global-toggle"
              isOn={isRackLive}
              isDisabled={nativeState !== 'engaged'}
              handleToggle={() => {
                patch({ enabled: !settings.enabled }, true);
                onCommit();
              }}
              ariaLabel={t('dsp.title')}
            />
          </div>
        </div>
        <p className={`dsp-scope${nativeState === 'idle' ? ' is-idle' : ''}`}>
          {t(nativeState === 'idle' ? 'dsp.idle' : 'dsp.scopeNotice')}
        </p>
        {engineState === 'failed' ? (
          <p className="dsp-unavailable">{t('dsp.unavailable')}</p>
        ) : undefined}
        {/* In the header rather than in the Master card, where it used to be.
            The card is one of eight side-tab sections, so the notice was only
            ever seen by a user who happened to open Master — and a failure the
            listener cannot see is the failure being silent.

            `alert`, not `status`, and red rather than amber, because it is an
            error: every stage is off. It said the EQ, dynamics and limiter
            "still apply" long after `useDspEngine` made the worklet a permanent
            passthrough, so the one line whose whole job is to tell the listener
            what is happening to their music was the last thing still claiming
            there was a fallback.

            Suppressed when the browser audio graph has failed too, because
            then `dsp.unavailable` directly above says the same thing and two
            red paragraphs saying it twice is worse than one saying it once. */}
        {nativeState === 'failed' && engineState !== 'failed' ? (
          <p className="dsp-engine-down" role="alert">
            {t('dsp.engineDown')}
          </p>
        ) : undefined}
      </header>

      <div className="dsp-body">
        <DspSideTabs
          active={section}
          onSelect={selectSection}
          filtersDisabled={!isRackLive}
          enabled={{
            normalizer: normalizer.mode !== 'off',
            denoise: denoise.enabled,
            crossfade: crossfade.enabled,
            eq: eq.enabled,
            exciter: exciter.enabled,
            bassForge: bassForge.enabled,
            bassPunch: bassPunch.enabled,
            dimension: dimension.enabled,
            compressor: compressor.enabled,
            maximizer: maximizer.enabled,
            master: master.enabled,
          }}
        />

        <div
          className={`dsp-stage${
            section !== 'crossfade' && !isRackLive ? ' is-disabled' : ''
          }`}
          inert={section !== 'crossfade' && !isRackLive ? true : undefined}
          aria-disabled={section !== 'crossfade' && !isRackLive}
        >
          {section === 'normalizer' && (
            <DspNormalizerCard
              normalizer={normalizer}
              analysisState={inputAnalysis}
              onPatch={(next) => patch({ normalizer: next })}
              onCommit={onCommit}
            />
          )}

          {section === 'denoise' && (
            <DspDenoiseCard
              denoise={denoise}
              analysisState={inputAnalysis}
              model={voiceModel}
              onDownloadModel={downloadVoiceModel}
              onPatch={(next) => patch({ denoise: next })}
              onCommit={onCommit}
            />
          )}

          {section === 'crossfade' && (
            <DspCrossfadeCard
              crossfade={crossfade}
              // Playback transitions are independent from the selected rack
              // sound, so editing one does not turn the chain label Custom.
              onPatch={(next) => patch({ crossfade: next }, true)}
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

          {section === 'bassForge' && (
            <DspBassForgeCard
              bassForge={bassForge}
              onPatch={(next) => patch({ bassForge: next })}
              onCommit={onCommit}
            />
          )}

          {section === 'bassPunch' && (
            <DspBassPunchCard
              bassPunch={bassPunch}
              onPatch={(next) => patch({ bassPunch: next })}
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

          {section === 'dimension' && (
            <DspDimensionCard
              dimension={dimension}
              onPatch={(next) => patch({ dimension: next })}
              onCommit={onCommit}
            />
          )}

          {section === 'maximizer' && (
            <DspMaximizerCard
              maximizer={maximizer}
              onPatch={(next) => patch({ maximizer: next })}
              onCommit={onCommit}
            />
          )}

          {section === 'master' && (
            <DspMasterCard
              master={master}
              meter={outputSafetyMeter}
              safetyEnabled={outputSafetyEnabled}
              loudness={loudness}
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
