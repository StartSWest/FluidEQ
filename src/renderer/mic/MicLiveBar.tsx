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
 * The gate's light is the gate's own gain, as the engine reports it (1.32):
 * it used to compare the mic's level with the threshold, and the mic's level
 * still carries the room the cleaner takes away before the gate hears it, so
 * the light called the gate open over a room it was holding down.
 */

import { ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { gateOpenness, GATE_OPEN_AT } from './micGate';
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
  /** The gate's range, dB, while it is on. */
  gateRangeDb: number | undefined;
  /** Whether noise cancelling is on, so what it takes is worth a reading. */
  cleanerOn: boolean;
  /** The compressor's make-up, dB, while it is on. */
  makeupDb: number | undefined;
  limiterOn: boolean;
  /** "Hear the final result", at the strip's end. */
  children?: ReactNode;
}

const MicLiveBar = ({
  latest,
  live,
  gateRangeDb,
  cleanerOn,
  makeupDb,
  limiterOn,
  children,
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
    const draw = () => {
      const level = latest.current;
      if (level && live) {
        if (gateRangeDb !== undefined && level.gateGainDb !== undefined) {
          const open =
            gateOpenness(level.gateGainDb, gateRangeDb) > GATE_OPEN_AT;
          gateLamp.current?.classList.toggle('is-open', open);
          if (gateText.current) {
            gateText.current.textContent = open
              ? words.current.open
              : words.current.closed;
          }
        }
        if (noise.current) {
          const { room } = level;
          noise.current.textContent = room
            ? reductionText(room.afterDb - room.beforeDb)
            : '—';
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
  }, [latest, live, gateRangeDb, makeupDb]);

  const idle = live ? '' : ' is-idle';
  return (
    <div className="mic-live" aria-live="off">
      <div className="mic-live__readings">
        {gateRangeDb !== undefined && (
          <span className={`mic-live__reading${idle}`}>
            <span
              ref={gateLamp}
              className="mic-live__lamp"
              aria-hidden="true"
            />
            {/* A dash until the engine reports its gate (1.32): before that
                nothing here knows whether it is open, and "closed" would be
                a guess printed as a reading. The slot holds the longer of
                the two words, so the readings beside it never move. */}
            <span className="mic-live__state">
              <span ref={gateText}>—</span>
              <span className="mic-live__state-sizer" aria-hidden="true">
                {t('mic.meter.gateOpen')}
              </span>
              <span className="mic-live__state-sizer" aria-hidden="true">
                {t('mic.meter.gateClosed')}
              </span>
            </span>
          </span>
        )}
        {cleanerOn && (
          <span className={`mic-live__reading${idle}`}>
            {t('mic.meter.noise')}
            {/* Unknown, not nothing, until the room has been heard. */}
            <span ref={noise} className="mic-live__value">
              —
            </span>
          </span>
        )}
        {makeupDb !== undefined && (
          <span className={`mic-live__reading${idle}`}>
            {t('mic.meter.compressor')}
            <span ref={compressor} className="mic-live__value">
              —
            </span>
          </span>
        )}
        {limiterOn && (
          <span className={`mic-live__reading${idle}`}>
            {t('mic.meter.limiter')}
            <span ref={limiter} className="mic-live__value">
              —
            </span>
          </span>
        )}
      </div>
      {children}
    </div>
  );
};

export default MicLiveBar;
