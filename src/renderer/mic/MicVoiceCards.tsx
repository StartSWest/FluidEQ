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

import { IMicLowCutParts, LOW_CUT_WHEN_ON } from '../../common/micSound';
import {
  IVoiceSettings,
  VOICE_DEFAULTS,
  VOICE_RANGES,
} from '../../common/dsp/voiceStage';
import { Dial, ProcessorCard } from '../dsp/DspControls';
import { useTranslation } from '../utils/I18nContext';
import MicGateLive from './MicGateLive';
import MicLowCutLive from './MicLowCutLive';
import type { IMicLevel } from './useMicLevels';

interface IMicVoiceCardProps {
  voice: IVoiceSettings;
  onPatch: (next: IVoiceSettings) => void;
  onCommit: () => void;
}

interface IMicLowCutCardProps extends IMicVoiceCardProps {
  /** The engine answering on this mic, for the picture. */
  live: boolean;
  /** The three parts as the switch turned them off, shown greyed while off. */
  kept: IMicLowCutParts | undefined;
  /** The card's switch: all three parts off together, or back as they were. */
  onSwitch: (on: boolean) => void;
}

/**
 * The low cut, "Close to the mic" and the pop guard, under one switch: it
 * used to zero the corner alone and leave the other two running, with the
 * rail's lamp still lit over a card that read "off" (2026-11-22).
 */
export const MicLowCutCard = ({
  voice,
  kept,
  onPatch,
  onCommit,
  onSwitch,
  live,
}: IMicLowCutCardProps) => {
  const { t } = useTranslation();
  const on =
    voice.enabled &&
    (voice.lowCutHz > 0 || voice.proximityDb > 0 || voice.deplosive > 0);
  const shown: IMicLowCutParts = on
    ? voice
    : (kept ?? {
        lowCutHz: LOW_CUT_WHEN_ON,
        proximityDb: 0,
        deplosive: 0,
      });
  const patch = (next: Partial<IVoiceSettings>) =>
    onPatch({ ...voice, enabled: true, ...next });
  return (
    <ProcessorCard
      id="mic-low-cut"
      titleKey="mic.lowCut.title"
      descriptionKey="mic.lowCut.description"
      isEnabled={on}
      onToggle={() => onSwitch(!on)}
    >
      <MicLowCutLive
        voice={voice}
        on={on}
        live={live}
        onCut={(lowCutHz) => patch({ lowCutHz })}
        onCommit={onCommit}
      />
      <div className="dsp-band">
        <div className="dsp-band-head">
          <span className="dsp-band-title">{t('mic.lowCut.group.below')}</span>
        </div>
        <p className="dsp-band-hint">{t('mic.lowCut.group.belowHint')}</p>
        <div className="dsp-band-dials">
          <Dial
            labelKey="mic.lowCut.cut"
            value={shown.lowCutHz > 0 ? shown.lowCutHz : LOW_CUT_WHEN_ON}
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
            value={shown.proximityDb}
            defaultValue={VOICE_DEFAULTS.proximityDb}
            min={VOICE_RANGES.proximityDb.min}
            max={VOICE_RANGES.proximityDb.max}
            unit="dB"
            step={0.5}
            isDisabled={!on}
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
            value={Math.round(shown.deplosive * 100)}
            defaultValue={0}
            min={0}
            max={100}
            unit="%"
            step={1}
            isDisabled={!on}
            onChange={(percent) => patch({ deplosive: percent / 100 })}
            onCommit={onCommit}
          />
        </div>
      </div>
    </ProcessorCard>
  );
};

interface IMicGateCardProps extends IMicVoiceCardProps {
  latest: React.MutableRefObject<IMicLevel | undefined>;
  live: boolean;
}

export const MicGateCard = ({
  voice,
  onPatch,
  onCommit,
  latest,
  live,
}: IMicGateCardProps) => {
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
      <MicGateLive
        thresholdDb={voice.gateThresholdDb}
        rangeDb={voice.gateRangeDb}
        latest={latest}
        live={live && on}
        isDisabled={!on}
        onThreshold={(gateThresholdDb) => patch({ gateThresholdDb })}
        onCommit={onCommit}
      />
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
