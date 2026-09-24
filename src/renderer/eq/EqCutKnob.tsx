/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, useState } from 'react';
import { ErrorDescription } from 'common/errors';
import { EQ_CUT_SLOPES, TEqCut } from 'common/eqCuts';
import type { TranslationKey } from 'common/i18n';
import SteppedKnob from '../widgets/SteppedKnob';
import { setEqCut } from '../utils/equalizerApi';
import { useFluidEqContext } from '../utils/FluidEqContext';
import { useTranslation } from '../utils/I18nContext';

const LABELS: Readonly<
  Record<TEqCut, Readonly<Record<'name' | 'hint', TranslationKey>>>
> = {
  low: { name: 'eq.tone.lowCut', hint: 'eq.tone.lowCutHint' },
  high: { name: 'eq.tone.highCut', hint: 'eq.tone.highCutHint' },
};

/**
 * One of the Tone panel's two outer dials: a cut's slope, 0 for none, 12 or
 * 24 dB per octave (`eqCuts.ts`), the low cut to the left of Bass and the
 * high cut to the right of Treble, where they sit on the graph (Ivan,
 * 2026-09-23: "put lo and high cut on each side of the buttons", "5 nobs
 * needs to be").
 *
 * A dial of detents, not a sweep (`SteppedKnob`): it only ever shows and asks
 * for one of the slopes `EQ_CUT_SLOPES` offers. As a sweep stepping by twelve
 * it read and asked for every whole number on the way, which the app refuses,
 * and fell back — the "back and forward" Ivan reported the morning it shipped.
 *
 * A turn lands one slope at a time: while one is being written the dial shows
 * where it was turned to, and only the last slope asked for is written next,
 * so a quick turn across them settles on the one it stopped at.
 */
export default function EqCutKnob({ cut }: { cut: TEqCut }) {
  const { t } = useTranslation();
  const { eqCuts, isBlockingError, refreshState, setGlobalError } =
    useFluidEqContext();
  const [turnedTo, setTurnedTo] = useState<number>();
  const wanted = useRef<number | undefined>(undefined);
  const writing = useRef(false);

  const write = async (slope: number) => {
    wanted.current = slope;
    setTurnedTo(slope);
    if (writing.current) {
      return;
    }
    writing.current = true;
    try {
      let next: number | undefined = slope;
      while (next !== undefined) {
        wanted.current = undefined;
        try {
          // eslint-disable-next-line no-await-in-loop -- one slope at a time is the point: the next is only the last one asked for while this one was written.
          await setEqCut(cut, next);
        } catch (error) {
          setGlobalError(error as ErrorDescription);
        }
        if (wanted.current === undefined) {
          // eslint-disable-next-line no-await-in-loop -- read back once the writes have stopped, so the dial lands on what the files say.
          await refreshState();
        }
        next = wanted.current;
      }
    } finally {
      writing.current = false;
      setTurnedTo(undefined);
    }
  };

  return (
    <div
      className="eq-flat-editor__control eq-flat-editor__control--centred"
      title={t(LABELS[cut].hint)}
    >
      <span>{t(LABELS[cut].name)}</span>
      <SteppedKnob
        name={t(LABELS[cut].name)}
        stops={EQ_CUT_SLOPES}
        value={turnedTo ?? eqCuts?.[cut] ?? 0}
        unit="dB/oct"
        isDisabled={isBlockingError}
        defaultValue={0}
        handleChange={write}
      />
    </div>
  );
}
