/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useId, type CSSProperties } from 'react';
import {
  BACKDROP_VEIL_MIN,
  backdropVeilMax,
  setBackdropVeil,
  useBackdropVeil,
  useBackdropVeilScope,
} from '../utils/backdropVeil';
import { useTranslation } from '../utils/I18nContext';
import {
  PERCENT_SNAPS,
  snapFraction,
  snapPercent,
} from '../utils/percentSnaps';
import useIsSceneLook from '../utils/useIsSceneLook';
import useLiveSlider from '../utils/useLiveSlider';
import rangeFill from '../utils/rangeFill';

/** A transparency set as the veil it leaves. */
const setTransparency = (transparency: number) =>
  setBackdropVeil(100 - transparency);

/**
 * How much of the Backdrop's scene shows through the panes, beside
 * Brightness at the head of the window-colours menu and in the actions
 * menu's tray (Ivan, 2026-09-25: "in total I want only two options
 * brightness and transparency"; 2026-09-26: "do same in the main menu").
 * Stored as the veil's
 * strength, which is what the stylesheet wants (`backdropVeil.ts`); shown as
 * its transparency, which is what the name says, so right is more of the
 * scene.
 *
 * In the full app it is the Backdrop's switch as well (Ivan, 2026-11-16:
 * "instead of having a backdrop mode is just transparency and blur"): at 0
 * there is no scene behind the window, and above it there is. So it is live
 * whenever a Plus visualizer is chosen, which is all the Backdrop needs, and
 * dimmed with a standard look, which has no picture to show. In the amp,
 * which is always the Backdrop with a Plus visualizer, it moves the amp's
 * glass and stops short of 0 (`backdropVeil.ts`).
 */
/** The slider's top end as a transparency, the lightest veil turned round. */
const MAX_SHOWN = 100 - BACKDROP_VEIL_MIN;

const BackdropVeilSlider = () => {
  const { t } = useTranslation();
  const veil = useBackdropVeil();
  const isLive = useIsSceneLook();
  // 0 in the full app, where it turns the scene off; 5 in the amp.
  const minShown = 100 - backdropVeilMax(useBackdropVeilScope());
  // The thumb under the pointer, the window's restyle a frame behind it
  // (`useLiveSlider`), as Brightness beside it.
  const { shown: transparency, set } = useLiveSlider(
    100 - veil,
    setTransparency,
  );
  const id = useId();
  return (
    <label
      className={`graph-view-menu__slider${isLive ? '' : ' is-disabled'}`}
      htmlFor={id}
      title={t('graph.backdropVeilHint')}
    >
      <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
        <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
        <path d="M2.5 9.5h11" />
      </svg>
      <span>{t('graph.backdropVeil')}</span>
      {/* The quarters, marked and fallen into (`percentSnaps.ts`), as on
          Brightness beside it. */}
      <span className="graph-view-menu__track">
        {PERCENT_SNAPS.map((snap) => (
          <i
            key={snap}
            className="graph-view-menu__snap"
            style={
              {
                '--snap-frac': snapFraction(snap, minShown, MAX_SHOWN),
              } as CSSProperties
            }
            aria-hidden
          />
        ))}
        <input
          id={id}
          type="range"
          aria-label={t('graph.backdropVeil')}
          min={minShown}
          max={MAX_SHOWN}
          step={1}
          disabled={!isLive}
          value={transparency}
          style={rangeFill(transparency, minShown, MAX_SHOWN)}
          onChange={(event) => set(snapPercent(Number(event.target.value)))}
        />
      </span>
      <span className="graph-view-menu__value" aria-hidden>
        {t('graph.scene.percent', { percent: String(transparency) })}
      </span>
    </label>
  );
};

export default BackdropVeilSlider;
