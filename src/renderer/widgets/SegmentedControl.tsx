/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export interface ISegmentedOption {
  value: string;
  label: string;
  /** Longer explanation, for the options whose name is not the whole story. */
  title?: string;
}

interface ISegmentedControlProps {
  /** Read out as the group's name. The visible caption sits beside it. */
  name: string;
  value: string;
  options: readonly ISegmentedOption[];
  isDisabled?: boolean;
  onChange: (next: string) => void;
}

/**
 * A short, closed set of choices, all of them visible at once.
 *
 * A dropdown hides every option but the chosen one, which is the right trade
 * when there are twenty of them and the wrong one when there are two: the EQ
 * toolbar had seven dropdowns in a row, and four of those were binary or
 * ternary choices whose alternatives you could not see without opening a menu
 * to find out what you were choosing between.
 *
 * The rule this follows, so the row stays coherent rather than mixed at random:
 * a control with a long list, or a label too long to sit beside its siblings,
 * stays a dropdown. Everything short and closed becomes one of these.
 */
const SegmentedControl = ({
  name,
  value,
  options,
  isDisabled = false,
  onChange,
}: ISegmentedControlProps) => (
  <div className="segmented" role="radiogroup" aria-label={name}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={option.value === value}
        title={option.title}
        disabled={isDisabled}
        className={`segmented__option${
          option.value === value ? ' is-selected' : ''
        }`}
        onClick={() => {
          // Re-selecting what is already selected is not a change, and letting
          // it through would rebuild the chain on every stray click.
          if (option.value !== value) {
            onChange(option.value);
          }
        }}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export default SegmentedControl;
