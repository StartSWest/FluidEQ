/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { KeyboardEvent, useLayoutEffect, useRef, useState } from 'react';
import type { TDialView } from './dialGesture';
import KnobDial from './KnobDial';
import { useTranslation } from '../utils/I18nContext';
import '../styles/Knob.scss';

interface IKnobViewProps {
  /** What the dial's gesture decided: where it stands and how it answers. */
  view: TDialView;
  /** Shown after the reading — `Q` for a width, `dB` for a level. */
  unit: string;
  isDisabled: boolean;
}

/**
 * A typed number, with a comma read as the decimal point it is in half the
 * languages this app speaks, and a trailing `k` as thousands — the box opens
 * holding the reading, and a frequency reads "12.5k"; undefined for anything
 * that is not a number.
 */
const parseTyped = (text: string) => {
  const typed = text.trim().replace(',', '.');
  const isThousands = /k$/i.test(typed);
  const digits = isThousands ? typed.slice(0, -1).trim() : typed;
  const number = Number(digits);
  if (digits === '' || !Number.isFinite(number)) {
    return undefined;
  }
  return isThousands ? number * 1_000 : number;
};

/** The box a reading is turned into: the text it opened with, and what is in
 * it now. */
interface ITyping {
  from: string;
  text: string;
}

/**
 * Every dial in the app as drawn: the knob, its reading under it, and the
 * range input its gesture drives — the EQ page's, the preamp, every DSP
 * stage's (Ivan, 2026-09-26: "update all nobs in the entire app", "a single
 * reusable component"). Whatever the gesture — the sweep of `Knob`, the
 * detents of `SteppedKnob` — the dial looks the same, so only the hand can
 * tell which one it is turning.
 *
 * The reading stands under the knob, never on it: with a number printed on
 * its face a knob reads as a readout, and a row of them at rest was a row of
 * dark discs with digits on ("I dont even see the nobs").
 *
 * And the reading is where an exact value is typed: pressed, it turns into a
 * box holding the value, Enter or leaving it sets it, Escape puts the reading
 * back (Ivan, 2026-09-26: "make a single number and when click it turns into
 * a input"). The preamp had a number field of its own under its knob for
 * this, which was the same number twice. A dial that is not in the hand's
 * control — the preamp while Auto normalize owns it — has a reading and no
 * box.
 *
 * The box is the reading's own box and opens holding the reading's own text,
 * so nothing moves when it opens ("make sure it keep same position"): an
 * earlier box a fixed seven characters wide, holding the value to more
 * places than the reading showed, put the number somewhere else on every
 * press. Holding the rounded text costs nothing, because a box left as it
 * opened sets nothing — the value it rounds stays as it was.
 */
const KnobView = ({ view, unit, isDisabled }: IKnobViewProps) => {
  const { t } = useTranslation();
  const {
    inputRef,
    clampedProgress,
    arcStart,
    arcLength,
    showsArc,
    detents,
    displayValue,
    typeValue,
    dialProps,
    inputProps,
  } = view;
  const isLit = showsArc && arcLength > 0.5;
  const [typing, setTyping] = useState<ITyping>();
  const field = useRef<HTMLInputElement>(null);
  const isTyping = typing !== undefined && !isDisabled;

  // Selected, so typing replaces the value rather than adding to it; before
  // the paint, so the box is never seen without it.
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
    // Compared with what it opened with, not with the reading now: a preset
    // landing while the box is open changes the reading, and a box nobody
    // typed into must not put the old value back over it.
    if (typing.text.trim() === typing.from) {
      return;
    }
    const typed = parseTyped(typing.text);
    if (typed !== undefined) {
      typeValue(typed);
    }
  };

  const onFieldKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      // Stopped here, or a dialog or menu round the knob closes as well.
      event.stopPropagation();
      setTyping(undefined);
    }
  };

  return (
    <div
      className={`knob-readout${isLit ? ' is-lit' : ''}${isDisabled ? ' is-disabled' : ''}`}
    >
      <div
        className={`knob${isDisabled ? ' knob--disabled' : ''}`}
        // eslint-disable-next-line react/jsx-props-no-spreading -- the dial gesture is one group of handlers, named together
        {...dialProps}
      >
        <KnobDial
          progress={clampedProgress}
          arcStart={arcStart}
          arcLength={arcLength}
          showsArc={showsArc}
          detents={detents}
        />
        <input
          ref={inputRef}
          className="knob__input"
          // eslint-disable-next-line react/jsx-props-no-spreading -- the range input is described in one place, the gesture
          {...inputProps}
        />
      </div>
      {isTyping ? (
        <span className="knob-readout__value is-typing">
          <input
            ref={field}
            className="knob-readout__field"
            type="text"
            inputMode="decimal"
            aria-label={inputProps['aria-label']}
            value={typing.text}
            onChange={(event) =>
              setTyping({ ...typing, text: event.target.value })
            }
            onKeyDown={onFieldKey}
            onBlur={finish}
          />
          {unit && <span className="knob-readout__unit">{unit}</span>}
        </span>
      ) : (
        <button
          type="button"
          className="knob-readout__value"
          title={isDisabled ? undefined : t('app.knob.type')}
          aria-label={`${inputProps['aria-label']}: ${displayValue} ${unit}`}
          disabled={isDisabled}
          onClick={() => setTyping({ from: displayValue, text: displayValue })}
        >
          {displayValue}
          {unit && <span className="knob-readout__unit">{unit}</span>}
        </button>
      )}
    </div>
  );
};

export default KnobView;
