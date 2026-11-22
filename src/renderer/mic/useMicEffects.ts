/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Windows' "Audio enhancements" switch for the mic on screen. Off, Windows
 * loads no effect on the mic and the engine is never created there, however
 * it is attached; the page says so rather than waiting for an engine that
 * will not come. Asked again whenever the mic or the engine's status changes,
 * which is when someone may just have been to Windows' settings and back.
 */

import { useEffect, useState } from 'react';
import type { TMicEffects } from '../../common/micSound';
import { reportError } from '../utils/logger';
import { getMicEffects } from '../utils/micSoundApi';

const useMicEffects = (guid: string | undefined, asked: unknown) => {
  const [effects, setEffects] = useState<TMicEffects>('unknown');
  useEffect(() => {
    if (!guid) {
      setEffects('unknown');
      return undefined;
    }
    let alive = true;
    getMicEffects(guid)
      .then((answer) => {
        if (alive) {
          setEffects(answer);
        }
        return undefined;
      })
      .catch((error: unknown) =>
        reportError('reading a microphone’s enhancements', error),
      );
    return () => {
      alive = false;
    };
  }, [guid, asked]);
  return effects;
};

export default useMicEffects;
