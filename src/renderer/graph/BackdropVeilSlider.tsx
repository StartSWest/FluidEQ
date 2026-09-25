/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import {
  BACKDROP_VEIL_MAX,
  BACKDROP_VEIL_MIN,
  setBackdropVeil,
  useBackdropVeil,
} from '../utils/backdropVeil';
import { useTranslation } from '../utils/I18nContext';
import { useSceneTintMode } from '../utils/sceneTintStore';

/**
 * How much the panes cover the Backdrop's scene, in the View menu beside the
 * scene's own settings (Ivan, 2026-09-25: "add slider for transparent and how
 * dark is the UI"). Only in the Backdrop, the one mode with a scene behind
 * the panes; it hides itself everywhere else, like the switches beside it
 * that have nothing to do. Right is more of the floor, as a pane's solidity
 * is what the name says.
 */
const BackdropVeilSlider = () => {
  const { t } = useTranslation();
  const mode = useSceneTintMode();
  const veil = useBackdropVeil();
  if (mode !== 'cover') {
    return null;
  }
  return (
    <label
      className="graph-view-menu__slider"
      htmlFor="graph-backdrop-veil"
      title={t('graph.backdropVeilHint')}
    >
      <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
        <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
        <path d="M2.5 9.5h11" />
      </svg>
      <span>{t('graph.backdropVeil')}</span>
      <input
        id="graph-backdrop-veil"
        type="range"
        aria-label={t('graph.backdropVeil')}
        min={BACKDROP_VEIL_MIN}
        max={BACKDROP_VEIL_MAX}
        step={1}
        value={veil}
        onChange={(event) => setBackdropVeil(Number(event.target.value))}
      />
      <span className="graph-view-menu__value" aria-hidden>
        {t('graph.scene.percent', { percent: String(veil) })}
      </span>
    </label>
  );
};

export default BackdropVeilSlider;
