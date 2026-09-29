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

import ChannelEnum from 'common/channels';
import {
  FilterTypeEnum,
  FixedBandSizeEnum,
  IFilterEdit,
  IFiltersMap,
  ISmartEqSettings,
  IState,
  MAX_FREQUENCY,
  MAX_QUALITY,
  MIN_FREQUENCY,
  MIN_QUALITY,
  TApoLayer,
  clampGain,
  clampPreAmp,
} from 'common/constants';
import { type ISongIdentity } from 'common/songIdentity';
import { type ISongEqEntry } from 'common/songEq';
import { type ITone } from 'common/tone';
import {
  sendRequest,
  setterResponseHandler,
  simpleResponseHandler,
} from './ipcRequest';

// The requests that edit the EQ: the preamp, each band, the layers over
// the bands, a song's remembered curve, the mode and shape, the cuts, the
// Tone and each layer's bypass. equalizerApi.ts re-exports all of it.

/**
 * Get the current main preamplification gain value
 * @deprecated - Removing with the context refactor
 * @returns { Promise<number> } gain - current system gain value, [-60, 20]
 */
export const getMainPreAmp = (): Promise<number> => {
  const channel = ChannelEnum.GET_PREAMP;
  return sendRequest(channel, [], simpleResponseHandler<number>());
};

/**
 * Adjusts the main preamplification gain value
 * @param {number} gain - new gain value, brought into [-60, 20]
 *
 * Clamped rather than rejected, and it used to throw.
 *
 * Throwing was defensible when every caller was a slider, because a slider
 * cannot produce an out-of-range number and one that did was a bug worth
 * hearing about. It is not defensible now that the largest caller is derived:
 * auto normalize computes this from the whole chain, five layers deep, and a
 * chain wanting more headroom than the range allows is an ordinary thing rather
 * than a fault. What the throw did with it was take the app away — the call
 * happens in an effect on mount, so the failure arrived before anything was on
 * screen and returned on every restart, because the chain that caused it is on
 * disk. The user could not even reach the sliders to undo it.
 *
 * The boundary is the honest answer in both cases, and it is the PREAMP's, not
 * a band's: `clampPreAmp` reaches -60 dB, where `clampGain` stopped at -20 and
 * so cancelled nothing deeper than one fully boosted band. A headphone
 * correction plays as published now, past ±20 dB, and the level that cancels
 * it has to be able to follow it down — otherwise the reserve is smaller than
 * what is being reserved against and the output clips by construction (Ivan,
 * 2026-09-23: "manual yes -60"). Auto normalize already reached -60; this is
 * the hand-set one catching up. Nothing here is silently wrong: the value
 * written is the value shown.
 */
export const setMainPreAmp = (gain: number) => {
  const channel = ChannelEnum.SET_PREAMP;
  return sendRequest(channel, [clampPreAmp(gain)], setterResponseHandler);
};

/**
 * Adjusts a slider's gain value
 * @param {string} filterId - id of the slider being adjusted
 * @param {number} gain - new gain value, brought into [-20, 20]
 *
 * Clamped for the same reason as `setMainPreAmp`: a band that has ended up
 * outside the range must come back to the edge of it, because a band that
 * refuses every write is a band nobody can drag back.
 */
export const setGain = (filterId: string, gain: number) => {
  const channel = ChannelEnum.SET_FILTER_GAIN;
  return sendRequest(
    channel,
    [filterId, clampGain(gain)],
    setterResponseHandler,
    { replyChannel: channel + filterId },
  );
};

/**
 * Adjusts a slider's frequency
 * @param {string} filterId - id of the slider being adjusted
 * @param {frequency} frequency - new frequency value in [0, 20000]
 */
export const setFrequency = (filterId: string, frequency: number) => {
  const channel = ChannelEnum.SET_FILTER_FREQUENCY;
  if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) {
    throw new Error(
      `Invalid frequency value - outside of range [${MIN_FREQUENCY}, ${MAX_FREQUENCY}]`,
    );
  }
  return sendRequest(channel, [filterId, frequency], setterResponseHandler, {
    replyChannel: channel + filterId,
  });
};

/**
 * Adjusts a slider's quality
 * @param {string} filterId - id of the slider being adjusted
 * @param {number} quality - new quality value in [0.01, 33.3333]
 */
export const setQuality = (filterId: string, quality: number) => {
  const channel = ChannelEnum.SET_FILTER_QUALITY;
  if (quality < MIN_QUALITY || quality > MAX_QUALITY) {
    throw new Error(
      `Invalid quality value - outside of range [${MIN_QUALITY}, ${MAX_QUALITY}]`,
    );
  }
  return sendRequest(channel, [filterId, quality], setterResponseHandler, {
    replyChannel: channel + filterId,
  });
};

/**
 * Get a slider's filter type
 * @deprecated - Removing with the context refactor
 * @param {string} filterId - id of the slider being adjusted
 * @returns { Promise<FilterTypeEnum> } filter type - value in FilterTypeEnum
 */
export const getType = (filterId: string): Promise<FilterTypeEnum> => {
  const channel = ChannelEnum.GET_FILTER_TYPE;
  return sendRequest<FilterTypeEnum>(
    channel,
    [filterId],
    simpleResponseHandler<FilterTypeEnum>(),
    { replyChannel: channel + filterId },
  );
};

/**
 * Adjusts a slider's filter type
 * @param {string} filterId - id of the slider being adjusted
 * @param {string} filterType - new filter type
 */
export const setType = (filterId: string, filterType: string) => {
  const channel = ChannelEnum.SET_FILTER_TYPE;
  return sendRequest(channel, [filterId, filterType], setterResponseHandler, {
    replyChannel: channel + filterId,
  });
};

/**
 * Change several bands at once, at the cost of changing one
 * @param {IFilterEdit[]} edits - one entry per band, carrying only the fields that move
 * @returns { Promise<void> } exception if failed, or if any edit is invalid
 */
export const setFilterValues = (edits: IFilterEdit[]) => {
  const channel = ChannelEnum.SET_FILTER_VALUES;
  // The reply is keyed on the bare channel rather than on a band id, because
  // the batch has no single band to name. One group edit may therefore be in
  // flight at a time — which is what the caller wants anyway: two overlapping
  // batches over the same selection would race to write the same config.
  return sendRequest(channel, [edits], setterResponseHandler);
};

/**
 * Add another slider
 * @param {number} frequency - frequency of the new slider
 * @returns { Promise<void> } exception if failed
 */
export const addEqualizerSlider = (frequency: number): Promise<string> => {
  const channel = ChannelEnum.ADD_FILTER;
  return sendRequest(channel, [frequency], simpleResponseHandler<string>());
};

/**
 * Remove slider
 * @param {string} filterId - id of the slider to be removed
 * @returns { Promise<void> } exception if failed
 */
export const removeEqualizerSlider = (filterId: string): Promise<void> => {
  const channel = ChannelEnum.REMOVE_FILTER;
  return sendRequest(channel, [filterId], setterResponseHandler);
};

/**
 * Reset the EQ to the default neutral ten-band layout
 * @returns { Promise<IFiltersMap> } the restored filters, exception if failed
 */
export const clearGains = (): Promise<IFiltersMap> => {
  const channel = ChannelEnum.CLEAR_GAINS;
  return sendRequest<IFiltersMap>(
    channel,
    [],
    simpleResponseHandler<IFiltersMap>(),
  );
};

/**
 * Apply a curated voicing as its own APO layer, leaving the EQ bands alone
 * @param { string } profileId - empty string removes the layer
 * @param { number } intensity - 0..1 scale on the profile's gains
 * @returns { Promise<void> } exception if failed
 */
export const setVoicing = (
  profileId: string,
  intensity: number,
  dspEq?: import('../../common/dsp/chain').IEqSettings,
): Promise<void> => {
  const channel = ChannelEnum.SET_VOICING;
  return sendRequest(
    channel,
    dspEq ? [profileId, intensity, dspEq] : [profileId, intensity],
    setterResponseHandler,
  );
};

/**
 * Select the driver-family correction layer.
 * @param {string} profileId - profile to apply, or '' for none
 * @param {number} intensity - 0..1 scale over the profile's gains
 * @returns { Promise<void> } exception if the profile is unknown.
 */
/**
 * How much of the published headphone correction to apply, or none at all.
 *
 * `undefined` clears the layer. Only the strength is sent — the filters came
 * from a measurement and are not the renderer's to rewrite.
 */
export const setHeadphone = (intensity?: number): Promise<void> => {
  const channel = ChannelEnum.SET_HEADPHONE;
  return sendRequest(channel, [intensity], setterResponseHandler);
};

export const setDriver = (
  profileId: string,
  intensity: number,
): Promise<void> => {
  const channel = ChannelEnum.SET_DRIVER;
  return sendRequest(channel, [profileId, intensity], setterResponseHandler);
};

/**
 * Store what Smart EQ measured, as its own layer.
 *
 * Deliberately not routed through setGain: this correction is not made of the
 * user's bands and must never overwrite them.
 * @param { ISmartEqSettings } settings - the measured layer, or undefined to remove it
 * @returns { Promise<void> } exception if the payload is not a layer
 */
export const setSmartEq = (settings?: ISmartEqSettings): Promise<void> => {
  const channel = ChannelEnum.SET_SMART_EQ;
  return sendRequest(channel, [settings], setterResponseHandler);
};

/**
 * What this output remembers about a song, if anything.
 * @param { string } deviceId - the active output
 * @param { ISongIdentity } identity - what is playing
 * @returns { Promise<ISongEqEntry | undefined> } the saved curve, or nothing
 */
export const lookupSongEq = (
  deviceId: string,
  identity: ISongIdentity,
): Promise<ISongEqEntry | undefined> => {
  const channel = ChannelEnum.LOOKUP_SONG_EQ;
  return sendRequest(
    channel,
    [deviceId, identity],
    simpleResponseHandler<ISongEqEntry | undefined>(),
  );
};

/**
 * Write what has been learned so far, without counting it as a play.
 * @param { string } deviceId - the active output
 * @param { ISongIdentity } identity - what is playing
 * @param { ISmartEqSettings } layer - the correction as it stands
 * @returns { Promise<void> } exception if the payload is not a layer
 */
export const checkpointSongEq = (
  deviceId: string,
  identity: ISongIdentity,
  layer: ISmartEqSettings,
): Promise<void> => {
  const channel = ChannelEnum.CHECKPOINT_SONG_EQ;
  return sendRequest(
    channel,
    [deviceId, identity, layer],
    setterResponseHandler,
  );
};

/**
 * Write the finished curve and count the play.
 * @param { string } deviceId - the active output
 * @param { ISongIdentity } identity - what was playing
 * @param { ISmartEqSettings } layer - the correction as it ended
 * @returns { Promise<void> } exception if the payload is not a layer
 */
export const commitSongEq = (
  deviceId: string,
  identity: ISongIdentity,
  layer: ISmartEqSettings,
): Promise<void> => {
  const channel = ChannelEnum.COMMIT_SONG_EQ;
  return sendRequest(
    channel,
    [deviceId, identity, layer],
    setterResponseHandler,
  );
};

/**
 * Forget one song on one output.
 *
 * The whole identity, not its key: the entry is very often filed under a
 * different key from the one playing — that is what the alias index is for —
 * and main resolves it the same way a lookup does.
 * @param { string } deviceId - the output to forget it on
 * @param { ISongIdentity } identity - the song to forget
 * @returns { Promise<void> } exception if the payload is not an identity
 */
export const forgetSongEq = (
  deviceId: string,
  identity: ISongIdentity,
): Promise<void> => {
  const channel = ChannelEnum.FORGET_SONG_EQ;
  return sendRequest(channel, [deviceId, identity], setterResponseHandler);
};

export const resetEqMode = (): Promise<void> => {
  const channel = ChannelEnum.RESET_EQ_MODE;
  return sendRequest(channel, [], setterResponseHandler);
};

export const setEqShape = (
  scope: 'eq' | 'curves',
  kind: 'q' | 'smoothing',
  value: NonNullable<IState['eqBandQ'] | IState['curveSmoothing']>,
): Promise<void> => {
  const channel = ChannelEnum.SET_EQ_SHAPE;
  return sendRequest(channel, [scope, kind, value], setterResponseHandler);
};

export const setEqMode = (
  mode: NonNullable<IState['eqMode']>,
  scope: 'eq' | 'curves' = 'eq',
): Promise<void> => {
  const channel = ChannelEnum.SET_EQ_MODE;
  return sendRequest(channel, [mode, scope], setterResponseHandler);
};

/**
 * One of the cuts at the edges of the whole EQ, as its slope in dB per
 * octave, 0 for none (`eqCuts.ts`).
 */
export const setEqCut = (
  cut: keyof NonNullable<IState['eqCuts']>,
  slope: number,
): Promise<void> => {
  const channel = ChannelEnum.SET_EQ_CUT;
  return sendRequest(channel, [cut, slope], setterResponseHandler);
};

/**
 * The Tone panel's three dials, written as their own layer (`tone.ts`).
 *
 * Deliberately not routed through the bands: the tone is laid over them and
 * never written into them, which is the whole point of it being a layer.
 * @param { ITone | null } tone - the three values, or null for all at zero
 * @returns { Promise<void> } exception if the values are not three numbers
 */
export const setTone = (tone: ITone | null): Promise<void> => {
  const channel = ChannelEnum.SET_TONE;
  return sendRequest(channel, [tone], setterResponseHandler);
};

/**
 * Switch a layer out of the Equalizer APO config, or back into it.
 *
 * Nothing about the layer changes — its settings stay exactly where they were,
 * and all that moves is whether its file is included. That is what makes this
 * an A/B switch rather than a remove-and-reapply: pressing it twice returns to
 * precisely the sound it started from, with nothing recomputed and nothing
 * measured again.
 * @param { TApoLayer } feature - which layer
 * @param { boolean } isBypassed - true to take it out of the config
 * @returns { Promise<void> } exception if the layer is not one of the five
 */
export const setLayerBypass = (
  feature: TApoLayer,
  isBypassed: boolean,
): Promise<void> => {
  const channel = ChannelEnum.SET_LAYER_BYPASS;
  return sendRequest(channel, [feature, isBypassed], setterResponseHandler);
};

/**
 * Sets filters to be the corresponding fixed band configuration
 * @param { FixedBandSizeEnum } size - Number of bands in the fixed configuration
 * @returns { Promise<void> } exception if failed
 */
export const setFixedBand = (size: FixedBandSizeEnum): Promise<IFiltersMap> => {
  const channel = ChannelEnum.SET_FIXED_BAND;
  return sendRequest<IFiltersMap>(
    channel,
    [size],
    simpleResponseHandler<IFiltersMap>(),
  );
};
