/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import AppIconTintSwitch from '../graph/AppIconTintSwitch';
import DaylightSourceChoice from '../graph/DaylightSourceChoice';
import PointerSparksSwitch from '../graph/PointerSparksSwitch';
import RainbowSwitch from '../graph/RainbowSwitch';
import SceneDaylightSlider from '../graph/SceneDaylightSlider';
import SceneWindowColours from '../graph/SceneWindowColours';
import WindowBrightnessSlider from '../graph/WindowBrightnessSlider';
import WindowColourChoice from '../graph/WindowColourChoice';
import WindowTintSlider from '../graph/WindowTintSlider';
import { useSceneTintMode } from '../utils/sceneTintStore';
import useIsSceneLook from '../utils/useIsSceneLook';

/**
 * EVERYTHING ABOUT HOW THE WINDOW LOOKS, in the actions menu's tray and
 * nowhere else (Ivan, 2026-11-16: "we can remove the options from the graph
 * since they will exist only on the app main menu"). It was split between
 * this tray and the graph's Window colours menu, which only a Plus
 * visualizer had and which sat on the graph alone.
 *
 * With a Plus visualizer: the window's colours (Original, Colours or
 * Ambient), Brightness, the app's own colour while the window is Original,
 * the scene's time of day and what it follows, and the switches;
 * under them, while the window wears the scene's colours, those three
 * colours themselves. With a standard look, which has no colours or picture
 * of its own: Brightness, the colour, Rainbow and the icon.
 */
const WindowLookSection = () => {
  const isSceneLook = useIsSceneLook();
  const mode = useSceneTintMode();
  return (
    <>
      <div className="actions-menu__sliders">
        {isSceneLook && <WindowColourChoice />}
        <WindowBrightnessSlider />
        {(!isSceneLook || mode === 'off') && <WindowTintSlider />}
        {isSceneLook && (
          <>
            <SceneDaylightSlider />
            <DaylightSourceChoice />
          </>
        )}
        <RainbowSwitch />
        {isSceneLook && <PointerSparksSwitch />}
        <AppIconTintSwitch />
      </div>
      {isSceneLook && mode !== 'off' && <SceneWindowColours />}
    </>
  );
};

export default WindowLookSection;
