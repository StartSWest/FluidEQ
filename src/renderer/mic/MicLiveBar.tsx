/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The strip under the Mic tab's header: what the rack is doing to the voice
 * right now, and "Listen to myself".
 *
 * The readings are written straight into the strip once per painted frame,
 * never through React: a re-render per frame of a page this size is the
 * jank the voice picture also avoids.
 *
 * The gate's light compares what reaches the rack with the gate's threshold,
 * with the gate's own 4 dB of hysteresis: the engine reports no gate reading,
 * and the picture above draws the same two things against each other.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { reportError } from '../utils/logger';
import type { IMicLevel } from './useMicLevels';

/** The gate's own hysteresis (`voice.cpp`), so the light flickers as it does. */
const GATE_HYSTERESIS_DB = 4;

const toDb = (amplitude: number) =>
  amplitude > 1e-6 ? 20 * Math.log10(amplitude) : -120;

interface IMicLiveBarProps {
  latest: React.MutableRefObject<IMicLevel | undefined>;
  /** Whether the engine is answering on this mic. */
  live: boolean;
  /** The gate's threshold, dBFS, while it is on. */
  gateDb: number | undefined;
  /** The compressor's make-up, dB, while it is on. */
  makeupDb: number | undefined;
  limiterOn: boolean;
  /** The tab's own recording of the mic: what every app receives. */
  stream: MediaStream | undefined;
}

const MicLiveBar = ({
  latest,
  live,
  gateDb,
  makeupDb,
  limiterOn,
  stream,
}: IMicLiveBarProps) => {
  const { t } = useTranslation();
  const gateLamp = useRef<HTMLSpanElement>(null);
  const gateText = useRef<HTMLSpanElement>(null);
  const compressor = useRef<HTMLSpanElement>(null);
  const limiter = useRef<HTMLSpanElement>(null);
  const [listening, setListening] = useState(false);
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
        if (compressor.current && makeupDb !== undefined) {
          const gain = level.compressorGainDb;
          const reduction =
            gain === undefined ? 0 : Math.min(0, gain - makeupDb);
          compressor.current.textContent = `${reduction.toFixed(1)} dB`;
        }
        if (limiter.current) {
          limiter.current.textContent = `${level.limiterDb.toFixed(1)} dB`;
        }
      }
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, [latest, live, gateDb, makeupDb]);

  // The processed mic to the output Windows plays through, at the lowest
  // latency the context offers. Closed the moment it is switched off or the
  // stream goes, so it never outlives the page.
  useEffect(() => {
    if (!listening || !stream) {
      return undefined;
    }
    const context = new AudioContext({ latencyHint: 'interactive' });
    context.createMediaStreamSource(stream).connect(context.destination);
    return () => {
      context
        .close()
        .catch((error: unknown) =>
          reportError('closing the mic monitor', error),
        );
    };
  }, [listening, stream]);

  const idle = live ? '' : ' is-idle';
  return (
    <div className="mic-live">
      <div className="mic-live__readings" aria-live="off">
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
      <div className="mic-live__monitor">
        {listening && (
          <span className="mic-live__warning" role="status">
            {t('mic.monitor.warning')}
          </span>
        )}
        <button
          type="button"
          className={listening ? 'button small' : 'button small subtle'}
          aria-pressed={listening}
          disabled={!stream}
          title={t('mic.monitor.hint')}
          onClick={() => setListening((was) => !was)}
        >
          {t('mic.monitor.label')}
        </button>
      </div>
    </div>
  );
};

export default MicLiveBar;
