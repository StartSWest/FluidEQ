/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the engine says about one microphone, from its own status file: the
 * delay it measures stage by stage, the block Windows hands it, and how often
 * the voice cleaner fell behind. The Mic tab's delay is this, never a guess
 * from the dials (a 960-frame device block, a model that did not load or the
 * hiss reducer switched on each made the old guess wrong).
 *
 * Asked once on mount and then told of every change main sees, as the other
 * readers of engine health are.
 */

import { useEffect, useState } from 'react';
import type {
  IEngineHealth,
  IEngineOutputHealth,
} from '../../common/engineHealth';
import { reportError } from '../utils/logger';

const useMicEngineHealth = (
  guid: string | undefined,
): IEngineOutputHealth | undefined => {
  const [health, setHealth] = useState<IEngineOutputHealth>();

  useEffect(() => {
    const api = window.electron?.ipcRenderer;
    if (!guid || api === undefined) {
      setHealth(undefined);
      return undefined;
    }
    const wanted = guid.toUpperCase();
    let alive = true;
    const take = (all: IEngineHealth) => {
      if (alive) {
        setHealth(all.outputs.find((each) => each.endpoint === wanted));
      }
    };
    const stop = api.onEngineHealth?.(take);
    api
      .getEngineHealth?.()
      .then(take)
      .catch((error: unknown) =>
        reportError('reading what the engine says about a microphone', error),
      );
    return () => {
      alive = false;
      stop?.();
    };
  }, [guid]);

  return health;
};

export default useMicEngineHealth;
