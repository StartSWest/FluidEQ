/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  type IMeasurementView,
  NO_MEASUREMENT_VIEW,
} from 'common/smartEqMeasurement';

/**
 * What the graph draws of the Smart EQ measurement running in the app's core
 * (`main/smartEq/smartEqRunner.ts`): its progress and each range's levels,
 * as the core last told them (`SmartEqEngine`).
 */
let view: IMeasurementView = NO_MEASUREMENT_VIEW;
const listeners = new Set<() => void>();

export const showSmartEqMeasurement = (next: IMeasurementView) => {
  view = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const read = () => view;

export const useSmartEqMeasurement = (): IMeasurementView =>
  useSyncExternalStore(subscribe, read, read);
