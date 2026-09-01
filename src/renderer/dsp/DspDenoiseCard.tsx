/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DENOISE_HUM_MODES,
  DSP_DEFAULTS,
  IDenoiseSettings,
  TDenoiseHumMode,
  TDenoiseProfileSource,
} from '../../common/dsp/chain';
import { NOISE_HUM_MAX_HARMONICS } from '../../common/dsp/noiseProfile';
import Switch from '../widgets/Switch';
import { useTranslation } from '../utils/I18nContext';
import { Dial, ProcessorCard } from './DspControls';
import DspDenoiseBar from './DspDenoiseBar';
import DspDenoiseGraph from './DspDenoiseGraph';
import {
  IDspInputAnalysisState,
  useDspDenoiseMeter,
  useDspNativeState,
} from './store';

/** What the Voice model's download is doing, as the card needs to show it. */
export interface IDspVoiceModelState {
  state: 'missing' | 'downloading' | 'ready';
  fraction: number;
}

interface IDspDenoiseCardProps {
  denoise: IDenoiseSettings;
  analysisState: IDspInputAnalysisState;
  model: IDspVoiceModelState;
  onDownloadModel: () => void;
  onPatch: (next: IDenoiseSettings) => void;
  onCommit: () => void;
}

const PROFILE_SOURCES: readonly {
  source: TDenoiseProfileSource;
  label: 'dsp.denoise.scanned' | 'dsp.denoise.adaptive';
}[] = [
  { source: 'scanned', label: 'dsp.denoise.scanned' },
  { source: 'adaptive', label: 'dsp.denoise.adaptive' },
];

const HUM_MODE_LABELS = {
  auto: 'dsp.denoise.humAuto',
  fifty: 'dsp.denoise.humFifty',
  sixty: 'dsp.denoise.humSixty',
} as const satisfies Record<TDenoiseHumMode, string>;

const DspDenoiseCard = ({
  denoise,
  analysisState,
  model,
  onDownloadModel,
  onPatch,
  onCommit,
}: IDspDenoiseCardProps) => {
  const { t } = useTranslation();
  const meter = useDspDenoiseMeter();
  const nativeState = useDspNativeState();
  const profile = analysisState.analysis?.noise;

  /**
   * The whole card goes inert when the native engine is not carrying audio.
   *
   * There is no worklet fallback any more — `useDspEngine` stands the worklet
   * down unconditionally — so a failed host means every control here is
   * connected to nothing. `DspPanel` now makes the entire rack inert for the
   * same reason; this stays because it also drives `isEnabled`, and a stage
   * that reports itself enabled while nothing runs is the lie the panel's
   * dimming cannot reach.
   */
  const isBypassedByEngine = nativeState === 'failed';
  const isEnabled = denoise.enabled && !isBypassedByEngine;

  const patch = (next: Partial<IDenoiseSettings>) => {
    onPatch({ ...denoise, ...next, presetId: '' });
  };
  const commitPatch = (next: Partial<IDenoiseSettings>) => {
    patch(next);
    onCommit();
  };

  /**
   * Falling back is a fact about the run, not about the setting — and it is
   * NOT the same fact as a scan being under way.
   *
   * Switching to Scanned on an unmeasured track starts a scan; saying "no scan
   * for this source" while that scan is running describes the moment before
   * the one the user is in, and reads as a refusal rather than as work in
   * progress. The measuring line below says what is actually happening.
   */
  const isScanning = analysisState.status === 'analyzing';
  const isFallingBack =
    denoise.profileSource === 'scanned' && !meter.profileReady && !isScanning;

  const value = (input: number | undefined, unit: string, digits = 1) =>
    input === undefined ? '—' : `${input.toFixed(digits)} ${unit}`;

  /**
   * Three different statements, and they must not collapse into two.
   *
   * "Not measured" and "measured, no hum present" are different facts about
   * the track, and a card that showed a dash for both would make an unscanned
   * file look like a clean one.
   */
  let humReading = '—';
  if (profile !== undefined) {
    humReading =
      profile.humHz > 0
        ? `${profile.humHz.toFixed(1)} Hz`
        : t('dsp.denoise.noHum');
  }

  return (
    <ProcessorCard
      id="dsp-denoise"
      titleKey="dsp.denoise.title"
      descriptionKey="dsp.denoise.description"
      isEnabled={isEnabled}
      onToggle={() => {
        // Isolate is an audition, never part of the processor's saved sound.
        // Leaving it armed under bypass makes the next enable play only the
        // rejected residue, which sounds like the filter has destroyed audio.
        onPatch({ ...denoise, enabled: !denoise.enabled, isolate: false });
        onCommit();
      }}
      toolbar={
        <DspDenoiseBar
          denoise={denoise}
          onChange={onPatch}
          onCommit={onCommit}
        />
      }
      beforePower={
        /* The labelled switch the EQ and the Exciter already use for Isolate.
           It is the same control, doing the same job, in the same place on the
           header row — a button here read as a different kind of thing. */
        <div
          className="dsp-monitor-isolate"
          title={
            denoise.isolate
              ? t('dsp.denoise.isolateOn')
              : t('dsp.denoise.isolateHint')
          }
        >
          <span
            className={`dsp-monitor-isolate-label${
              denoise.isolate ? ' is-on' : ''
            }`}
            aria-hidden="true"
          >
            {t('dsp.denoise.isolate')}
          </span>
          <Switch
            id="dsp-denoise-isolate"
            isOn={denoise.isolate}
            isDisabled={!isEnabled}
            handleToggle={() => {
              onPatch({ ...denoise, isolate: !denoise.isolate });
              onCommit();
            }}
            ariaLabel={t('dsp.denoise.isolate')}
          />
        </div>
      }
    >
      {/* Above the numbers, because it is the reading that makes them mean
          something: a floor and a spectrum in the same units on the same
          axes. "Reducing: -4 dB" is the same number whether the stage is
          taking hiss or taking the vocal. */}
      <DspDenoiseGraph
        profile={profile}
        hum={denoise.hum}
        click={denoise.click}
        isEnabled={isEnabled}
      />

      <section className="dsp-denoise-analysis" aria-live="polite">
        {/* The source mode describes this analysis, so a separate full-width
            card for the same decision spent a complete row without adding a
            second task. Keeping them together removes that dead height. */}
        <div className="dsp-denoise-analysis-head">
          <div className="dsp-denoise-analysis-label">
            <span className="dsp-band-title">{t('dsp.denoise.analysis')}</span>
            <span
              className={`dsp-normalizer-status is-${analysisState.status}`}
            >
              {analysisState.status === 'analyzing'
                ? t('dsp.denoise.analyzing', {
                    progress: Math.round(analysisState.fraction * 100),
                  })
                : undefined}
              {analysisState.status === 'idle' && !profile
                ? t('dsp.denoise.waiting')
                : undefined}
            </span>
          </div>
          <div
            className="segmented"
            role="group"
            aria-label={t('dsp.denoise.profileSource')}
          >
            {PROFILE_SOURCES.map(({ source, label }) => (
              <button
                key={source}
                type="button"
                className={`segmented__option${
                  denoise.profileSource === source ? ' is-selected' : ''
                }`}
                aria-pressed={denoise.profileSource === source}
                disabled={!isEnabled}
                onClick={() => commitPatch({ profileSource: source })}
              >
                {t(label)}
              </button>
            ))}
          </div>
        </div>
        {isEnabled && isFallingBack ? (
          <p className="dsp-band-hint">{t('dsp.denoise.fallingBack')}</p>
        ) : null}
        <div
          className="dsp-normalizer-progress"
          role="progressbar"
          aria-label={t('dsp.denoise.analysis')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(analysisState.fraction * 100)}
        >
          <span style={{ width: `${analysisState.fraction * 100}%` }} />
        </div>
        <dl className="dsp-normalizer-stats">
          <div>
            <dt>{t('dsp.denoise.measuredFloor')}</dt>
            <dd>{value(profile?.floorDbfs, 'dBFS')}</dd>
          </div>
          <div>
            <dt>{t('dsp.denoise.measuredHum')}</dt>
            <dd>{humReading}</dd>
          </div>
          <div>
            <dt>{t('dsp.denoise.measuredClicks')}</dt>
            <dd>
              {profile === undefined
                ? '—'
                : t('dsp.denoise.perMinute', {
                    count: profile.clicksPerMinute.toFixed(1),
                  })}
            </dd>
          </div>
        </dl>
      </section>

      <div className="dsp-denoise-modules">
        <div className="dsp-band dsp-denoise-module is-hiss">
          <div className="dsp-band-head">
            <span className="dsp-band-title">{t('dsp.denoise.hiss')}</span>
            <Switch
              id="dsp-denoise-hiss"
              isOn={denoise.hiss.enabled}
              isDisabled={!isEnabled}
              handleToggle={() =>
                commitPatch({
                  hiss: { ...denoise.hiss, enabled: !denoise.hiss.enabled },
                })
              }
              ariaLabel={t('dsp.denoise.hiss')}
            />
          </div>
          <div className="dsp-band-dials">
            <Dial
              labelKey="dsp.denoise.amount"
              value={denoise.hiss.amount}
              defaultValue={DSP_DEFAULTS.denoise.hiss.amount}
              min={0}
              max={1}
              unit=""
              step={0.01}
              isDisabled={!isEnabled || !denoise.hiss.enabled}
              onCommit={onCommit}
              onChange={(amount) =>
                patch({ hiss: { ...denoise.hiss, amount } })
              }
            />
            <Dial
              labelKey="dsp.denoise.reductionLimit"
              value={denoise.hiss.floorDb}
              defaultValue={DSP_DEFAULTS.denoise.hiss.floorDb}
              min={-40}
              max={-3}
              unit="dB"
              step={1}
              isDisabled={!isEnabled || !denoise.hiss.enabled}
              onCommit={onCommit}
              onChange={(floorDb) =>
                patch({ hiss: { ...denoise.hiss, floorDb } })
              }
            />
            <Dial
              labelKey="dsp.denoise.sensitivity"
              value={denoise.hiss.sensitivityDb}
              defaultValue={DSP_DEFAULTS.denoise.hiss.sensitivityDb}
              min={-6}
              max={12}
              unit="dB"
              step={0.5}
              isDisabled={!isEnabled || !denoise.hiss.enabled}
              onCommit={onCommit}
              onChange={(sensitivityDb) =>
                patch({ hiss: { ...denoise.hiss, sensitivityDb } })
              }
            />
            <Dial
              labelKey="dsp.denoise.smoothing"
              value={denoise.hiss.smoothing}
              defaultValue={DSP_DEFAULTS.denoise.hiss.smoothing}
              min={0}
              max={1}
              unit=""
              step={0.01}
              isDisabled={!isEnabled || !denoise.hiss.enabled}
              onCommit={onCommit}
              onChange={(smoothing) =>
                patch({ hiss: { ...denoise.hiss, smoothing } })
              }
            />
          </div>
          <p className="dsp-band-hint">{t('dsp.denoise.reductionLimitHint')}</p>
        </div>

        <div className="dsp-band dsp-denoise-module is-hum">
          <div className="dsp-band-head">
            <span className="dsp-band-title">{t('dsp.denoise.hum')}</span>
            <Switch
              id="dsp-denoise-hum"
              isOn={denoise.hum.enabled}
              isDisabled={!isEnabled}
              handleToggle={() =>
                commitPatch({
                  hum: { ...denoise.hum, enabled: !denoise.hum.enabled },
                })
              }
              ariaLabel={t('dsp.denoise.hum')}
            />
          </div>
          <div
            className="segmented"
            role="group"
            aria-label={t('dsp.denoise.humFrequency')}
          >
            {DENOISE_HUM_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                className={`segmented__option${
                  denoise.hum.mode === mode ? ' is-selected' : ''
                }`}
                aria-pressed={denoise.hum.mode === mode}
                disabled={!isEnabled || !denoise.hum.enabled}
                onClick={() => commitPatch({ hum: { ...denoise.hum, mode } })}
              >
                {t(HUM_MODE_LABELS[mode])}
              </button>
            ))}
          </div>
          <div className="dsp-band-dials">
            <Dial
              labelKey="dsp.denoise.harmonics"
              value={denoise.hum.harmonics}
              defaultValue={DSP_DEFAULTS.denoise.hum.harmonics}
              min={1}
              max={NOISE_HUM_MAX_HARMONICS}
              unit=""
              step={1}
              isDisabled={!isEnabled || !denoise.hum.enabled}
              onCommit={onCommit}
              onChange={(harmonics) =>
                patch({ hum: { ...denoise.hum, harmonics } })
              }
            />
            <Dial
              labelKey="dsp.denoise.depth"
              value={denoise.hum.depthDb}
              defaultValue={DSP_DEFAULTS.denoise.hum.depthDb}
              min={6}
              max={48}
              unit="dB"
              step={1}
              isDisabled={!isEnabled || !denoise.hum.enabled}
              onCommit={onCommit}
              onChange={(depthDb) =>
                patch({ hum: { ...denoise.hum, depthDb } })
              }
            />
            <Dial
              labelKey="dsp.denoise.width"
              value={denoise.hum.quality}
              defaultValue={DSP_DEFAULTS.denoise.hum.quality}
              min={5}
              max={60}
              unit="Q"
              step={1}
              isDisabled={!isEnabled || !denoise.hum.enabled}
              onCommit={onCommit}
              onChange={(quality) =>
                patch({ hum: { ...denoise.hum, quality } })
              }
            />
          </div>
          {/* Auto measures; with nothing measured it places nothing. Said out
              loud, because a comb that has declined to build itself looks
              exactly like one that is working. */}
          {isEnabled &&
          denoise.hum.enabled &&
          denoise.hum.mode === 'auto' &&
          profile !== undefined &&
          profile.humHz === 0 ? (
            <p className="dsp-band-hint">{t('dsp.denoise.humAutoWaiting')}</p>
          ) : (
            <p className="dsp-band-hint">{t('dsp.denoise.humHint')}</p>
          )}
        </div>

        <div className="dsp-band dsp-denoise-module is-clicks">
          <div className="dsp-band-head">
            <span className="dsp-band-title">{t('dsp.denoise.click')}</span>
            <Switch
              id="dsp-denoise-click"
              isOn={denoise.click.enabled}
              isDisabled={!isEnabled}
              handleToggle={() =>
                commitPatch({
                  click: { ...denoise.click, enabled: !denoise.click.enabled },
                })
              }
              ariaLabel={t('dsp.denoise.click')}
            />
          </div>
          <div className="dsp-band-dials">
            <Dial
              labelKey="dsp.denoise.sensitivity"
              value={denoise.click.sensitivity}
              defaultValue={DSP_DEFAULTS.denoise.click.sensitivity}
              min={0}
              max={1}
              unit=""
              step={0.01}
              isDisabled={!isEnabled || !denoise.click.enabled}
              onCommit={onCommit}
              onChange={(sensitivity) =>
                patch({ click: { ...denoise.click, sensitivity } })
              }
            />
            <Dial
              labelKey="dsp.denoise.maxRepair"
              value={denoise.click.maxRepairSamples}
              defaultValue={DSP_DEFAULTS.denoise.click.maxRepairSamples}
              min={8}
              max={128}
              unit="sp"
              step={1}
              isDisabled={!isEnabled || !denoise.click.enabled}
              onCommit={onCommit}
              onChange={(maxRepairSamples) =>
                patch({ click: { ...denoise.click, maxRepairSamples } })
              }
            />
          </div>
          <p className="dsp-band-hint">{t('dsp.denoise.clickHint')}</p>
        </div>

        <div className="dsp-band dsp-denoise-module is-voice">
          <div className="dsp-band-head">
            <span className="dsp-band-title">{t('dsp.denoise.voice')}</span>
            <Switch
              id="dsp-denoise-voice"
              isOn={denoise.voice.enabled}
              isDisabled={
                !isEnabled ||
                (!meter.voiceModelLoaded && model.state !== 'ready')
              }
              handleToggle={() =>
                commitPatch({
                  voice: { ...denoise.voice, enabled: !denoise.voice.enabled },
                })
              }
              ariaLabel={t('dsp.denoise.voice')}
            />
          </div>
          <div className="dsp-band-dials">
            <Dial
              labelKey="dsp.denoise.amount"
              value={denoise.voice.amount}
              defaultValue={DSP_DEFAULTS.denoise.voice.amount}
              min={0}
              max={1}
              unit=""
              step={0.01}
              isDisabled={
                !isEnabled ||
                !denoise.voice.enabled ||
                (!meter.voiceModelLoaded && model.state !== 'ready')
              }
              onCommit={onCommit}
              onChange={(amount) =>
                patch({ voice: { ...denoise.voice, amount } })
              }
            />
          </div>
          {/* The switch is disabled rather than merely ineffective, because a
              control that turns on and changes nothing is worse than one that
              says why it cannot. */}
          <p className="dsp-band-hint">
            {model.state === 'ready' || meter.voiceModelLoaded
              ? t('dsp.denoise.voiceHint')
              : t('dsp.denoise.voiceModelMissing')}
          </p>
          {model.state !== 'ready' && !meter.voiceModelLoaded ? (
            <div className="dsp-denoise-model">
              <button
                type="button"
                className="button small"
                disabled={!isEnabled || model.state === 'downloading'}
                onClick={onDownloadModel}
              >
                {t('dsp.denoise.voiceDownload')}
              </button>
              {/* Progress from the first second, not after ten megabytes of
                  a button that looks like it did nothing. */}
              {model.state === 'downloading' ? (
                <>
                  <span className="dsp-dev-safety-spec">
                    {t('dsp.denoise.voiceDownloading', {
                      progress: Math.round(model.fraction * 100),
                    })}
                  </span>
                  <div
                    className="dsp-normalizer-progress"
                    role="progressbar"
                    aria-label={t('dsp.denoise.voiceDownload')}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(model.fraction * 100)}
                  >
                    <span style={{ width: `${model.fraction * 100}%` }} />
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* The readings already carry their own three surfaces. A fourth card
          around them added padding and a border but no grouping information. */}
      <dl className="dsp-normalizer-stats dsp-denoise-live" aria-live="polite">
        <div>
          <dt>{t('dsp.denoise.liveReduction')}</dt>
          <dd>{isEnabled ? value(meter.reductionDb, 'dB') : '—'}</dd>
        </div>
        <div>
          <dt>{t('dsp.denoise.clicksRepaired')}</dt>
          <dd>{isEnabled ? meter.clicksRepaired.toFixed(0) : '—'}</dd>
        </div>
        <div>
          <dt>{t('dsp.denoise.voiceUnderruns')}</dt>
          <dd>{isEnabled ? meter.voiceUnderruns.toFixed(0) : '—'}</dd>
        </div>
      </dl>
    </ProcessorCard>
  );
};

export default DspDenoiseCard;
