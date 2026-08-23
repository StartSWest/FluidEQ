/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { TTrimMode } from '../../common/dsp/chain';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import { readDspHeadroomGiveBack } from './store';

interface IDspTrimReadoutProps {
  /** What the regulator reserved from the curve alone, in dB. Negative. */
  reservedDb: number;
  /** How much of the regulator is in use. @see TTrimMode */
  mode: TTrimMode;
  onCycle: () => void;
}

/**
 * What the input regulator is taking right now, reserve and give-back together.
 *
 * The reserve is a property of the curve and holds still. What the adaptive
 * stage hands back is a property of the material and moves several times a
 * second, so the figure on screen has to move with it — otherwise the whole
 * point of measuring the song is invisible and the readout is telling the
 * pessimistic story a curve-only regulator would have told.
 *
 * Writes its own text through a ref rather than rendering. Two dozen React
 * renders a second for one number is churn, and this sits inside the EQ card,
 * so each of them would be a render of the card.
 */
/** What each mode is called, in the order the caption cycles through. */
const LABELS: Record<TTrimMode, TranslationKey> = {
  off: 'dsp.eq.trimOff',
  fixed: 'dsp.eq.trimFixed',
  adaptive: 'dsp.eq.adaptive',
};

const DspTrimReadout = ({
  reservedDb,
  mode,
  onCycle,
}: IDspTrimReadoutProps) => {
  const { t } = useTranslation();
  const valueRef = useRef<HTMLSpanElement>(null);
  const reserved = useRef(reservedDb);
  reserved.current = reservedDb;

  useEffect(() => {
    let frame = 0;
    let shown = Number.NaN;

    const paint = () => {
      const node = valueRef.current;
      if (node) {
        // The give-back is positive and the reserve negative, so this is the
        // reserve moving toward zero as the song turns out not to need it.
        const applied = reserved.current + readDspHeadroomGiveBack();
        const text = applied.toFixed(1);
        // Only when it changed: assigning identical text still dirties the node
        // and costs a layout pass on every frame for a number standing still.
        if (text !== `${shown}`) {
          shown = Number(text);
          node.textContent = `${text} dB`;
        }
      }
      frame = window.requestAnimationFrame(paint);
    };

    frame = window.requestAnimationFrame(paint);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <span className="dsp-eq-trim" title={t('dsp.eq.trimHint')}>
      <span className="dsp-eq-trim-value" ref={valueRef}>
        {reservedDb.toFixed(1)} dB
      </span>
      {/* The label is the switch. Everything about this readout is one
          idea — how much room is being made and on what basis — and a
          separate button beside it would be a second control for the same
          number. Quiet either way: pinned is not a worse answer, it is a
          steadier one. */}
      <button
        type="button"
        className={`dsp-eq-trim-mode${mode === 'off' ? ' is-off' : ''}`}
        aria-pressed={mode === 'adaptive'}
        title={t('dsp.eq.adaptiveHint')}
        onClick={onCycle}
      >
        {t(LABELS[mode])}
      </button>
    </span>
  );
};

export default DspTrimReadout;
