/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { readDspBandAmounts } from './store';

interface IDspDynamicReadoutProps {
  /** Which band in the rack this is reporting on. */
  bandIndex: number;
  isDynamic: boolean;
  isDisabled: boolean;
  onToggle: () => void;
}

/**
 * How much of this band is arriving right now, and whether it waits at all.
 *
 * The same shape as the input regulator's readout because it answers the same
 * kind of question: a live figure over the caption that decides how it is
 * arrived at. A dynamic band's whole behaviour is invisible otherwise — the
 * threshold sets a level nothing on screen reports, so the only way to know it
 * is set right is to watch what the band actually does with the music.
 *
 * Written through a ref rather than rendered. The reading changes about twenty
 * times a second and this sits inside the EQ card, so each render would be a
 * render of the card.
 */
const DspDynamicReadout = ({
  bandIndex,
  isDynamic,
  isDisabled,
  onToggle,
}: IDspDynamicReadoutProps) => {
  const { t } = useTranslation();
  const valueRef = useRef<HTMLSpanElement>(null);
  const view = useRef({ bandIndex, isDynamic });
  view.current = { bandIndex, isDynamic };

  useEffect(() => {
    let frame = 0;
    let shown = '';

    const paint = () => {
      const node = valueRef.current;
      if (node) {
        // A static band is always fully applied — that is what makes it static
        // — so a percentage there would be a live reading of a constant. The
        // dash says "nothing is being decided here", which is the truth.
        const text = view.current.isDynamic
          ? `${Math.round(
              (readDspBandAmounts()[view.current.bandIndex] ?? 0) * 100,
            )} %`
          : '—';
        if (text !== shown) {
          shown = text;
          node.textContent = text;
        }
      }
      frame = window.requestAnimationFrame(paint);
    };

    frame = window.requestAnimationFrame(paint);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <span className="dsp-eq-trim" title={t('dsp.eq.dynamicHint')}>
      <span className="dsp-eq-trim-value" ref={valueRef}>
        —
      </span>
      <button
        type="button"
        className="dsp-eq-trim-mode"
        aria-pressed={isDynamic}
        disabled={isDisabled}
        onClick={onToggle}
      >
        {isDynamic ? t('dsp.eq.dynamicOn') : t('dsp.eq.dynamic')}
      </button>
    </span>
  );
};

export default DspDynamicReadout;
