/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  IFilter,
  IHeadphoneSettings,
  TApoLayer,
  parseBandShape,
} from 'common/constants';
import { getHeadphoneFilters } from 'common/headphone';
import { IVoicingSettings, getVoicingFilters } from 'common/voicing';
import { IDriverSettings, getDriverFilters } from 'common/driver';
import { getCombinedLineData, getFilterLineData } from '../graph/utils';
import { IChartLineDataPointsById } from '../graph/ChartController';
import { ISpectrumSample, sampleSpectrumAt } from './autoBalance';

/** A band with a non-finite number cannot be turned into a biquad, and one NaN
 * anywhere poisons the whole summed curve rather than a single point. */
const isRenderable = ({
  frequency,
  gain,
  quality,
}: Pick<IFilter, 'frequency' | 'gain' | 'quality'>) =>
  Number.isFinite(frequency) &&
  Number.isFinite(gain) &&
  Number.isFinite(quality);

/**
 * The shape Smart EQ should steer the output towards, rather than flat.
 *
 * Everything in this curve is present in the capture and is NOT error. Without
 * it the measurement reads every deliberate layer as a fault and cancels it out,
 * so what belongs in here is exactly the set of things that are supposed to be
 * in the sound.
 *
 * Three things qualify, and the test is the same for all of them: could the
 * measurement possibly know better?
 *
 * A voicing is a chosen colouration. The user asked for it by name.
 *
 * A driver correction compensates the headphone, and the headphone is the one
 * thing this measurement categorically cannot see — the capture is a digital
 * loopback, so it hears the file and the chain and never the transducer. A
 * correction for something invisible to the measurement will always look like
 * error to it, and cancelling it is always wrong.
 *
 * A headset correction from the AutoEQ panel is the same argument again, with
 * one wrinkle: it is written into the ordinary band editor, where the user's own
 * edits also live. It comes in here from `headsetSignature` — the bands exactly
 * as the reference wrote them — rather than from the live bands, so what is
 * excused is the correction as applied and nothing that has happened to it
 * since.
 *
 * THE USER'S OWN BANDS ARE NOT IN HERE, and that is the one thing about this
 * file worth reading twice, because they were and it was deliberate.
 *
 * The argument for including them was that a band moved by hand is as chosen as
 * a voicing. The argument against is what it does: it makes Smart EQ blind to
 * exactly the damage it exists to fix. Pull the 47 Hz slider to -16 dB and the
 * measurement subtracts that same -16 dB from what it heard, finds no residual,
 * and reports "listening" over a chain with a hole in the bass. Push 11.6 kHz to
 * +17 dB and it is content with that too. A correction that agrees with whatever
 * it is shown is not a correction.
 *
 * So the two are separated by provenance rather than by which map they sit in:
 * the headset correction is in the goal, and the distance the user has since
 * dragged a slider away from it is error, which is exactly the distinction
 * somebody makes when they say "keep my headphone fix, undo what I did to it".
 *
 * The Smart EQ layer itself is deliberately absent. It is in the measured output
 * on purpose — that is what makes the correction a residual and what makes
 * repeated runs converge instead of doubling.
 *
 * Filters run through the same biquad magnitude code as the response graph, so
 * this is the layers' true response rather than a sketch of it.
 */
const curveOf = (
  filters: Pick<IFilter, 'frequency' | 'gain' | 'quality' | 'type'>[],
): ISpectrumSample[] => {
  const renderable = filters.filter(isRenderable);
  if (renderable.length === 0) {
    return [];
  }

  const lines: IChartLineDataPointsById = {};
  renderable.forEach((filter, index) => {
    const asFilter: IFilter = {
      id: String(index),
      frequency: filter.frequency,
      gain: filter.gain,
      quality: filter.quality,
      type: filter.type,
    };
    lines[asFilter.id] = getFilterLineData(asFilter);
  });

  return getCombinedLineData(0, lines).map((point) => ({
    frequency: point.x,
    level: point.y,
  }));
};

/**
 * What the applied chain is doing at every point of the analyser's axis, in dB.
 *
 * Subtracted from the capture, this turns "what is coming out" into "what was on
 * the record" — see `accumulateBalanceFrame`, which is where the argument for
 * doing that lives.
 *
 * EVERY layer, deliberate or not, and that is the point rather than an
 * oversight. A voicing, a headphone correction and a slider somebody dragged are
 * all equally not part of the record, so all three come out and all three then
 * sit on top of the corrected source exactly as applied — nothing has to be
 * classified, and nothing can be classified wrongly.
 *
 * Sampled onto the caller's axis rather than returned as a curve, because it is
 * subtracted point by point from an FFT frame twenty times a second.
 */
export const buildChainGainDb = (
  filters: Pick<IFilter, 'frequency' | 'gain' | 'quality' | 'type'>[],
  axis: number[],
): number[] => {
  const curve = curveOf(filters);
  if (curve.length === 0) {
    return axis.map(() => 0);
  }
  return axis.map((frequency) => sampleSpectrumAt(curve, frequency));
};

/**
 * What the solver must not try to undo — MINUS ANYTHING SWITCHED OFF.
 *
 * The bypass list is the point of the last argument, and leaving it out was a
 * fault rather than a missing nicety. A bypassed layer is not written to the
 * config, so the capture cannot contain it; summed here anyway, the solver is
 * told to expect a shape that is not in the sound. It reads the absence as
 * error and rebuilds the switched-off layer inside `smart`.
 *
 * Which turns the bypass into the opposite of what it is for. It is described
 * as an A/B switch — the same passage, both ways, a second apart — and a switch
 * that quietly recreates what it just removed cannot answer that question. The
 * chain-gain subtraction in `SmartEqEngine` already honoured this list; only its
 * partner did not, which is the shape every layer bug in this codebase has had.
 *
 * `headsetSignature` is deliberately NOT gated. It is not a layer and has no
 * switch: it describes a correction applied into the bands back when none of
 * this was a layer, so there is nothing to bypass and nothing to leave out.
 */
export const buildLayerTargetCurve = (
  voicing: IVoicingSettings | undefined,
  driver: IDriverSettings | undefined,
  headsetSignature?: string,
  headphone?: IHeadphoneSettings,
  bypassed: readonly TApoLayer[] = [],
): ISpectrumSample[] =>
  curveOf([
    ...(bypassed.includes('voicing') ? [] : getVoicingFilters(voicing)),
    ...(bypassed.includes('driver') ? [] : getDriverFilters(driver)),
    /*
     * The published correction, handed back as something not to undo.
     *
     * It corrects a transducer, and a digital loopback cannot hear a
     * transducer — so to the measurement it will always look like error, and
     * cancelling it is always wrong. Exactly the driver's argument, which is
     * why it sits beside the driver here.
     *
     * The signature below stays for corrections applied before this was a layer
     * of its own: those went into the bands, and a shape recorded at the time is
     * all that is left of them. New ones arrive here instead, in full, rather
     * than as a description reconstructed from a string.
     */
    ...(bypassed.includes('headphone') ? [] : getHeadphoneFilters(headphone)),
    ...parseBandShape(headsetSignature),
  ]);
