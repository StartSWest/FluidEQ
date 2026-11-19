/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export const TASKBAR_TRANSPORT_STATE = 'taskbar-transport-state';
export const TASKBAR_TRANSPORT_ACTION = 'taskbar-transport-action';

export type TTaskbarTransportAction =
  'previous' | 'toggle' | 'next' | 'surprise';

/** Only controls cross to main; player callbacks stay with their owner. */
export interface ITaskbarTransportState {
  canToggle: boolean;
  canPrevious: boolean;
  canNext: boolean;
  isPlaying: boolean;
  /**
   * Surprise me, while the Library is what plays (Ivan, 2026-11-19: "add the
   * surprise me button there also", of the taskbar's preview window).
   */
  canSurprise: boolean;
  locale: string;
  navigation: 'tracks' | 'boundaries';
}

export const isTaskbarTransportState = (
  value: unknown,
): value is ITaskbarTransportState => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const state = value as Record<string, unknown>;
  return (
    typeof state.canToggle === 'boolean' &&
    typeof state.canPrevious === 'boolean' &&
    typeof state.canNext === 'boolean' &&
    typeof state.isPlaying === 'boolean' &&
    typeof state.canSurprise === 'boolean' &&
    (state.navigation === 'tracks' || state.navigation === 'boundaries') &&
    typeof state.locale === 'string' &&
    state.locale.length <= 32
  );
};
