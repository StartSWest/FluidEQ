/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The rack line an output's engine plays, as every output's own file is
 * written (`flushOutputDsp`) and as the one shared file an older engine reads
 * is written by the core (`presetPicks.ts`): the audible rack, off wherever
 * it must not run, carrying the Preset layer's curve as the engine's version
 * plays it.
 */
import { getDefaultState, IState } from 'common/constants';
import { DSP_DEFAULTS, IDspSettings } from 'common/dsp/chain';
import {
  appendPresetTone,
  encodeChainSettings,
  hasPresetTone,
} from 'common/dsp/chainWire';
import { DSP_PRESETS, dspPresetSettings } from 'common/dsp/presets';
import { presetToneOf } from 'common/dsp/presetTone';
import { dspPresetVoicing } from 'common/dsp/presetVoicing';
import { outputRackLine } from 'main/outputDsp';

const GAMING = dspPresetSettings('gaming', DSP_DEFAULTS) as IDspSettings;
const curve = DSP_PRESETS.find((preset) => preset.id === 'gaming')?.curve;
if (!curve) {
  throw new Error('Gaming has no curve');
}
const playing = (over: Partial<IState> = {}): IState => ({
  ...getDefaultState(),
  isEnabled: true,
  voicing: dspPresetVoicing('gaming', curve),
  ...over,
});
/** No default for the rack: `undefined` is the case of an output with none. */
const line = (
  state: IState,
  audibleDsp: IDspSettings | undefined,
  rackHere = true,
  version = '1.19.0.0',
) => outputRackLine({ state, audibleDsp, rackHere, version });

it('plays the audible rack with the preset’s curve, built as the version plays it', () => {
  const state = playing();
  expect(line(state, GAMING)).toEqual(
    appendPresetTone(
      encodeChainSettings(GAMING),
      presetToneOf(state, { eq: true, curves: true }),
    ),
  );
  // Before the analog-matched design the curve is the cookbook's.
  expect(line(state, GAMING, true, '1.12.0.0')).toEqual(
    appendPresetTone(
      encodeChainSettings(GAMING),
      presetToneOf(state, { eq: false, curves: false }),
    ),
  );
  expect(line(state, GAMING, true, '1.12.0.0')).not.toEqual(
    line(state, GAMING),
  );
});

it.each([
  ['FluidEQ is switched off', playing({ isEnabled: false }), GAMING, true],
  ['the output has no rack saved', playing(), undefined, true],
  ['the rack runs in the Library’s host', playing(), GAMING, false],
])(
  'switches the rack off, curve and all, where %s',
  (_why, state, rack, here) => {
    const off = line(state, rack, here);
    expect(hasPresetTone(off)).toBe(false);
    expect(off).toEqual(
      encodeChainSettings({ ...(rack ?? DSP_DEFAULTS), enabled: false }),
    );
    // POSITIVE CONTROL: the same rack plays where nothing stops it.
    expect(hasPresetTone(line(playing(), GAMING))).toBe(true);
  },
);
