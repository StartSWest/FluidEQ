/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IState } from '../common/constants';
import { clampDspSettings, type IDspSettings } from '../common/dsp/chain';
import { DSP_DEFAULTS } from '../common/dsp/chainDefaults';
import type { IMainSession } from './mainSession';

/**
 * The edited output's two racks: the one it plays and the one it owns.
 *
 * They are the same rack except while something lends the output another —
 * a song's remembered sound (`songSoundSession.ts` in the window), whose
 * rack plays while the profile keeps the listener's own. What plays is
 * `session.outputDspOverrides`; what is owned is `state.dsp`, which every
 * profile save writes down.
 */

/** Whether the output plays a rack it does not own. */
export const ownsTemporaryRack = (
  state: IState,
  audible: IDspSettings | undefined,
): boolean =>
  audible !== undefined &&
  (state.songSoundLoan !== undefined ||
    JSON.stringify(audible) !== JSON.stringify(state.dsp));

/** The rack the edited output plays now, as a picker starts from it. */
export const playingRack = (state: IState, session: IMainSession) =>
  clampDspSettings(
    session.outputDspOverrides?.get(session.activeAudioDeviceId) ??
      state.dsp ??
      DSP_DEFAULTS,
  );

/**
 * Put a rack on the edited output: heard at once, and the output's own
 * unless a rack is lent to it — then it stays lent, as the window's picker
 * left it, and the listener's own comes back when the loan ends.
 */
export const putRackOn = (
  state: IState,
  session: IMainSession,
  rack: IDspSettings,
): void => {
  const deviceId = session.activeAudioDeviceId;
  const lent = ownsTemporaryRack(
    state,
    session.outputDspOverrides?.get(deviceId),
  );
  session.outputDspOverrides ??= new Map();
  session.outputDspOverrides.set(deviceId, rack);
  if (!lent) {
    state.dsp = rack;
  }
};
