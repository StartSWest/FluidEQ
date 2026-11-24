/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The mic maker's own effects for the Mic tab: where they stand, read from
 * the engine's status, and the press that takes them off or puts them back.
 * Each press is a Windows prompt; a declined one changes nothing and says
 * so, and the status is read again after every press that went through.
 */

import { useEffect, useRef, useState } from 'react';
import type { IFluidEngineMicrophone } from '../../common/audioEngine';
import { setMicOwnEffects } from '../utils/audioEngineApi';
import { reportError } from '../utils/logger';
import { refreshAudioEngineStatus } from '../utils/useAudioEngineStatus';
import { micOwnEffects, TOwnEffectsPress } from './MicOwnEffectsCard';

const useMicOwnEffects = (mic: IFluidEngineMicrophone | undefined) => {
  const [press, setPress] = useState<TOwnEffectsPress>('idle');
  const guid = mic?.guid;
  // The mic on the tab now, for an answer that lands after it changed.
  const current = useRef(guid);

  // Another mic's last answer is not this one's.
  useEffect(() => {
    current.current = guid;
    setPress('idle');
  }, [guid]);

  const state = mic
    ? micOwnEffects(mic)
    : { on: false, effects: [], known: false };

  const switchTo = (on: boolean) => {
    if (!guid || press === 'working') {
      return;
    }
    setPress('working');
    const settle = (next: TOwnEffectsPress) => {
      if (current.current === guid) {
        setPress(next);
      }
    };
    const run = async (): Promise<TOwnEffectsPress> => {
      const result = await setMicOwnEffects(guid, on);
      if (!result.ok) {
        return result.declined ? 'declined' : 'failed';
      }
      // Working until the new reading is in, or the card would show the
      // old state as finished for the moment the reading takes.
      await refreshAudioEngineStatus();
      return 'idle';
    };
    run()
      .then(settle)
      .catch((error: unknown) => {
        reportError('switching a microphone’s own effects', error);
        settle('failed');
      });
  };

  return {
    press,
    state,
    /** Whether the switch can do anything: known, and something to switch. */
    available: state.known && state.effects.length > 0 && press !== 'working',
    switchTo,
  };
};

export default useMicOwnEffects;
