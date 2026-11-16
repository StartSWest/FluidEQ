/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useId, type CSSProperties } from 'react';
import {
  BACKDROP_BLUR_MAX,
  BACKDROP_BLUR_MIN,
  setBackdropBlur,
  useBackdropBlur,
} from '../utils/backdropBlur';
import { useTranslation } from '../utils/I18nContext';
import {
  PERCENT_SNAPS,
  snapFraction,
  snapPercent,
} from '../utils/percentSnaps';
import useIsBackdrop from '../utils/useIsBackdrop';
import useLiveSlider from '../utils/useLiveSlider';
import rangeFill from '../utils/rangeFill';

/**
 * How soft the Backdrop's scene is behind the panes (`backdropBlur.ts`),
 * under Transparency wherever Transparency stands in the full app: the
 * actions menu's tray and the window-colours menu. The same slider row as
 * Transparency and Brightness, so the three read as one set.
 *
 * Dimmed and still under any other mode, as Transparency is: only the
 * Backdrop has a scene behind the panes to blur.
 */
const BackdropBlurSlider = () => {
  const { t } = useTranslation();
  const isBackdrop = useIsBackdrop();
  // The thumb under the pointer, the window's restyle a frame behind it.
  const { shown: blur, set } = useLiveSlider(
    useBackdropBlur(),
    setBackdropBlur,
  );
  const id = useId();
  return (
    <label
      className={`graph-view-menu__slider${isBackdrop ? '' : ' is-disabled'}`}
      htmlFor={id}
      title={t('graph.backdropBlurHint')}
    >
      <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="2.5" />
        <circle cx="8" cy="8" r="5.5" strokeDasharray="1.6 1.9" />
      </svg>
      <span>{t('graph.backdropBlur')}</span>
      <span className="graph-view-menu__track">
        {PERCENT_SNAPS.map((snap) => (
          <i
            key={snap}
            className="graph-view-menu__snap"
            style={
              {
                '--snap-frac': snapFraction(
                  snap,
                  BACKDROP_BLUR_MIN,
                  BACKDROP_BLUR_MAX,
                ),
              } as CSSProperties
            }
            aria-hidden
          />
        ))}
        <input
          id={id}
          type="range"
          aria-label={t('graph.backdropBlur')}
          min={BACKDROP_BLUR_MIN}
          max={BACKDROP_BLUR_MAX}
          step={1}
          disabled={!isBackdrop}
          value={blur}
          style={rangeFill(blur, BACKDROP_BLUR_MIN, BACKDROP_BLUR_MAX)}
          onChange={(event) => set(snapPercent(Number(event.target.value)))}
        />
      </span>
      <span className="graph-view-menu__value" aria-hidden>
        {t('graph.scene.percent', { percent: String(blur) })}
      </span>
    </label>
  );
};

export default BackdropBlurSlider;
