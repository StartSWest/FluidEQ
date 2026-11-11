/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { TTourPart } from '../../../common/featureTour';

type TListener = (part: TTourPart) => void;

const listeners = new Set<TListener>();

/**
 * Opens What's New on one of its halves from anywhere in the window: the
 * Studio asks for its own news, which the shell's dialogs own.
 */
export const requestFeatureTour = (part: TTourPart) => {
  listeners.forEach((listener) => listener(part));
};

export const onFeatureTourRequest = (listener: TListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
