/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useId, type CSSProperties } from 'react';
import {
  BACKDROP_VEIL_MAX,
  BACKDROP_VEIL_MIN,
  setBackdropVeil,
  useBackdropVeil,
} from '../utils/backdropVeil';
import { useTranslation } from '../utils/I18nContext';
import {
  PERCENT_SNAPS,
  snapFraction,
  snapPercent,
} from '../utils/percentSnaps';
import { useSceneTintMode } from '../utils/sceneTintStore';

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
 * Only the Backdrop puts a scene behind the panes, so under any other mode
 * it stands dimmed and does not move: a slider that moved and changed
 * nothing would read as broken.
 */
/** The slider's ends as transparencies, the veil's range turned round. */
const MIN_SHOWN = 100 - BACKDROP_VEIL_MAX;
const MAX_SHOWN = 100 - BACKDROP_VEIL_MIN;

const BackdropVeilSlider = () => {
  const { t } = useTranslation();
  const veil = useBackdropVeil();
  const isBackdrop = useSceneTintMode() === 'cover';
  const transparency = 100 - veil;
  const id = useId();
  return (
    <label
      className={`graph-view-menu__slider${isBackdrop ? '' : ' is-disabled'}`}
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
                '--snap-frac': snapFraction(snap, MIN_SHOWN, MAX_SHOWN),
              } as CSSProperties
            }
            aria-hidden
          />
        ))}
        <input
          id={id}
          type="range"
          aria-label={t('graph.backdropVeil')}
          min={MIN_SHOWN}
          max={MAX_SHOWN}
          step={1}
          disabled={!isBackdrop}
          value={transparency}
          onChange={(event) =>
            setBackdropVeil(100 - snapPercent(Number(event.target.value)))
          }
        />
      </span>
      <span className="graph-view-menu__value" aria-hidden>
        {t('graph.scene.percent', { percent: String(transparency) })}
      </span>
    </label>
  );
};

export default BackdropVeilSlider;
