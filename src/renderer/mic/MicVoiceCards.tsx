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

import { useEffect, useRef } from 'react';
import { IMicLowCutParts, LOW_CUT_WHEN_ON } from '../../common/micSound';
import {
  IVoiceSettings,
  VOICE_DEFAULTS,
  VOICE_RANGES,
} from '../../common/dsp/voiceStage';
import { Dial, ProcessorCard } from '../dsp/DspControls';
import signedTick from '../graph/signedTick';
import { useTranslation } from '../utils/I18nContext';
import { GATE_HYSTERESIS_DB, toDb } from './MicLiveBar';
import type { IMicLevel } from './useMicLevels';

/** The gate bar's scale: the quietest level it draws, dBFS, up to 0. */
const GATE_FLOOR_DB = -90;

const gateBarAt = (db: number) =>
  `${Math.min(100, Math.max(0, ((db - GATE_FLOOR_DB) / -GATE_FLOOR_DB) * 100))}%`;

interface IMicGateLiveProps {
  thresholdDb: number;
  latest: React.MutableRefObject<IMicLevel | undefined>;
  live: boolean;
}

/**
 * The voice against the gate, live (mockup A): the bar is what reaches the
 * rack now, the line is where the gate opens and the faint line where it
 * closes again, 4 dB under, as `voice.cpp` does. Written straight into the
 * bar once per painted frame, never through React.
 */
const MicGateLive = ({ thresholdDb, latest, live }: IMicGateLiveProps) => {
  const { t } = useTranslation();
  const fill = useRef<HTMLSpanElement>(null);
  const line = useRef<HTMLParagraphElement>(null);
  const translate = useRef(t);
  translate.current = t;

  useEffect(() => {
    let open = false;
    let animation = 0;
    const draw = () => {
      const level = latest.current;
      if (live && level) {
        const input = toDb(level.input);
        open = open
          ? input > thresholdDb - GATE_HYSTERESIS_DB
          : input > thresholdDb;
        if (fill.current) {
          fill.current.style.width = gateBarAt(input);
          fill.current.classList.toggle('is-closed', !open);
        }
        if (line.current) {
          const db = Math.round(Math.abs(input - thresholdDb));
          line.current.textContent = translate.current(
            open ? 'mic.gate.live.open' : 'mic.gate.live.closed',
            { db },
          );
          line.current.classList.toggle('is-open', open);
        }
      }
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, [latest, live, thresholdDb]);

  const closesDb = thresholdDb - GATE_HYSTERESIS_DB;
  return (
    <div className="dsp-band mic-gate-live">
      <div className="dsp-band-head">
        <span className="dsp-band-title">{t('mic.gate.live.title')}</span>
      </div>
      <p className="dsp-band-hint">{t('mic.gate.live.hint')}</p>
      <span className="mic-gate-live__track" aria-hidden="true">
        <span
          className="mic-gate-live__closed"
          style={{ width: gateBarAt(thresholdDb) }}
        />
        <span ref={fill} className="mic-gate-live__fill" />
        <span
          className="mic-gate-live__mark is-closes"
          style={{ left: gateBarAt(closesDb) }}
        />
        <span
          className="mic-gate-live__mark"
          style={{ left: gateBarAt(thresholdDb) }}
        />
      </span>
      <span className="mic-gate-live__scale" aria-hidden="true">
        <span>{signedTick(GATE_FLOOR_DB)} dB</span>
        <span
          className="mic-gate-live__scale-mark"
          style={{ left: gateBarAt(thresholdDb) }}
        >
          {t('mic.gate.live.opens', {
            db: signedTick(Math.round(thresholdDb)),
          })}
        </span>
        <span>0 dB</span>
      </span>
      <p ref={line} className="mic-gate-live__line" role="status" />
    </div>
  );
};

interface IMicVoiceCardProps {
  voice: IVoiceSettings;
  onPatch: (next: IVoiceSettings) => void;
  onCommit: () => void;
}

interface IMicLowCutCardProps extends IMicVoiceCardProps {
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
        latest={latest}
        live={live && on}
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
