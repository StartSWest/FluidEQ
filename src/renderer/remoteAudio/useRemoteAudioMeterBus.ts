/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useRef } from 'react';
import type { IRemoteAudioMeter, TRemoteAudioMeterListener } from './meter';

const useRemoteAudioMeterBus = () => {
  const subscribersRef = useRef(new Set<TRemoteAudioMeterListener>());
  const publishMeter = useCallback((meter: IRemoteAudioMeter) => {
    subscribersRef.current.forEach((listener) => listener(meter));
  }, []);
  const subscribeMeter = useCallback((listener: TRemoteAudioMeterListener) => {
    subscribersRef.current.add(listener);
    return () => subscribersRef.current.delete(listener);
  }, []);
  return { publishMeter, subscribeMeter };
};

export default useRemoteAudioMeterBus;
