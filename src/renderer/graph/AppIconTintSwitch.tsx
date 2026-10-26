/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';
import { setAppIconTinted, useIsAppIconTinted } from '../utils/appIconTint';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';

/**
 * "Tint app icon", beside Colourful mode wherever that switch stands — the
 * app menu, Window colours and the Compact player's menu — as a row of the
 * sliders' own grid (`appIconTint.ts`, `taskbarIconSync.ts`).
 */
const AppIconTintSwitch = () => {
  const { t } = useTranslation();
  const id = useId();
  const isOn = useIsAppIconTinted();
  const name = t('graph.sceneTint.appIcon');
  return (
    <div
      className="graph-view-menu__slider graph-view-menu__slider--switch"
      title={t('graph.sceneTint.appIconHint')}
    >
      <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
        <rect x="2.5" y="2.5" width="11" height="11" rx="3" />
        <path d="M5 9.3c1-2.8 2-2.8 3 0s2 2.8 3 0" />
      </svg>
      <label htmlFor={id}>{name}</label>
      <span className="graph-view-menu__switch">
        <Switch
          id={id}
          isOn={isOn}
          isDisabled={false}
          handleToggle={() => setAppIconTinted(!isOn)}
          ariaLabel={name}
        />
      </span>
    </div>
  );
};

export default AppIconTintSwitch;
