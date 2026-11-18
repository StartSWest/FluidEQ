/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { useTranslation } from '../utils/I18nContext';
import useLiveSlider from '../utils/useLiveSlider';
import { labToHex } from '../utils/oklab';
import { hueOf, labOf } from '../utils/windowLight';
import {
  LAGOON_HUE,
  setWindowTint,
  setWindowTintColour,
  useWindowTint,
  useWindowTintColour,
} from '../utils/windowTint';

/** The wheel's colour at `hue`, as the track and the swatch draw it. */
const wheelColour = (hue: number) => `oklch(0.72 0.13 ${hue})`;

/**
 * Painted frames between two restyles while the picker moves: the window
 * recoloured whole is a long frame, and every one of them kept the picker
 * from following the hand.
 */
const PICKER_REST_FRAMES = 6;

/** The same colour as a hex, the colour picker's opening value. */
const wheelHex = (hue: number) => {
  const radians = (hue * Math.PI) / 180;
  return labToHex({
    l: 0.72,
    a: 0.13 * Math.cos(radians),
    b: 0.13 * Math.sin(radians),
  });
};

/**
 * The window's colour with a standard look, beside Brightness where
 * Transparency stands under a Plus visualizer (Ivan, 2026-10-25: "instead of
 * showing transparency disabled we show the tint"): the colour wheel along
 * the track, the thumb at the hue the window wears, and the colour itself in
 * the value's place. A double-click puts the window back in its original
 * colour (`windowTint.ts`), with the thumb back where that colour stands.
 *
 * The swatch opens the system's colour picker (Ivan, 2026-11-18: "when the
 * user selects the round colour on the right, open the colour picker, so they
 * can choose better colours and more variety"): the slider only turns the
 * accent round the wheel at one lightness and strength, the picker sets it to
 * any colour at all, black included, and the slider then stands at its hue.
 */
const WindowTintSlider = () => {
  const { t } = useTranslation();
  const tint = useWindowTint();
  const picked = useWindowTintColour();
  // The thumb under the pointer, the window's restyle a frame behind it
  // (`useLiveSlider`), as Brightness beside it.
  const { shown: hue, set } = useLiveSlider(tint ?? LAGOON_HUE, setWindowTint);
  const id = useId();
  const pickerId = useId();
  const hueRef = useRef(hue);
  hueRef.current = hue;
  // The picker's colour under the pointer at once on the swatch, the window
  // restyled with it only every few painted frames (`useLiveSlider`), so the
  // picker keeps up with the hand; the newest colour lands the moment the
  // picker settles (its own `change`).
  const live = useLiveSlider<string | undefined>(
    picked,
    (value) => {
      if (value === undefined) {
        return;
      }
      const lab = labOf(value);
      // A grey has no hue of its own: the slider stays where it stands.
      const at =
        lab && Math.hypot(lab.a, lab.b) > 0.02 ? hueOf(lab) : hueRef.current;
      setWindowTintColour(value, at);
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
      <label
        htmlFor={pickerId}
        className="graph-view-menu__value graph-view-menu__swatch"
        style={{ '--swatch': live.shown ?? wheelColour(hue) } as CSSProperties}
        title={t('graph.windowTintPick')}
      >
        <input
          ref={pickerRef}
          id={pickerId}
          type="color"
          className="graph-view-menu__swatch-input"
          aria-label={t('graph.windowTintPick')}
          value={live.shown ?? wheelHex(hue)}
          onChange={(event) => live.set(event.target.value.toLowerCase())}
        />
      </label>
    </div>
  );
};

export default WindowTintSlider;
