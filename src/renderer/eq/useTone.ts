/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, useState } from 'react';
import { ErrorDescription } from 'common/errors';
import { FLAT_TONE, ITone, toTone } from 'common/tone';
import { setTone as setToneApi } from '../utils/equalizerApi';
import { useFluidEqContext } from '../utils/FluidEqContext';

/** Low to high, the order a tone stack is read in. */
export const TONE_CONTROLS: readonly {
  knob: keyof ITone;
  labelKey: 'eq.tone.bass' | 'eq.tone.mid' | 'eq.tone.treble';
}[] = [
  { knob: 'bass', labelKey: 'eq.tone.bass' },
  { knob: 'mid', labelKey: 'eq.tone.mid' },
  { knob: 'treble', labelKey: 'eq.tone.treble' },
];

/**
 * Bass, Mid and Treble, as the layer of their own they are (`tone.ts`).
 *
 * Two surfaces show them — the EQ page with no band selected, and the
 * compact player's Tone face — and both read the window's one copy of the
 * state main keeps, so a dial turned in one stands in the other. They used to
 * be kept beside the bands in each surface and fitted into them, and a dial
 * turned in the player came back to the EQ page at its old value.
 *
 * A turn moves that copy at once, so the dial, the graph's Tone line and the
 * output curve follow the pointer, and the values are written one at a time:
 * while one write is in flight only the last values asked for are written
 * next, so a fast sweep settles where it stopped without a write per step.
 * The dial shows what it was turned to until the writes stop, and the state
 * is read back once they have, so it lands on what the files say.
 */
const useTone = () => {
  const { tone, setTone, isBlockingError, refreshState, setGlobalError } =
    useFluidEqContext();
  const [turnedTo, setTurnedTo] = useState<ITone>();
  const wanted = useRef<ITone | undefined>(undefined);
  const writing = useRef(false);

  const write = async (next: ITone) => {
    wanted.current = next;
    setTurnedTo(next);
    setTone(toTone(next));
    if (writing.current) {
      return;
    }
    writing.current = true;
    try {
      let pending: ITone | undefined = next;
      while (pending !== undefined) {
        wanted.current = undefined;
        try {
          // eslint-disable-next-line no-await-in-loop -- one write at a time is the point: the next is only the last values asked for while this one was written.
          await setToneApi(toTone(pending) ?? null);
        } catch (error) {
          setGlobalError(error as ErrorDescription);
        }
        pending = wanted.current;
      }
      await refreshState();
    } finally {
      writing.current = false;
      setTurnedTo(undefined);
    }
  };

  const shown = turnedTo ?? tone ?? FLAT_TONE;

  return {
    tone: shown,
    isDisabled: isBlockingError,
    turnTone: (knob: keyof ITone, value: number) =>
      write({ ...shown, [knob]: value }),
    resetTone: (knob: keyof ITone) => write({ ...shown, [knob]: 0 }),
  };
};

export default useTone;
