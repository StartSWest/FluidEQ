/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useRef, useState, type CSSProperties } from 'react';
import ColourPickerPopover from '../components/ColourPickerPopover';
import { useTranslation } from '../utils/I18nContext';
import { hsvOfHex } from '../utils/hsvColour';
import useLiveSlider from '../utils/useLiveSlider';
import { hueOf, labOf } from '../utils/windowLight';
import {
  LAGOON_HUE,
  setWindowTint,
  setWindowTintColour,
  setWindowTintSecondary,
  useWindowTint,
  useWindowTintColour,
  restoreWindowTint,
  useWindowTintSecondary,
  windowPrimaryColour,
  windowTintSnapshot,
  type IWindowTintSnapshot,
} from '../utils/windowTint';

/** The wheel's colour at `hue`, as the track and its thumb draw it. */
const wheelColour = (hue: number) => `oklch(0.72 0.13 ${hue})`;

interface ITintSwatchProps {
  /** The colour shown and the picker's opening value, `#rrggbb`. */
  colour: string;
  /** Every colour the picker moves to, already paced by the picker. */
  onPick: (colour: string) => void;
  label: string;
  className: string;
  /** The picker's hue bar while the colour is a grey (`ColourPickerPopover`). */
  hueWhenGrey: number;
}

/**
 * A round swatch that opens FluidEQ's own colour picker, the Studio's
 * (`ColourPickerPopover`, Ivan 2026-11-18: "use the same colour picker we
 * did for the Studio in the app settings, with the Accept and Cancel"). The
 * window follows the picker while it moves, paced by the picker itself;
 * Accept keeps the colour, and Cancel, Escape or a press elsewhere puts the
 * Tint back exactly as it stood when the picker opened.
 */
const TintSwatch = ({
  colour,
  onPick,
  label,
  className,
  hueWhenGrey,
}: ITintSwatchProps) => {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [opened, setOpened] = useState<IWindowTintSnapshot>();
  const close = () => setOpened(undefined);
  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className={className}
        style={{ '--swatch': colour } as CSSProperties}
        title={label}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={opened !== undefined}
        onClick={() =>
          setOpened((was) => (was === undefined ? windowTintSnapshot() : was))
        }
      />
      <ColourPickerPopover
        anchor={anchor}
        isOpen={opened !== undefined}
        title={label}
        value={colour}
        hueWhenGrey={hueWhenGrey}
        onChange={onPick}
        onAccept={(next) => {
          onPick(next);
          close();
        }}
        onCancel={() => {
          if (opened) {
            restoreWindowTint(opened);
          }
          close();
        }}
      />
    </>
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
  // The slider's hue as the picker's bar measures hue: a grey picked keeps
  // the hue under the thumb (`pickPrimary`), and the picker opens on it so a
  // move off the grey colours with that hue, not with red.
  const pickerHue = hsvOfHex(windowPrimaryColour(hue, undefined)).h;
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
          hueWhenGrey={pickerHue}
        />
        <span className="graph-view-menu__second">
          <TintSwatch
            colour={second ?? primary}
            onPick={setWindowTintSecondary}
            label={t('graph.windowTintSecond')}
            hueWhenGrey={pickerHue}
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
