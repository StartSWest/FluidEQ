/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useMemo, type CSSProperties } from 'react';
import TintIcon from '../icons/TintIcon';
import { useTranslation } from '../utils/I18nContext';
import { sceneTintSwatch } from '../utils/sceneTint';
import {
  SCENE_TINT_MODE_ABOUT,
  SCENE_TINT_MODE_SHORT_NAMES,
  SCENE_TINT_MODES,
  setSceneTintMode,
  useSceneTintMode,
  useShownSceneSky,
} from '../utils/sceneTintStore';
import Dropdown from '../widgets/Dropdown';

/**
 * What a Plus visualizer does to the window, as a named menu: the mode it is
 * in on the button, and all four in the list with what each one does.
 *
 * It was a glyph walking the four (`SceneTintToggle`, which the player's
 * corner keys still are), and a glyph that cycles keeps three of its four
 * choices behind presses nobody knows to make: Ivan found Ambient itself
 * easy to miss (2026-09-25, "a tiny icon that can pass desapercibido").
 * Named, the button says what the window is doing; opened, the list says what
 * else it can do, each mode's glyph filled with this visualizer's colour.
 *
 * Never disabled: the colour and the beat change the whole window whether or
 * not the wave is on the plot, and a control that could only be turned off
 * while something else was on would be a trap.
 */
const SceneTintMenu = () => {
  const { t } = useTranslation();
  const mode = useSceneTintMode();
  const sky = useShownSceneSky();
  const swatch = sky ? sceneTintSwatch(sky) : undefined;
  const heading = t('graph.sceneTint.label');
  const options = useMemo(() => {
    // On every choice, not only the one in use: the list is where the colour
    // each mode would lend is shown before it is picked.
    const style = swatch
      ? ({ '--scene-tint-swatch': swatch } as CSSProperties)
      : undefined;
    return SCENE_TINT_MODES.map((entry) => {
      const name = t(SCENE_TINT_MODE_SHORT_NAMES[entry]);
      return {
        value: entry,
        label: name,
        group: heading,
        display: (
          <span className="scene-tint-choice" style={style}>
            <TintIcon className="scene-tint-choice__glyph" mode={entry} />
            <span className="scene-tint-choice__name">{name}</span>
            <span className="scene-tint-choice__about">
              {t(SCENE_TINT_MODE_ABOUT[entry])}
            </span>
          </span>
        ),
      };
    });
  }, [heading, swatch, t]);
  return (
    <Dropdown
      name={heading}
      className={`graph-scene-look${mode === 'off' ? '' : ' is-on'}`}
      menuClassName="graph-scene-look-menu"
      options={options}
      value={mode}
      isDisabled={false}
      placement="down"
      handleChange={(value) => {
        const next = SCENE_TINT_MODES.find((entry) => entry === value);
        if (next) {
          setSceneTintMode(next);
        }
      }}
    />
  );
};

export default SceneTintMenu;
