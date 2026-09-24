/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Also applied keeps its chips in one order, whatever is applied.
 *
 * Ivan, 2026-09-24: the headphone correction always first and the convolution
 * after it; then the preset, the Tone and the bands' own chip as the last
 * three, in that order, so the one most often removed is always at the end —
 * "so its easy to find and delete". The row used to follow the order the
 * config is written, which put the bands' chip wherever the layers before it
 * left it.
 */
import {
  TLayerListInputs,
  collectLayers,
} from 'renderer/components/activeLayerList';

/** A layer's settings, only as deep as its chip reads them. */
const as = <T>(value: unknown): T => value as T;

const filters = {
  a: { type: 'PK', frequency: 1_000, gain: 3, quality: 1, enabled: true },
};
const nothing = () => undefined;

/** Every layer applied at once, so every chip is in the row. */
const everything: TLayerListInputs = {
  t: as<TLayerListInputs['t']>((key: string) => key),
  refreshState: async () => undefined,
  isBypassed: (layer) => layer === 'eq',
  convolution: as<TLayerListInputs['convolution']>({
    fileName: 'room.wav',
    path: 'C:/room.wav',
  }),
  setConvolution: nothing,
  driver: as<TLayerListInputs['driver']>({
    profileId: 'x',
    intensity: 1,
    apoOverride: { filters },
  }),
  driverProfile: undefined,
  setDriver: nothing,
  setDriverStrength: nothing,
  headphone: as<TLayerListInputs['headphone']>({ intensity: 1, filters }),
  headset: 'model',
  headsetName: 'Model',
  setHeadphone: nothing,
  setHeadphoneStrength: nothing,
  hasShapedBands: true,
  eqBandDesign: as<TLayerListInputs['eqBandDesign']>(undefined),
  bandCount: 10,
  voicing: as<TLayerListInputs['voicing']>({
    profileId: 'dsp:popRock',
    intensity: 1,
    apoOverride: { filters },
  }),
  voicingProfile: undefined,
  presetName: 'Pop Rock',
  setVoicing: nothing,
  setVoicingStrength: nothing,
  smartEq: as<TLayerListInputs['smartEq']>({ filters }),
  setSmartEq: nothing,
  tone: { bass: 2, mid: 0, treble: 0 },
  setTone: nothing,
  modeName: 'Smart',
  setLayerStrength: nothing,
  isContinuousOn: false,
  customFx: as<TLayerListInputs['customFx']>({ fileName: 'custom.txt' }),
};

describe('the order of the Also applied row', () => {
  it('puts the headphone correction first and the bands last', () => {
    expect(collectLayers(everything).map((layer) => layer.key)).toEqual([
      'headphone',
      'convolution',
      'driver',
      'smart',
      'custom',
      'voicing',
      'tone',
      'eq',
    ]);
  });

  it('keeps the same places when only some layers are applied', () => {
    const some = collectLayers({
      ...everything,
      convolution: undefined,
      smartEq: undefined,
      customFx: undefined,
    }).map((layer) => layer.key);
    expect(some).toEqual(['headphone', 'driver', 'voicing', 'tone', 'eq']);
  });
});
