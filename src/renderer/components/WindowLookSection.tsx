/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import AppIconTintSwitch from '../graph/AppIconTintSwitch';
import DaylightSourceChoice from '../graph/DaylightSourceChoice';
import PointerSparksSwitch from '../graph/PointerSparksSwitch';
import SceneDaylightSlider from '../graph/SceneDaylightSlider';
import SceneWindowColours from '../graph/SceneWindowColours';
import WindowBrightnessSlider from '../graph/WindowBrightnessSlider';
import WindowColourChoice from '../graph/WindowColourChoice';
import WindowTintSlider from '../graph/WindowTintSlider';
import { useTranslation } from '../utils/I18nContext';
import { useSceneTintMode, useStudioTintSource } from '../utils/sceneTintStore';
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
 * of its own: Brightness, the colour and its second one, and the icon.
 *
 * While the Studio colours the window with the scene on its bench (Colours
 * or Ambient there, `useStudioTintSource`), the window's colours here are the
 * graph's scene's and change nothing on screen, so they are held, with a line
 * saying why (Ivan, 2026-11-18: "while I am on Ambient we should disable the
 * root menu, because I am painting the window with Ambient in the Studio";
 * on Theme the Studio paints nothing and they stay live). Brightness, the
 * time of day and the switches are the Studio's too and stay live.
 */
const WindowLookSection = () => {
  const { t } = useTranslation();
  const isSceneLook = useIsSceneLook();
  const mode = useSceneTintMode();
  const isHeldByStudio = useStudioTintSource() !== undefined;
  const heldClass = `window-look__held${isHeldByStudio ? ' is-held' : ''}`;
  return (
    <>
      {isHeldByStudio && (
        <p className="window-look__held-note">
          {t('graph.windowLook.heldByStudio')}
        </p>
      )}
      <div className="actions-menu__sliders">
        <div className={heldClass} inert={isHeldByStudio}>
          {isSceneLook && <WindowColourChoice />}
        </div>
        <WindowBrightnessSlider />
        <div className={heldClass} inert={isHeldByStudio}>
          {(!isSceneLook || mode === 'off') && <WindowTintSlider />}
        </div>
        {isSceneLook && (
          <>
            <SceneDaylightSlider />
            <DaylightSourceChoice />
          </>
        )}
        {isSceneLook && <PointerSparksSwitch />}
        <AppIconTintSwitch />
      </div>
      {isSceneLook && mode !== 'off' && (
        <div className={heldClass} inert={isHeldByStudio}>
          <SceneWindowColours />
        </div>
      )}
    </>
  );
};

export default WindowLookSection;
