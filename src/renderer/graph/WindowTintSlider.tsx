/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, type CSSProperties } from 'react';
import { useTranslation } from '../utils/I18nContext';
import useLiveSlider from '../utils/useLiveSlider';
import { LAGOON_HUE, setWindowTint, useWindowTint } from '../utils/windowTint';

/**
 * The window's colour with a standard look, beside Brightness where
 * Transparency stands under a Plus visualizer (Ivan, 2026-10-25: "instead of
 * showing transparency disabled we show the tint"): the colour wheel along
 * the track, the thumb at the hue the window wears, and the colour itself in
 * the value's place. A double-click puts the window back in its original
 * colour (`windowTint.ts`), with the thumb back where that colour stands.
 */
const WindowTintSlider = () => {
  const { t } = useTranslation();
  const tint = useWindowTint();
  // The thumb under the pointer, the window's restyle a frame behind it
  // (`useLiveSlider`), as Brightness beside it.
  const { shown: hue, set } = useLiveSlider(tint ?? LAGOON_HUE, setWindowTint);
  const id = useId();
  return (
    <label
      className="graph-view-menu__slider graph-view-menu__slider--hue"
      htmlFor={id}
      title={t('graph.windowTintHint')}
    >
      <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 2.5v11" />
        <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
      </svg>
      <span>{t('graph.windowTint')}</span>
      <span className="graph-view-menu__track">
        <input
          id={id}
          type="range"
          aria-label={t('graph.windowTint')}
          min={0}
          max={359}
          step={1}
          value={Math.round(hue)}
          onChange={(event) => set(Number(event.target.value))}
          onDoubleClick={() => setWindowTint(undefined)}
        />
      </span>
      <span
        className="graph-view-menu__value graph-view-menu__swatch"
        style={{ '--tint-hue': hue } as CSSProperties}
        aria-hidden
      />
    </label>
  );
};

export default WindowTintSlider;
