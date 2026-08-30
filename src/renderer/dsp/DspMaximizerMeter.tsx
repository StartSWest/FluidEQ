/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { readDspMaximizerReduction } from './store';

/**
 * What the Maximizer is holding down, which is the reading it never had.
 *
 * Drive, ceiling and release are all settings about the same thing — how much
 * reduction the limiter is producing — and the stage shipped all three with no
 * way to see any of it. A limiter doing nothing and a limiter flattening the
 * record look identical from the front panel, and sound identical for the first
 * few seconds of listening.
 *
 * Read on an animation frame from a plain module variable rather than through
 * React state. The value changes every audio block; a state update per block is
 * a repaint at a rate the display cannot show and the reconciler cannot afford.
 */
const FULL_SCALE_DB = 12;

/** Decay toward rest, so a short reduction stays visible long enough to read. */
const RELEASE_PER_FRAME = 0.82;

interface IDspMaximizerMeterProps {
  isEnabled: boolean;
}

const DspMaximizerMeter = ({ isEnabled }: IDspMaximizerMeterProps) => {
  const { t } = useTranslation();
  const barRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef<HTMLSpanElement | null>(null);
  const heldRef = useRef(0);

  useEffect(() => {
    if (!isEnabled) {
      heldRef.current = 0;
      if (barRef.current) {
        barRef.current.style.width = '0%';
      }
      if (valueRef.current) {
        valueRef.current.textContent = '0.0 dB';
      }
      return undefined;
    }
    let frame = 0;
    const paint = () => {
      // The published figure is the deepest sample of its block and is never
      // positive; the meter works in the magnitude of it.
      const depth = Math.abs(readDspMaximizerReduction());
      heldRef.current =
        depth > heldRef.current
          ? depth
          : heldRef.current * RELEASE_PER_FRAME +
            depth * (1 - RELEASE_PER_FRAME);
      const held = heldRef.current;
      if (barRef.current) {
        const width = Math.min(100, (held / FULL_SCALE_DB) * 100);
        barRef.current.style.width = `${width.toFixed(1)}%`;
      }
      if (valueRef.current) {
        valueRef.current.textContent = `${held < 0.05 ? '0.0' : `-${held.toFixed(1)}`} dB`;
      }
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [isEnabled]);

  return (
    <div className="dsp-maximizer-meter" aria-live="off">
      <span className="dsp-maximizer-meter-name">
        {t('dsp.maximizer.reduction')}
      </span>
      <div className="dsp-maximizer-meter-track">
        <div className="dsp-maximizer-meter-fill" ref={barRef} />
      </div>
      <span className="dsp-maximizer-meter-value" ref={valueRef}>
        0.0 dB
      </span>
    </div>
  );
};

export default DspMaximizerMeter;
