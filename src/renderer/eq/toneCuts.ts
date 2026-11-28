/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Translate } from 'common/i18n';
import type { IEqCuts } from '../../common/constants';
import {
  EQ_CUT_FREQUENCIES,
  EQ_CUTS,
  hasEqCut,
  TEqCut,
} from '../../common/eqCuts';
import { hasTone, ITone } from '../../common/tone';
import frequencyText from '../utils/frequencyText';
import { setEqCut } from '../utils/equalizerApi';

/**
 * THE TONE TAB HOLDS THE CUTS TOO (Ivan, 2026-11-16: "the cuts need to also
 * get on tone"). The low and high cut stand on the Tone tab beside Bass, Mid
 * and Treble, but they are a file of their own (`eqCuts.ts`), and everything
 * that said whether the Tone was in use read the three dials alone: his output
 * cut at 20 Hz, 12 dB/oct, and the tab said Off. These say it for the five.
 */

const CUT_NAMES: Readonly<
  Record<TEqCut, 'eq.tone.lowCut' | 'eq.tone.highCut'>
> = {
  low: 'eq.tone.lowCut',
  high: 'eq.tone.highCut',
};

const activeCuts = (cuts: IEqCuts | undefined): TEqCut[] =>
  cuts ? EQ_CUTS.filter((cut) => cuts[cut] > 0) : [];

/** Whether anything on the Tone tab changes the sound: a dial, or a cut. */
export const isToneInUse = (
  tone: ITone | undefined,
  cuts: IEqCuts | undefined,
): boolean => hasTone(tone) || hasEqCut(cuts);

/** Where the cuts that are on stand, "20 Hz · 20 kHz"; undefined for none. */
export const cutCorners = (cuts: IEqCuts | undefined): string | undefined => {
  const on = activeCuts(cuts);
  return on.length > 0
    ? on.map((cut) => frequencyText(EQ_CUT_FREQUENCIES[cut])).join(' · ')
    : undefined;
};

/** Each cut that is on, by its dial's name and slope: "Low cut 12 dB/oct". */
export const cutNames = (cuts: IEqCuts | undefined, t: Translate): string[] =>
  activeCuts(cuts).map(
    (cut) => `${t(CUT_NAMES[cut])} ${cuts?.[cut] ?? 0} dB/oct`,
  );

/** Both cuts off, writing only the ones that are on. */
export const clearEqCuts = async (cuts: IEqCuts | undefined) => {
  await Promise.all(activeCuts(cuts).map((cut) => setEqCut(cut, 0)));
};

/**
 * Reset Tone, on the EQ page and in the amp alike: the three dials flat and
 * every cut off, written together.
 */
export const resetToneAndCuts = async (
  resetAllTone: () => Promise<void>,
  cuts: IEqCuts | undefined,
) => {
  await Promise.all([resetAllTone(), clearEqCuts(cuts)]);
};
