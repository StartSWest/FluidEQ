import { useEffect } from 'react';
import {
  WALLPAPER_CLOCK_DAYLIGHT,
  type TWallpaperDaylight,
} from '../../common/wallpaper';
import { daylightOfShade, usePageDaylight } from '../graph/sceneDaylight';
import { useSceneLook } from '../utils/graphStyle';
import { useSceneDaylightSetting } from '../utils/sceneDaylightSetting';
import { useThemeShade } from '../utils/theme';
import {
  sendBrightnessDaylight,
  sendGraphDaylight,
  sendGraphLook,
} from './wallpaperStore';

/**
 * Which Plus visualizer the graph is showing, told to main for the monitors
 * set to follow the graph (Follow graph, on each screen of the desktop
 * settings). Said each time it changes to another Plus one — picked by the
 * listener or by the graph's automatic switching — and once when the window
 * opens. A free look on the graph says nothing: it is not one a desktop can
 * draw, and a monitor following the graph keeps the last Plus one it had.
 *
 * And the time of day the window asks of its scenes (`sceneDaylight.ts`:
 * the Brightness's, or the one set apart from it), each time it moves and
 * once when the window opens: a monitor following the graph turns from night
 * to day with it, and one that is not keeps the hour its scene was made at
 * (Ivan, 2026-09-28). Following the clock, the monitors are told so once and
 * read the clock themselves (`TWallpaperDaylight`): a window minimised draws
 * nothing, and would have left them at the hour it was minimised.
 *
 * And the window's Brightness as a time of day, whatever the graph's follows,
 * for the monitors set to follow Brightness on their own.
 */
export default function WallpaperGraphLook() {
  const lookId = useSceneLook()?.lookId;
  const pageDaylight = usePageDaylight();
  const { source } = useSceneDaylightSetting();
  const daylight: TWallpaperDaylight =
    source === 'clock' ? WALLPAPER_CLOCK_DAYLIGHT : pageDaylight;
  useEffect(() => {
    if (lookId) {
      sendGraphLook(lookId);
    }
  }, [lookId]);
  useEffect(() => {
    sendGraphDaylight(daylight);
  }, [daylight]);
  const brightness = daylightOfShade(useThemeShade());
  useEffect(() => {
    sendBrightnessDaylight(brightness);
  }, [brightness]);
  return null;
}
