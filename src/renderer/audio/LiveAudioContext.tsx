/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { createContext, ReactNode, useContext, useEffect, useRef } from 'react';
import useLiveOutputSpectrum from '../graph/useLiveOutputSpectrum';
import { useFluidEqContext } from '../utils/FluidEqContext';

type LiveAudioValue = ReturnType<typeof useLiveOutputSpectrum>;

/**
 * Two contexts, not one, because the analyser publishes at two completely
 * different rates.
 *
 * The frame context carries what the pump produces ~22 times a second. The
 * control context carries the capture's status and API, which change only when
 * it starts, stops, pauses or fails. Served from a single context, every
 * consumer re-rendered at frame rate regardless of which field it read — most
 * expensively MainContent, which reads two values that never change and
 * re-renders every band in the layout when it does.
 */
const LiveAudioFrameContext = createContext<
  LiveAudioValue['frame'] | undefined
>(undefined);
const LiveAudioControlContext = createContext<
  LiveAudioValue['control'] | undefined
>(undefined);

export const LiveAudioProvider = ({ children }: { children: ReactNode }) => {
  const { control, frame } = useLiveOutputSpectrum();
  const { isEnabled } = useFluidEqContext();
  const wasEngineEnabledRef = useRef(isEnabled);

  useEffect(() => {
    const wasEngineEnabled = wasEngineEnabledRef.current;
    wasEngineEnabledRef.current = isEnabled;

    if (!wasEngineEnabled && isEnabled) {
      // Equalizer APO changing state can invalidate or mute Windows' loopback
      // stream. The analyser retries while that happens, but those attempts can
      // all be spent before the engine comes back. Re-enabling it is fresh
      // evidence that capture can work again, so restore the attempts and start
      // immediately. `retry` is harmless when the old stream survived: `start`
      // sees that stream and returns without opening a second capture.
      control.retry().catch(() => undefined);
    }
  }, [control, isEnabled]);

  return (
    <LiveAudioControlContext.Provider value={control}>
      {/* `children` keeps its identity across the provider's own re-renders,
          so React skips the subtree and only context consumers wake up. */}
      <LiveAudioFrameContext.Provider value={frame}>
        {children}
      </LiveAudioFrameContext.Provider>
    </LiveAudioControlContext.Provider>
  );
};

/** Per-frame analyser output. Re-renders the caller ~22 times a second. */
export const useLiveAudioFrame = () => {
  const value = useContext(LiveAudioFrameContext);
  if (!value) {
    throw new Error('useLiveAudioFrame must be used inside LiveAudioProvider');
  }
  return value;
};

/** Capture status and controls. Re-renders the caller only when they change. */
export const useLiveAudioControl = () => {
  const value = useContext(LiveAudioControlContext);
  if (!value) {
    throw new Error(
      'useLiveAudioControl must be used inside LiveAudioProvider',
    );
  }
  return value;
};
