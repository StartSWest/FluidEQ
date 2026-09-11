/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Fired on `window` when the live capture starts hearing sound after silence,
 * or hears it in its first frame.
 *
 * Only the edge, never every frame: a listener is told once per stretch of
 * sound, at the moment it began. `context` names the capture that heard it,
 * so a listener can tell a stale capture's edge from the running one's.
 *
 * It exists because hearing sound on an output is the one moment the app can
 * know Windows is playing through it — and so the moment a FluidEQ Engine
 * that should be there, and is not, can be told apart from one that simply
 * has nothing to do. See `useEngineTrouble`.
 */
export const OUTPUT_SIGNAL_EVENT = 'fluideq-output-signal';

export interface IOutputSignalDetail {
  context: AudioContext;
}

/**
 * Frame by frame, whether this frame is where sound began. One per capture:
 * it starts out having heard nothing, so sound in the very first frame is an
 * edge too. Every frame of a long stretch announced instead would be a read
 * of the disk and a device listing thirty times a second.
 */
export const createSignalEdge = () => {
  let wasHearing = false;
  return (isHearing: boolean): boolean => {
    const isEdge = isHearing && !wasHearing;
    wasHearing = isHearing;
    return isEdge;
  };
};

export const announceOutputSignal = (context: AudioContext): void => {
  window.dispatchEvent(
    new CustomEvent<IOutputSignalDetail>(OUTPUT_SIGNAL_EVENT, {
      detail: { context },
    }),
  );
};
