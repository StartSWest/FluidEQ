/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { useTranslation } from '../utils/I18nContext';
import useLiveSlider from '../utils/useLiveSlider';
import { hueOf, labOf } from '../utils/windowLight';
import {
  LAGOON_HUE,
  setWindowTint,
  setWindowTintColour,
  setWindowTintSecondary,
  useWindowTint,
  useWindowTintColour,
  useWindowTintSecondary,
  windowPrimaryColour,
} from '../utils/windowTint';

/** The wheel's colour at `hue`, as the track and its thumb draw it. */
const wheelColour = (hue: number) => `oklch(0.72 0.13 ${hue})`;

/**
 * Painted frames between two restyles while a picker moves: the window
 * recoloured whole is a long frame, and every one of them kept the picker
 * from following the hand.
 */
const PICKER_REST_FRAMES = 6;

interface ITintSwatchProps {
  /** The colour shown and the picker's opening value, `#rrggbb`. */
  colour: string;
  /** The colour picked, once the window can take it. */
  onPick: (colour: string) => void;
  label: string;
  className: string;
}

/**
 * A round swatch that opens the system's colour picker. The colour under the
 * pointer is on the swatch at once, the window restyled with it only every
 * few painted frames (`useLiveSlider`), so the picker keeps up with the hand;
 * the newest colour lands the moment the picker settles (its own `change`).
 */
const TintSwatch = ({ colour, onPick, label, className }: ITintSwatchProps) => {
  const id = useId();
  const live = useLiveSlider<string | undefined>(
    undefined,
    (value) => {
      if (value !== undefined) {
        onPick(value);
      }
    },
    PICKER_REST_FRAMES,
  );
  const pickerRef = useRef<HTMLInputElement>(null);
  const { flush } = live;
  useEffect(() => {
    const element = pickerRef.current;
    if (!element) {
      return undefined;
    }
    element.addEventListener('change', flush);
    return () => element.removeEventListener('change', flush);
  }, [flush]);
  const shown = live.shown ?? colour;
  return (
    <label
      htmlFor={id}
      className={className}
      style={{ '--swatch': shown } as CSSProperties}
      title={label}
    >
      <input
        ref={pickerRef}
        id={id}
        type="color"
        className="graph-view-menu__swatch-input"
        aria-label={label}
        value={shown}
        onChange={(event) => live.set(event.target.value.toLowerCase())}
      />
    </label>
  );
};

/**
 * The window's colour, beside Brightness where Transparency stands under a
 * Plus visualizer (Ivan, 2026-10-25: "instead of showing transparency
 * disabled we show the tint"): the colour wheel along the track, the thumb at
 * the hue the window wears, and the colours themselves in the value's place.
 * A double-click on the track puts the window back in its original colour
 * (`windowTint.ts`), with the thumb back where that colour stands.
 *
 * The first swatch opens the system's colour picker (Ivan, 2026-11-18: "when
 * the user selects the round colour on the right, open the colour picker, so
 * they can choose better colours and more variety"): the slider only turns
 * the accent round the wheel at one lightness and strength, the picker sets
 * it to any colour at all, black included, and the slider then stands at its
 * hue.
 *
 * The second is the other end of the window's gradient (Ivan, 2026-11-18:
 * "I need to be able to also select the secondary colour in the picker, so I
 * have control of both colours"). Until it is picked it follows the first,
 * drawn as a ring of it with a plus — a slot waiting, not a second copy of
 * the same dot — and the window draws in one colour; picked, it is filled
 * and the curves, faders and meters run from the first colour to it. Its ×
 * makes it follow the first again. A button beside the swatch rather than a
 * double-click on it: the first press of a double-click already opens the
 * picker.
 */
const WindowTintSlider = () => {
  const { t } = useTranslation();
  const tint = useWindowTint();
  const picked = useWindowTintColour();
  const second = useWindowTintSecondary();
  // The thumb under the pointer, the window's restyle a frame behind it
  // (`useLiveSlider`), as Brightness beside it.
  const { shown: hue, set } = useLiveSlider(tint ?? LAGOON_HUE, setWindowTint);
  const id = useId();
  const hueRef = useRef(hue);
  hueRef.current = hue;
  // The first colour as the window will wear it: the one picked whole, else
  // the accent at the hue under the thumb.
  const primary = windowPrimaryColour(hue, picked);
  const isLinked = second === undefined;
  const pickPrimary = (value: string) => {
    const lab = labOf(value);
    // A grey has no hue of its own: the slider stays where it stands.
    const at =
      lab && Math.hypot(lab.a, lab.b) > 0.02 ? hueOf(lab) : hueRef.current;
    setWindowTintColour(value, at);
  };
  return (
    <div
      className="graph-view-menu__slider graph-view-menu__slider--hue"
      title={t('graph.windowTintHint')}
    >
      <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 2.5v11" />
        <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
      </svg>
      <label htmlFor={id}>{t('graph.windowTint')}</label>
      <span className="graph-view-menu__track">
        <input
          id={id}
          type="range"
          aria-label={t('graph.windowTint')}
          min={0}
          max={359}
          step={1}
          value={Math.round(hue)}
          style={{ '--tint-colour': wheelColour(hue) } as CSSProperties}
          onChange={(event) => set(Number(event.target.value))}
          onDoubleClick={() => setWindowTint(undefined)}
        />
      </span>
      <span className="graph-view-menu__value graph-view-menu__swatches">
        <TintSwatch
          colour={primary}
          onPick={pickPrimary}
          label={t('graph.windowTintPick')}
          className="graph-view-menu__swatch"
        />
        <span className="graph-view-menu__second">
          <TintSwatch
            colour={second ?? primary}
            onPick={setWindowTintSecondary}
            label={t('graph.windowTintSecond')}
            className={`graph-view-menu__swatch${
              isLinked ? ' graph-view-menu__swatch--follows' : ''
            }`}
          />
          {!isLinked && (
            <button
              type="button"
              className="graph-view-menu__swatch-clear"
              aria-label={t('graph.windowTintOneColour')}
              title={t('graph.windowTintOneColour')}
              onClick={() => setWindowTintSecondary(undefined)}
            >
              <svg viewBox="0 0 8 8" aria-hidden>
                <path d="M2 2l4 4M6 2l-4 4" />
              </svg>
            </button>
          )}
        </span>
      </span>
    </div>
  );
};

export default WindowTintSlider;
