import { useEffect } from 'react';
import { daylightOfShade } from '../graph/sceneDaylight';
import { useSceneLook } from '../utils/graphStyle';
import { useThemeShade } from '../utils/theme';
import { sendGraphDaylight, sendGraphLook } from './wallpaperStore';

/**
 * Which Plus visualizer the graph is showing, told to main for the monitors
 * set to follow the graph (Follow graph, on each screen of the desktop
 * settings). Said each time it changes to another Plus one — picked by the
 * listener or by the graph's automatic switching — and once when the window
 * opens. A free look on the graph says nothing: it is not one a desktop can
 * draw, and a monitor following the graph keeps the last Plus one it had.
 *
 * And the time of day the window's Brightness asks of its scenes
 * (`sceneDaylight.ts`), each time it moves and once when the window opens:
 * a monitor following the graph turns from night to day with it, and one
 * that is not keeps the hour its scene was made at (Ivan, 2026-09-28).
 */
export default function WallpaperGraphLook() {
  const lookId = useSceneLook()?.lookId;
  const daylight = daylightOfShade(useThemeShade());
  useEffect(() => {
    if (lookId) {
      sendGraphLook(lookId);
    }
  }, [lookId]);
  useEffect(() => {
    sendGraphDaylight(daylight);
  }, [daylight]);
  return null;
}
