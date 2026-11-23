/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Noise cancelling, for a mic: the neural module of the rack's Denoise, which
 * the engine runs on live audio from the model in its folder. Mockup A's
 * card (Ivan's pick, 2026-11-23): the Strength beside what it is taking now,
 * and the late blocks counted where they can be checked.
 *
 * Not the DSP page's Denoise card, which calls the module Library-only while
 * the rack runs system-wide - true of music, where the cleaner is wrong
 * anyway, and not of a voice. Hiss, hum and clicks stay off: they are for
 * recordings, and on a live voice the cleaner already takes the room.
 *
 * Mockup A also drew a speed choice (one hop of headroom or two). It is not
 * here: measured on Ivan's machine with every core busy, one hop missed 2
 * blocks in 30 s once the worker ran in Windows' audio class and a missed
 * block stopped playing the raw room (never_cuts bench, 2026-11-23), so a
 * second hop would add 10 ms of delay for nothing a listener can hear.
 */

import { useEffect, useRef } from 'react';
import type { IDenoiseSettings, IDspSettings } from '../../common/dsp/chain';
import { Dial, ProcessorCard } from '../dsp/DspControls';
import useVoiceModel from '../dsp/useVoiceModel';
import { useTranslation } from '../utils/I18nContext';
import { reductionText } from './MicLiveBar';
import micStageSwitch from './micStageSwitch';
import type { IMicLevel } from './useMicLevels';

/** How many seconds the late-block strip keeps, one bar each. */
const LATE_SECONDS = 60;
/** The noise meter's scale: what the cleaner takes, 0 to this many dB. */
const NOISE_SCALE_DB = 30;

interface IMicCleanerCardProps {
  settings: IDspSettings;
  onPatch: (next: Partial<IDspSettings>) => void;
  onCommit: () => void;
  latest: React.MutableRefObject<IMicLevel | undefined>;
  live: boolean;
}

const MicCleanerCard = ({
  settings,
  onPatch,
  onCommit,
  latest,
  live,
}: IMicCleanerCardProps) => {
  const { t } = useTranslation();
  const { model, download, cancel } = useVoiceModel();
  const { denoise } = settings;
  const on = denoise.enabled && denoise.voice.enabled;
  const missing = model.state !== 'ready';
  const noiseFill = useRef<HTMLSpanElement>(null);
  const noisePeak = useRef<HTMLSpanElement>(null);
  const noiseValue = useRef<HTMLSpanElement>(null);
  const lateCount = useRef<HTMLSpanElement>(null);
  const lateStrip = useRef<HTMLSpanElement>(null);

  // Written straight into the card once per painted frame, never through
  // React. Late blocks are counted per second from each new reading (a
  // reading seen on two frames is counted once), the strip the last minute.
  useEffect(() => {
    const seconds: number[] = Array.from({ length: LATE_SECONDS }, () => 0);
    let second = Math.floor(performance.now() / 1000);
    let seen: IMicLevel | undefined;
    let peakDb = 0;
    let animation = 0;
    const draw = () => {
      const now = Math.floor(performance.now() / 1000);
      while (second < now) {
        second += 1;
        seconds.shift();
        seconds.push(0);
        peakDb *= 0.85;
      }
      const level = latest.current;
      if (live && level && level !== seen) {
        seen = level;
        seconds[LATE_SECONDS - 1] += level.late;
        const taken = Math.min(NOISE_SCALE_DB, -level.noiseTakenDb);
        peakDb = Math.max(peakDb, taken);
        if (noiseFill.current) {
          noiseFill.current.style.transform = `scaleX(${taken / NOISE_SCALE_DB})`;
        }
        if (noisePeak.current) {
          noisePeak.current.style.left = `${(peakDb / NOISE_SCALE_DB) * 100}%`;
        }
        if (noiseValue.current) {
          noiseValue.current.textContent = reductionText(-taken, 0);
        }
      }
      if (lateCount.current) {
        lateCount.current.textContent = String(
          seconds.reduce((sum, value) => sum + value, 0),
        );
      }
      if (lateStrip.current) {
        Array.from(lateStrip.current.children).forEach((bar, index) => {
          (bar as HTMLElement).classList.toggle('is-late', seconds[index] > 0);
        });
      }
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, [latest, live]);

  const patchDenoise = (next: Partial<IDenoiseSettings>) =>
    onPatch({ denoise: { ...denoise, presetId: '', ...next } });

  return (
    <ProcessorCard
      id="mic-cleaner"
      titleKey="mic.stage.cleaner"
      descriptionKey="mic.cleaner.description"
      isEnabled={on}
      onToggle={() => {
        onPatch(micStageSwitch('denoise', settings));
        onCommit();
      }}
    >
      <div className="dsp-band mic-cleaner__band">
        <div className="mic-cleaner__row">
          <Dial
            labelKey="mic.cleaner.strength"
            value={denoise.voice.amount * 100}
            defaultValue={100}
            min={0}
            max={100}
            unit="%"
            step={1}
            isDisabled={!on}
            onChange={(percent) =>
              patchDenoise({
                voice: { ...denoise.voice, amount: percent / 100 },
              })
            }
            onCommit={onCommit}
          />
          <div className="mic-cleaner__noise">
            <div className="mic-cleaner__noise-head">
              <span>{t('mic.cleaner.noiseNow')}</span>
              <span ref={noiseValue} className="mic-cleaner__noise-value">
                0 dB
              </span>
            </div>
            <span className="mic-cleaner__noise-track" aria-hidden="true">
              <span ref={noiseFill} className="mic-cleaner__noise-fill" />
              <span ref={noisePeak} className="mic-cleaner__noise-peak" />
            </span>
            <span className="mic-cleaner__noise-scale" aria-hidden="true">
              <span>0</span>
              <span>−10</span>
              <span>−20</span>
              <span>−30 dB</span>
            </span>
            <p className="dsp-band-hint">{t('mic.cleaner.noiseHint')}</p>
          </div>
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
      <div className="dsp-band mic-cleaner__band mic-cleaner__late">
        <div className="mic-cleaner__late-text">
          <div className="dsp-band-head">
            <span className="dsp-band-title">{t('mic.cleaner.neverCuts')}</span>
          </div>
          <p className="dsp-band-hint">{t('mic.cleaner.neverCutsHint')}</p>
        </div>
        <div className="mic-cleaner__late-figures">
          <p className="mic-cleaner__late-count">
            <span ref={lateCount}>0</span>
            <span className="mic-cleaner__late-unit">
              {t('mic.cleaner.lateMinute')}
            </span>
          </p>
          <span
            ref={lateStrip}
            className="mic-cleaner__strip"
            aria-hidden="true"
          >
            {Array.from({ length: LATE_SECONDS }, (_, index) => (
              <span key={index} />
            ))}
          </span>
        </div>
      </div>
    </ProcessorCard>
  );
};

export default MicCleanerCard;
