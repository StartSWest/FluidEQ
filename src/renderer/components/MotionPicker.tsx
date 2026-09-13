/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useEffect, useMemo, useState } from 'react';
import type { IMotionPreferenceState } from 'main/ipc/motionPreference';
import type { TMotionPreference } from 'main/motionPreference';
import MenuIcon from '../icons/MenuIcon';
import { prefersReducedMotion } from '../utils/bandReveal';
import { useTranslation } from '../utils/I18nContext';
import Dropdown from '../widgets/Dropdown';

const CHOICES: readonly TMotionPreference[] = ['full', 'reduced'];

const bridge = () => window.electron?.ipcRenderer;

// The last answer from main, kept while the menu is closed so reopening it
// shows a choice made earlier in this session straight away.
let known: IMotionPreferenceState | undefined;

/**
 * Before main has answered: what this window runs is exactly what it was
 * launched with, since the launch switch is what `prefers-reduced-motion`
 * reports — so the row is complete from the menu's first frame instead of
 * appearing a frame after it.
 */
const running = (): IMotionPreferenceState => {
  const motion: TMotionPreference = prefersReducedMotion() ? 'reduced' : 'full';
  return { chosen: motion, atLaunch: motion };
};

/**
 * Whether the app animates, in the tools menu beside the theme and the
 * language: the app's own choice rather than Windows' "Animation effects",
 * which turned every motion here off for everybody who had switched it off
 * for a faster desktop (`main/motionPreference.ts`). Reduced is there for the
 * people motion troubles.
 *
 * It takes effect from the next start — it is how the window is launched —
 * and says so while the choice and the running window disagree.
 */
const MotionPicker = () => {
  const { t } = useTranslation();
  const [state, setState] = useState<IMotionPreferenceState>(
    () => known ?? running(),
  );

  useEffect(() => {
    let current = true;
    bridge()
      ?.motionPreference?.()
      .then((next) => {
        known = next;
        if (current) {
          setState(next);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, []);

  const options = useMemo(
    () =>
      CHOICES.map((entry) => {
        const label = t(`motion.${entry}`);
        return { value: entry, label, display: label };
      }),
    [t],
  );

  return (
    <div className="language-picker motion-picker">
      <MenuIcon name="motion" />
      <Dropdown
        name={t('motion.aria')}
        menuClassName="language-picker-menu"
        options={options}
        value={state.chosen}
        handleChange={(next) => {
          bridge()
            ?.setMotionPreference?.(next as TMotionPreference)
            .then((saved) => {
              known = saved;
              setState(saved);
              return undefined;
            })
            .catch(() => undefined);
        }}
        isDisabled={false}
        placement="down"
      />
      {state.chosen !== state.atLaunch && (
        <span className="motion-picker__restart" role="status">
          {t('motion.restart')}
        </span>
      )}
    </div>
  );
};

export default MotionPicker;
