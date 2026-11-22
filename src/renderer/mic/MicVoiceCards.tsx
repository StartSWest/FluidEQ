/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Voice stage's two cards, in the DSP page's own frame and dials: the
 * low cut with "Close to the mic" and the pop guard, ahead of the cleaner,
 * and the gate behind it. Both halves are one stage on the wire
 * (`voiceStage.ts`); each card switches its own half.
 */

import type { IDenoiseSettings } from '../../common/dsp/chain';
import {
  IVoiceSettings,
  VOICE_DEFAULTS,
  VOICE_RANGES,
} from '../../common/dsp/voiceStage';
import { Dial, ProcessorCard } from '../dsp/DspControls';
import useVoiceModel from '../dsp/useVoiceModel';
import { useTranslation } from '../utils/I18nContext';

interface IMicCleanerCardProps {
  denoise: IDenoiseSettings;
  onPatch: (next: IDenoiseSettings) => void;
  onCommit: () => void;
}

/**
 * The voice cleaner alone, for a mic: the neural module of the rack's
 * Denoise, which the engine runs on live audio from the model in its folder.
 * Not the DSP page's Denoise card, which calls the module Library-only while
 * the rack runs system-wide — true of music, where the cleaner is wrong
 * anyway, and not of a voice. Hiss, hum and clicks stay off: they are for
 * recordings, and on a live voice the cleaner already takes the room.
 */
export const MicCleanerCard = ({
  denoise,
  onPatch,
  onCommit,
}: IMicCleanerCardProps) => {
  const { t } = useTranslation();
  const { model, download, cancel } = useVoiceModel();
  const on = denoise.enabled && denoise.voice.enabled;
  const missing = model.state !== 'ready';
  return (
    <ProcessorCard
      id="mic-cleaner"
      titleKey="mic.stage.cleaner"
      descriptionKey="dsp.denoise.voiceHint"
      isEnabled={on}
      onToggle={() => {
        onPatch({
          ...denoise,
          enabled: !on,
          presetId: '',
          hiss: { ...denoise.hiss, enabled: false },
          voice: { ...denoise.voice, enabled: !on },
        });
        onCommit();
      }}
    >
      <div className="dsp-band">
        <div className="dsp-band-dials">
          <Dial
            labelKey="dsp.denoise.amount"
            value={denoise.voice.amount}
            defaultValue={1}
            min={0}
            max={1}
            unit=""
            step={0.01}
            isDisabled={!on}
            onChange={(amount) =>
              onPatch({
                ...denoise,
                presetId: '',
                voice: { ...denoise.voice, amount },
              })
            }
            onCommit={onCommit}
          />
        </div>
        {missing && (
          <>
            <p className="dsp-band-hint">
              {t('dsp.denoise.voiceModelMissing')}
            </p>
            <div className="dsp-denoise-model">
              <button
                type="button"
                className="button small"
                disabled={model.state === 'downloading'}
                onClick={download}
              >
                {t('dsp.denoise.voiceDownload')}
              </button>
              {model.state === 'downloading' && (
                <>
                  <span className="dsp-band-spec">
                    {t('dsp.denoise.voiceDownloading', {
                      progress: Math.round(model.fraction * 100),
                    })}
                  </span>
                  <button
                    type="button"
                    className="button small subtle"
                    onClick={cancel}
                  >
                    {t('dsp.denoise.voiceCancel')}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </ProcessorCard>
  );
};

interface IMicVoiceCardProps {
  voice: IVoiceSettings;
  onPatch: (next: IVoiceSettings) => void;
  onCommit: () => void;
}

/** The low cut is "on" while it cuts; switched off it remembers its corner. */
const LOW_CUT_WHEN_ON = 80;

export const MicLowCutCard = ({
  voice,
  onPatch,
  onCommit,
}: IMicVoiceCardProps) => {
  const { t } = useTranslation();
  const on = voice.enabled && voice.lowCutHz > 0;
  const patch = (next: Partial<IVoiceSettings>) =>
    onPatch({ ...voice, enabled: true, ...next });
  return (
    <ProcessorCard
      id="mic-low-cut"
      titleKey="mic.lowCut.title"
      descriptionKey="mic.lowCut.description"
      isEnabled={on}
      onToggle={() => {
        patch({ lowCutHz: on ? 0 : LOW_CUT_WHEN_ON });
        onCommit();
      }}
    >
      <div className="dsp-band">
        <div className="dsp-band-head">
          <span className="dsp-band-title">{t('mic.lowCut.group.below')}</span>
        </div>
        <p className="dsp-band-hint">{t('mic.lowCut.group.belowHint')}</p>
        <div className="dsp-band-dials">
          <Dial
            labelKey="mic.lowCut.cut"
            value={on ? voice.lowCutHz : LOW_CUT_WHEN_ON}
            defaultValue={LOW_CUT_WHEN_ON}
            min={VOICE_RANGES.lowCutHz.min}
            max={VOICE_RANGES.lowCutHz.max}
            unit="Hz"
            step={1}
            isDisabled={!on}
            onChange={(lowCutHz) => patch({ lowCutHz })}
            onCommit={onCommit}
          />
          <Dial
            labelKey="mic.lowCut.proximity"
            value={voice.proximityDb}
            defaultValue={VOICE_DEFAULTS.proximityDb}
            min={VOICE_RANGES.proximityDb.min}
            max={VOICE_RANGES.proximityDb.max}
            unit="dB"
            step={0.5}
            isDisabled={!voice.enabled}
            onChange={(proximityDb) => patch({ proximityDb })}
            onCommit={onCommit}
          />
        </div>
      </div>
      <div className="dsp-band">
        <div className="dsp-band-head">
          <span className="dsp-band-title">{t('mic.lowCut.group.pops')}</span>
        </div>
        <p className="dsp-band-hint">{t('mic.lowCut.group.popsHint')}</p>
        <div className="dsp-band-dials">
          <Dial
            labelKey="mic.lowCut.plosive"
            value={Math.round(voice.deplosive * 100)}
            defaultValue={0}
            min={0}
            max={100}
            unit="%"
            step={1}
            isDisabled={!voice.enabled}
            onChange={(percent) => patch({ deplosive: percent / 100 })}
            onCommit={onCommit}
          />
        </div>
      </div>
    </ProcessorCard>
  );
};

export const MicGateCard = ({
  voice,
  onPatch,
  onCommit,
}: IMicVoiceCardProps) => {
  const { t } = useTranslation();
  const on = voice.enabled && voice.gateEnabled;
  const patch = (next: Partial<IVoiceSettings>) =>
    onPatch({ ...voice, enabled: true, ...next });
  const r = VOICE_RANGES;
  return (
    <ProcessorCard
      id="mic-gate"
      titleKey="mic.gate.title"
      descriptionKey="mic.gate.description"
      isEnabled={on}
      onToggle={() => {
        patch({ gateEnabled: !on });
        onCommit();
      }}
    >
      <div className="dsp-band">
        <div className="dsp-band-head">
          <span className="dsp-band-title">{t('mic.gate.group.level')}</span>
        </div>
        <p className="dsp-band-hint">{t('mic.gate.group.levelHint')}</p>
        <div className="dsp-band-dials">
          <Dial
            labelKey="mic.gate.threshold"
            value={voice.gateThresholdDb}
            defaultValue={VOICE_DEFAULTS.gateThresholdDb}
            min={r.gateThresholdDb.min}
            max={r.gateThresholdDb.max}
            unit="dB"
            step={1}
            isDisabled={!on}
            onChange={(gateThresholdDb) => patch({ gateThresholdDb })}
            onCommit={onCommit}
          />
          <Dial
            labelKey="mic.gate.range"
            value={voice.gateRangeDb}
            defaultValue={VOICE_DEFAULTS.gateRangeDb}
            min={r.gateRangeDb.min}
            max={r.gateRangeDb.max}
            unit="dB"
            step={1}
            isDisabled={!on}
            onChange={(gateRangeDb) => patch({ gateRangeDb })}
            onCommit={onCommit}
          />
        </div>
      </div>
      <div className="dsp-band">
        <div className="dsp-band-head">
          <span className="dsp-band-title">{t('mic.gate.group.time')}</span>
        </div>
        <p className="dsp-band-hint">{t('mic.gate.group.timeHint')}</p>
        <div className="dsp-band-dials">
          <Dial
            labelKey="mic.gate.attack"
            value={voice.gateAttackMs}
            defaultValue={VOICE_DEFAULTS.gateAttackMs}
            min={r.gateAttackMs.min}
            max={r.gateAttackMs.max}
            unit="ms"
            step={0.1}
            isDisabled={!on}
            onChange={(gateAttackMs) => patch({ gateAttackMs })}
            onCommit={onCommit}
          />
          <Dial
            labelKey="mic.gate.hold"
            value={voice.gateHoldMs}
            defaultValue={VOICE_DEFAULTS.gateHoldMs}
            min={r.gateHoldMs.min}
            max={r.gateHoldMs.max}
            unit="ms"
            step={10}
            isDisabled={!on}
            onChange={(gateHoldMs) => patch({ gateHoldMs })}
            onCommit={onCommit}
          />
          <Dial
            labelKey="mic.gate.release"
            value={voice.gateReleaseMs}
            defaultValue={VOICE_DEFAULTS.gateReleaseMs}
            min={r.gateReleaseMs.min}
            max={r.gateReleaseMs.max}
            unit="ms"
            step={5}
            isDisabled={!on}
            onChange={(gateReleaseMs) => patch({ gateReleaseMs })}
            onCommit={onCommit}
          />
        </div>
      </div>
    </ProcessorCard>
  );
};
