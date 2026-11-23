/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The line under the delay: what the rack is doing to the voice right now,
 * and only what moves while you speak - the voice passing the gate, the
 * noise taken, the compressor and the limiter (mockup A). How often the
 * cleaner fell behind is the Noise cancelling card's, not this line's.
 *
 * The readings are written straight into the line once per painted frame,
 * never through React: a re-render per frame of a page this size is the
 * jank the voice picture also avoids.
 *
 * The gate's light compares what reaches the rack with the gate's threshold,
 * with the gate's own 4 dB of hysteresis: the engine reports no gate reading,
 * and the picture above draws the same two things against each other.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from '../utils/I18nContext';
import type { IMicLevel } from './useMicLevels';

/** The gate's own hysteresis (`voice.cpp`), so the light flickers as it does. */
export const GATE_HYSTERESIS_DB = 4;

export const toDb = (amplitude: number) =>
  amplitude > 1e-6 ? 20 * Math.log10(amplitude) : -120;

/**
 * A reduction in dB as the readouts write it: the true minus sign, as the
 * cards' scales beside it have ("−10"), where a hyphen stood lower and
 * shorter, and no sign on a reading that rounds to nothing ("0.0", never
 * "-0.0").
 */
export const reductionText = (db: number, digits = 1) => {
  const shown = Math.abs(db).toFixed(digits);
  return `${db < 0 && Number(shown) > 0 ? '−' : ''}${shown} dB`;
};

interface IMicLiveBarProps {
  latest: React.MutableRefObject<IMicLevel | undefined>;
  /** Whether the engine is answering on this mic. */
  live: boolean;
  /** The gate's threshold, dBFS, while it is on. */
  gateDb: number | undefined;
  /** Whether noise cancelling is on, so what it takes is worth a reading. */
  cleanerOn: boolean;
  /** The compressor's make-up, dB, while it is on. */
  makeupDb: number | undefined;
  limiterOn: boolean;
}

const MicLiveBar = ({
  latest,
  live,
  gateDb,
  cleanerOn,
  makeupDb,
  limiterOn,
}: IMicLiveBarProps) => {
  const { t } = useTranslation();
  const gateLamp = useRef<HTMLSpanElement>(null);
  const gateText = useRef<HTMLSpanElement>(null);
  const noise = useRef<HTMLSpanElement>(null);
  const compressor = useRef<HTMLSpanElement>(null);
  const limiter = useRef<HTMLSpanElement>(null);
  const words = useRef({ open: '', closed: '' });
  words.current = {
    open: t('mic.meter.gateOpen'),
    closed: t('mic.meter.gateClosed'),
  };

  useEffect(() => {
    let animation = 0;
    let open = false;
    const draw = () => {
      const level = latest.current;
      if (level && live) {
        if (gateDb !== undefined) {
          const input = toDb(level.input);
          open = open ? input > gateDb - GATE_HYSTERESIS_DB : input > gateDb;
          gateLamp.current?.classList.toggle('is-open', open);
          if (gateText.current) {
            gateText.current.textContent = open
              ? words.current.open
              : words.current.closed;
          }
        }
        if (noise.current) {
          noise.current.textContent = reductionText(level.noiseTakenDb);
        }
        if (compressor.current && makeupDb !== undefined) {
          const gain = level.compressorGainDb;
          const reduction =
            gain === undefined ? 0 : Math.min(0, gain - makeupDb);
          compressor.current.textContent = reductionText(reduction);
        }
        if (limiter.current) {
          limiter.current.textContent = reductionText(level.limiterDb);
        }
      }
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, [latest, live, gateDb, makeupDb]);

  const idle = live ? '' : ' is-idle';
  return (
    <div className="mic-live" aria-live="off">
      <div className="mic-live__readings">
        {gateDb !== undefined && (
          <span className={`mic-live__reading${idle}`}>
            <span
              ref={gateLamp}
              className="mic-live__lamp"
              aria-hidden="true"
            />
            <span ref={gateText}>{t('mic.meter.gateClosed')}</span>
          </span>
        )}
        {cleanerOn && (
          <span className={`mic-live__reading${idle}`}>
            {t('mic.meter.noise')}
            <span ref={noise} className="mic-live__value">
              0.0 dB
            </span>
          </span>
        )}
        {makeupDb !== undefined && (
          <span className={`mic-live__reading${idle}`}>
            {t('mic.meter.compressor')}
            <span ref={compressor} className="mic-live__value">
              0.0 dB
            </span>
          </span>
        )}
        {limiterOn && (
          <span className={`mic-live__reading${idle}`}>
            {t('mic.meter.limiter')}
            <span ref={limiter} className="mic-live__value">
              0.0 dB
            </span>
          </span>
        )}
      </div>
    </div>
  );
};

export default MicLiveBar;
