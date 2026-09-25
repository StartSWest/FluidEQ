import { useEffect } from 'react';
import { useSceneLook } from '../utils/graphStyle';
import { sendGraphLook } from './wallpaperStore';

/**
 * Which Plus visualizer the graph is showing, told to main for the monitors
 * set to follow the graph (Follow graph, on each screen of the desktop
 * settings). Said each time it changes to another Plus one — picked by the
 * listener or by the graph's automatic switching — and once when the window
 * opens. A free look on the graph says nothing: it is not one a desktop can
 * draw, and a monitor following the graph keeps the last Plus one it had.
 */
export default function WallpaperGraphLook() {
  const lookId = useSceneLook()?.lookId;
  useEffect(() => {
    if (lookId) {
      sendGraphLook(lookId);
    }
  }, [lookId]);
  return null;
}
