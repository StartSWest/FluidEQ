/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import type { TChoiceIcon } from 'common/sceneChoice';
import Chevron from '../icons/Chevron';
import SceneOptionIcon from './SceneOptionIcon';
import useChatPopover from '../studio/chat/useChatPopover';
import AnchoredMenu from '../widgets/AnchoredMenu';
import '../styles/SceneChoice.scss';

/** Up to this many options stand side by side; more open from a button. */
const SIDE_BY_SIDE = 4;

/** Which way an arrow key walks the options. */
const ARROW_STEP: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/** An option's own padding and the row's, in pixels (`SceneChoice.scss`). */
const OPTION_PADDING = 12;
const ROW_PADDING = 4;
const OPTION_GAP = 2;
/** The chosen option is set in the bolder weight, a little wider. */
const BOLD_ALLOWANCE = 1.08;
/** An option's icon or chip and the gap after it, in pixels. */
const LOOK_ALLOWANCE = 20;

let measurer: CanvasRenderingContext2D | null | undefined;

/**
 * Whether every option's name fits whole in a segmented row as wide as
 * `root` is now, measured in the font the names are set in. A name cut to
 * "Gradie..." is a choice nobody can read, so a row that cannot hold its
 * names gives way to the button and its menu, and comes back when the column
 * widens. Asked again whenever the column changes size, never on a clock.
 */
const useNamesFit = (
  root: RefObject<HTMLDivElement | null>,
  options: readonly ISceneChoiceShown[],
) => {
  const [fits, setFits] = useState(true);
  const key = options
    .map(
      (option) =>
        `${option.name}|${option.icon ?? ''}|${option.swatch?.join(',') ?? ''}`,
    )
    .join('\u0000');
  useEffect(() => {
    const node = root.current;
    if (!node) {
      return undefined;
    }
    const judge = () => {
      measurer ??= document.createElement('canvas').getContext('2d');
      if (!measurer) {
        return;
      }
      // The label's font is the options' (`SceneChoice.scss`).
      const style = getComputedStyle(
        node.querySelector('.scene-choice__label') ?? node,
      );
      measurer.font = `${style.fontSize} ${style.fontFamily}`;
      const widest = Math.max(
        ...options.map(
          (option) =>
            (measurer?.measureText(option.name).width ?? 0) +
            // An icon or a chip stands beside the name.
            (option.icon || option.swatch ? LOOK_ALLOWANCE : 0),
        ),
      );
      const needed =
        options.length * (widest * BOLD_ALLOWANCE + OPTION_PADDING) +
        (options.length - 1) * OPTION_GAP +
        ROW_PADDING;
      setFits(needed <= node.clientWidth);
    };
    judge();
    const watch = new ResizeObserver(judge);
    watch.observe(node);
    return () => watch.disconnect();
    // `options` is read through its key: a fresh array of the same names is
    // the same row.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by `key`
  }, [root, key]);
  return fits;
};

/** One option as it is shown: its name and what it wears beside it. */
export interface ISceneChoiceShown {
  name: string;
  icon?: TChoiceIcon;
  swatch?: readonly string[];
}

/** An option's icon and its colour chip, where it has them. */
function OptionLook({ option }: { option: ISceneChoiceShown }) {
  return (
    <>
      {option.icon && (
        <SceneOptionIcon icon={option.icon} className="scene-choice__icon" />
      )}
      {option.swatch && (
        <span
          className="scene-choice__swatch"
          style={{
            background:
              option.swatch.length > 1
                ? `linear-gradient(90deg, ${option.swatch.join(', ')})`
                : option.swatch[0],
          }}
          aria-hidden
        />
      )}
    </>
  );
}

interface ISceneChoiceProps {
  label: string;
  /** The options, named in the reader's language, in order. */
  options: readonly ISceneChoiceShown[];
  /** The chosen option's place among them. */
  value: number;
  disabled: boolean;
  onPick: (index: number) => void;
}

/**
 * A scene's choice (contract 9, `sceneChoice.ts`), in the Studio and in the
 * graph's View menu alike. Two to four options are a segmented row, the
 * chosen one under a highlight that slides to the next, so every option is
 * one press away and seen at once. Five to eight would crowd a column, and
 * so would names too long for the column it stands in (`useNamesFit`), so
 * then the chosen one stands on a button that opens the rest beneath it.
 */
export default function SceneChoice({
  label,
  options,
  value,
  disabled,
  onPick,
}: ISceneChoiceProps) {
  const labelId = useId();
  const menu = useChatPopover();
  const rowRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const count = options.length;
  const namesFit = useNamesFit(rootRef, options);

  // Arrows walk the options, as a group of radio buttons does; the option
  // reached is picked and takes the focus.
  const onKey = (event: KeyboardEvent<HTMLElement>) => {
    const step = ARROW_STEP[event.key] ?? 0;
    if (step === 0 || disabled) {
      return;
    }
    event.preventDefault();
    const next = (value + step + count) % count;
    onPick(next);
    rowRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [next]?.focus();
  };

  if (count <= SIDE_BY_SIDE && namesFit) {
    return (
      <div ref={rootRef} className="scene-choice">
        <span id={labelId} className="scene-choice__label">
          {label}
        </span>
        <div
          ref={rowRef}
          className="scene-choice__row"
          role="radiogroup"
          aria-labelledby={labelId}
          style={{ '--count': count, '--at': value } as CSSProperties}
        >
          <span className="scene-choice__slide" aria-hidden />
          {options.map((option, index) => (
            <button
              // Options are the scene's, fixed in number and order.
              // eslint-disable-next-line react/no-array-index-key -- an option is its place
              key={index}
              type="button"
              role="radio"
              aria-checked={index === value}
              tabIndex={index === value ? 0 : -1}
              className={`scene-choice__option${index === value ? ' is-chosen' : ''}`}
              title={option.name}
              disabled={disabled}
              onClick={() => onPick(index)}
              onKeyDown={onKey}
            >
              <OptionLook option={option} />
              <span className="scene-choice__text">{option.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="scene-choice">
      <span id={labelId} className="scene-choice__label">
        {label}
      </span>
      <button
        ref={menu.setAnchor}
        type="button"
        className="scene-choice__trigger"
        aria-haspopup="listbox"
        aria-expanded={menu.isOpen}
        aria-labelledby={labelId}
        disabled={disabled}
        onClick={menu.toggle}
        onKeyDown={onKey}
      >
        <span className="scene-choice__current">
          {options[value] && <OptionLook option={options[value]} />}
          <span className="scene-choice__text">{options[value]?.name}</span>
        </span>
        <span className="scene-choice__count" aria-hidden>
          {value + 1}/{count}
        </span>
        <Chevron />
      </button>
      <AnchoredMenu
        anchor={menu.anchor}
        isOpen={menu.isOpen}
        role="menu"
        className="scene-choice__menu"
        ariaLabel={label}
        align="left"
      >
        {options.map((option, index) => (
          <button
            // eslint-disable-next-line react/no-array-index-key -- an option is its place
            key={index}
            type="button"
            role="menuitemradio"
            aria-checked={index === value}
            className={`scene-choice__item${index === value ? ' is-chosen' : ''}`}
            onClick={() => {
              menu.close();
              onPick(index);
            }}
          >
            <span className="scene-choice__mark" aria-hidden />
            <OptionLook option={option} />
            <span className="scene-choice__name">{option.name}</span>
          </button>
        ))}
      </AnchoredMenu>
    </div>
  );
}
