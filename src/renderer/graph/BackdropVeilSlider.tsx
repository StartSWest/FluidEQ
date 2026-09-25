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
 * How much of the Backdrop's scene shows through the panes, at the head of
 * the window-colours menu beside Brightness (Ivan, 2026-09-25: "in total I
 * want only two options brightness and transparency"). Stored as the veil's
 * strength, which is what the stylesheet wants (`backdropVeil.ts`); shown as
 * its transparency, which is what the name says, so right is more of the
 * scene.
 *
 * Only the Backdrop puts a scene behind the panes, so under any other mode
 * it stands dimmed and does not move: a slider that moved and changed
 * nothing would read as broken.
 */
const BackdropVeilSlider = () => {
  const { t } = useTranslation();
  const veil = useBackdropVeil();
  const isBackdrop = useSceneTintMode() === 'cover';
  const transparency = 100 - veil;
  return (
    <label
      className={`graph-view-menu__slider${isBackdrop ? '' : ' is-disabled'}`}
      htmlFor="scene-look-transparency"
      title={t('graph.backdropVeilHint')}
    >
      <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
        <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
        <path d="M2.5 9.5h11" />
      </svg>
      <span>{t('graph.backdropVeil')}</span>
      <input
        id="scene-look-transparency"
        type="range"
        aria-label={t('graph.backdropVeil')}
        min={100 - BACKDROP_VEIL_MAX}
        max={100 - BACKDROP_VEIL_MIN}
        step={1}
        disabled={!isBackdrop}
        value={transparency}
        onChange={(event) => setBackdropVeil(100 - Number(event.target.value))}
      />
      <span className="graph-view-menu__value" aria-hidden>
        {t('graph.scene.percent', { percent: String(transparency) })}
      </span>
    </label>
  );
};

export default BackdropVeilSlider;
