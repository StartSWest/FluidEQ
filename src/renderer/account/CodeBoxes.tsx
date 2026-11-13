import type { RefObject } from 'react';
import { CODE_LENGTH } from 'common/accountRules';

interface ICodeBoxesProps {
  id: string;
  /** The label's id; the label itself is read, not shown. */
  labelId: string;
  label: string;
  value: string;
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  invalid: boolean;
  describedBy: string | undefined;
  onBlur: () => void;
  onChange: (value: string) => void;
}

/**
 * The emailed code as six boxes (Ivan approved the sign-in screens on
 * 2026-11-13): one real input laid over six drawn boxes, so typing, pasting
 * the whole code and the system's one-time-code fill all work as in any
 * field, and only the drawing is boxes. The box the next digit lands in is
 * lit while the field has the caret.
 */
export default function CodeBoxes({
  id,
  labelId,
  label,
  value,
  disabled,
  inputRef,
  invalid,
  describedBy,
  onBlur,
  onChange,
}: ICodeBoxesProps) {
  const digits = Array.from({ length: CODE_LENGTH }, (_, index) =>
    value.charAt(index),
  );
  return (
    <label className="code-boxes" htmlFor={id}>
      <span className="code-boxes__label" id={labelId}>
        {label}
      </span>
      <input
        ref={inputRef}
        id={id}
        className="code-boxes__input"
        aria-labelledby={labelId}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onBlur={onBlur}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={CODE_LENGTH}
        spellCheck={false}
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))
        }
      />
      <span className="code-boxes__row" aria-hidden="true">
        {digits.map((digit, index) => (
          <span
            // A box's place is what it is: the six never reorder.
            // eslint-disable-next-line react/no-array-index-key -- see above
            key={index}
            className={`code-boxes__box${digit ? ' is-filled' : ''}${
              index === Math.min(value.length, CODE_LENGTH - 1)
                ? ' is-next'
                : ''
            }`}
          >
            {digit}
          </span>
        ))}
      </span>
    </label>
  );
}
