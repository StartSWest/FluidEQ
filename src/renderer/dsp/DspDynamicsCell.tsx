/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from '../utils/I18nContext';
import parseTypedNumber from '../widgets/typedNumber';

interface IProps {
  /** Read out as the field's name. */
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  /** Decimals the reading shows. */
  decimals: number;
  /** The half of the band it belongs to does nothing: drawn dashed, faint. */
  isIdle: boolean;
  isDisabled: boolean;
  onValue: (next: number) => void;
  onCommit: () => void;
}

interface ITyping {
  from: string;
  text: string;
}

/**
 * One exact value of a band, typed: the reading every knob in the app has
 * under it (`KnobView`), standing alone — pressed, it turns into a box
 * holding the reading, Enter or leaving it sets it, Escape puts the reading
 * back. The points on the curve are for feel; these are for a number.
 */
const DspDynamicsCell = ({
  label,
  value,
  unit,
  min,
  max,
  step,
  decimals,
  isIdle,
  isDisabled,
  onValue,
  onCommit,
}: IProps) => {
  const { t } = useTranslation();
  const [typing, setTyping] = useState<ITyping>();
  const field = useRef<HTMLInputElement>(null);
  const reading = value.toFixed(decimals);
  const isTyping = typing !== undefined && !isDisabled;

  // Selected before the paint, so typing replaces the value and the box is
  // never seen without it.
  useLayoutEffect(() => {
    if (isTyping) {
      field.current?.focus();
      field.current?.select();
    }
  }, [isTyping]);

  const finish = () => {
    if (typing === undefined) {
      return;
    }
    setTyping(undefined);
    // A box left as it opened sets nothing: the value it rounds stays.
    if (typing.text.trim() === typing.from) {
      return;
    }
    const typed = parseTypedNumber(typing.text);
    if (typed === undefined) {
      return;
    }
    const held = Math.min(Math.max(typed, min), max);
    const next = Math.round(Math.round(held / step) * step * 1000) / 1000;
    if (next !== value) {
      onValue(next);
      onCommit();
    }
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      // Stopped here, or a dialog round the card closes as well.
      event.stopPropagation();
      setTyping(undefined);
    }
  };

  const className = `knob-readout__value dsp-dynamics-cell${
    isIdle ? ' is-idle' : ''
  }`;
  return isTyping ? (
    <span className={`${className} is-typing`}>
      <input
        ref={field}
        className="knob-readout__field"
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={typing.text}
        onChange={(event) => setTyping({ ...typing, text: event.target.value })}
        onKeyDown={onKey}
        onBlur={finish}
      />
      <span className="knob-readout__unit">{unit}</span>
    </span>
  ) : (
    <button
      type="button"
      className={className}
      title={isDisabled ? undefined : t('app.knob.type')}
      aria-label={`${label}: ${reading} ${unit}`}
      disabled={isDisabled}
      onFocus={() => setTyping({ from: reading, text: reading })}
      onClick={() => setTyping({ from: reading, text: reading })}
    >
      {reading}
      <span className="knob-readout__unit">{unit}</span>
    </button>
  );
};

export default DspDynamicsCell;
