/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The section of a bug report that says why the engine is not being heard.
 *
 * Written against the report that could not answer it: a machine with the
 * engine installed, chosen and attached, an RME output playing without any
 * EQ on it, and a report whose entire audio content was the engine's name.
 * Each case here is one of the states that report could have been in, and
 * the assertions are on the sentence a reader would have to act on.
 */

import { describeAudioEngine } from 'common/engineReport';
import type { IAudioDevice } from 'common/constants';
import type { IFluidEngineStatus } from 'common/audioEngine';
import type { IEngineHealth } from 'common/engineHealth';

const output: IAudioDevice = {
  id: 'rme',
  name: 'Analog (1+2) (RME ADI-2 DAC)',
  guid: '{9E7B1C2A-0000-0000-0000-00000000ABCD}',
  isDefault: true,
  isActive: true,
  isEqualizerApoAttached: false,
  isFluidEngineAttached: true,
  canHostEffects: true,
  effectsEnabled: true,
  sampleRate: 96000,
};

const installed: IFluidEngineStatus = {
  installed: true,
  dllVersion: '1.7.0.0',
  configDir: 'C:/ProgramData/FluidEQ/engine/config',
  endpoints: [{ guid: output.guid, attached: true, backupExists: true }],
};

const health = (outputs: IEngineHealth['outputs'] = []): IEngineHealth => ({
  outputs,
});

describe('describeAudioEngine', () => {
  it('says the engine was never loaded when it has written nothing', () => {
    const text = describeAudioEngine({
      engine: 'fluid',
      devices: [output],
      fluid: installed,
      health: health(),
    });
    expect(text).toContain('Analog (1+2) (RME ADI-2 DAC) (playing now)');
    expect(text).toContain('FluidEQ Engine=yes');
    expect(text).toContain('never loaded on this output');
    expect(text).toContain('build 1.7.0.0');
  });

  it("carries the engine's own reason for passing sound through", () => {
    const text = describeAudioEngine({
      engine: 'fluid',
      devices: [output],
      fluid: installed,
      health: health([
        {
          endpoint: output.guid,
          locked: true,
          processing: false,
          owner: false,
          problems: [],
          reason: 'FluidEQ is not running',
        },
      ]),
    });
    expect(text).toContain('Windows is running it=yes');
    expect(text).toContain('sees FluidEQ=no');
    expect(text).toContain('passing through: FluidEQ is not running');
  });

  it('shows Windows skipping effects on the output', () => {
    const text = describeAudioEngine({
      engine: 'fluid',
      devices: [{ ...output, effectsEnabled: false }],
      fluid: installed,
      health: health(),
    });
    expect(text).toContain('enhancements on=no');
  });

  it('answers unknown where Windows and the helper said nothing', () => {
    const text = describeAudioEngine({
      engine: null,
      devices: [
        { ...output, canHostEffects: null, isEqualizerApoAttached: null },
      ],
      health: health(),
    });
    expect(text).toContain('Engine in use: none chosen');
    expect(text).toContain('FluidEQ Engine installed: unknown');
    expect(text).toContain('effects possible=unknown');
    expect(text).toContain('Equalizer APO=unknown');
  });

  it('matches an endpoint however either side spelled its id', () => {
    const text = describeAudioEngine({
      engine: 'fluid',
      devices: [output],
      fluid: {
        ...installed,
        endpoints: [
          {
            guid: output.guid.toLowerCase().replace(/[{}]/g, ''),
            attached: true,
            backupExists: true,
          },
        ],
      },
      health: health([
        {
          endpoint: output.guid.toLowerCase(),
          locked: true,
          processing: true,
          owner: true,
          problems: [],
        },
      ]),
    });
    expect(text).toContain('FluidEQ Engine=yes');
    expect(text).toContain('changing the sound=yes');
  });

  it('says so when Windows lists no outputs at all', () => {
    expect(
      describeAudioEngine({
        engine: 'fluid',
        devices: [],
        fluid: installed,
        health: health(),
      }),
    ).toContain('Outputs: none Windows would list');
  });
});
