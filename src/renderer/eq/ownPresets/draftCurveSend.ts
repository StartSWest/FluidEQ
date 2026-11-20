/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IEqSettings } from '../../../common/dsp/chain';
import { setVoicing as setVoicingApi } from '../../utils/equalizerApi';

/**
 * The draft curve's way to the engine: one write in flight, the newest curve
 * waiting behind it, as the graph's own drags go (`flushPointEdit`). A drag
 * moves a band on every pointer event and each write ends in main rewriting
 * the engine's config, so they cannot all go; main's reply is what says the
 * next may go, never a clock.
 */

interface IDraftSend {
  profileId: string;
  curve: IEqSettings;
  onError: (error: unknown) => void;
}

let waiting: IDraftSend | undefined;
let running: Promise<void> | undefined;

const pump = async () => {
  try {
    while (waiting) {
      const next = waiting;
      waiting = undefined;
      try {
        // eslint-disable-next-line no-await-in-loop -- one write in flight is the point: each waits for the one before it to land
        await setVoicingApi(next.profileId, 1, next.curve);
      } catch (error) {
        next.onError(error);
      }
    }
  } finally {
    // Cleared in the same turn the loop ends, so a curve queued straight
    // after starts a pump of its own rather than waiting on this one.
    running = undefined;
  }
};

export const queueDraftCurve = (send: IDraftSend) => {
  waiting = send;
  running = running ?? pump();
};

/**
 * Wait for the write on the wire. `dropWaiting` throws away the curve behind
 * it — Discard, which is about to put back another layer — where Save lets it
 * go first, so what is kept is what was last heard.
 */
export const settleDraftCurve = (dropWaiting: boolean): Promise<void> => {
  if (dropWaiting) {
    waiting = undefined;
  }
  return running ?? Promise.resolve();
};
