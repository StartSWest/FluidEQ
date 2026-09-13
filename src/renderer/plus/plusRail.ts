import { useSyncExternalStore } from 'react';
import { createFlagSetting } from '../utils/graphStorage';

/**
 * Whether the Plus tab's rail is pinned open beside the place, or folded to
 * its column of pictures, opening over the place while the pointer is on it.
 *
 * Pinned at first, which is the rail as it has always been; remembered,
 * because somebody who folded it away to give the gallery or the Studio the
 * room wants that room again next time.
 */
const pinnedSetting = createFlagSetting('fluideq.plusRailPinned', true);

export const setPlusRailPinned = (next: boolean) => pinnedSetting.set(next);

export const usePlusRailPinned = () =>
  useSyncExternalStore(pinnedSetting.subscribe, pinnedSetting.get, () => true);
