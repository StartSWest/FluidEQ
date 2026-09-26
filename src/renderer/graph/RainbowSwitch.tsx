/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';
import {
  setEuphoriaEnabled,
  useIsEuphoriaEnabled,
} from '../utils/euphoriaMode';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';

/**
 * Normal or Rainbow, under Brightness and Transparency wherever those two
 * stand: the Window colours menu and the app menu's tray (Ivan, 2026-09-26:
 * "let's keep the normal mode and the rainbow mode"). Normal draws in one
 * colour — the theme's cyan, or a Plus visualizer's first two colours while
 * one is chosen — and Rainbow in a palette: Lagoon, or the visualizer's five.
 * Nothing to unlock and on by default (`euphoriaMode.ts`).
 *
 * A row of the sliders' own grid, with the switch where their track stands,
 * so the three read as one set in either menu.
 */
const RainbowSwitch = () => {
  const { t } = useTranslation();
  const id = useId();
  const isOn = useIsEuphoriaEnabled();
  const name = t('graph.sceneTint.rainbow');
  return (
    <div
      className="graph-view-menu__slider graph-view-menu__slider--switch"
      title={t('graph.sceneTint.rainbowHint')}
    >
      <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
        <path d="M1.8 11a6.2 6.2 0 0 1 12.4 0" />
        <path d="M4.6 11a3.4 3.4 0 0 1 6.8 0" />
      </svg>
      <label htmlFor={id}>{name}</label>
      <span className="graph-view-menu__switch">
        <Switch
          id={id}
          isOn={isOn}
          isDisabled={false}
          handleToggle={() => setEuphoriaEnabled(!isOn)}
          ariaLabel={name}
        />
      </span>
    </div>
  );
};

export default RainbowSwitch;
