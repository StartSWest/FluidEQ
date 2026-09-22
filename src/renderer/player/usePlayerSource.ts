/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { usePlaybackOwner } from '../audio/playbackOwner';
import {
  ITransportSource,
  useLastTransportOwner,
  useTransportSources,
} from '../audio/transportSource';
import pickTransportOwner from '../audio/transportRouting';

/**
 * What the player plays and shows: whatever is making sound, else what made
 * it last — the bar's own rule (`pickTransportOwner`), asked without a tab,
 * because the player has no page open: it is the one place every source
 * shows up in.
 */
const usePlayerSource = (): ITransportSource | undefined => {
  const sources = useTransportSources();
  const playingOwner = usePlaybackOwner();
  const lastOwner = useLastTransportOwner();
  const owner = pickTransportOwner(undefined, sources, playingOwner, lastOwner);
  return owner === undefined ? undefined : sources[owner];
};

export default usePlayerSource;
