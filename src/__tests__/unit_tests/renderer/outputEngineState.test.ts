/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Remote Desktop's audio reads "not attached" under both engines, because it
 * has no effect slots at all, and the output panel took that as a repair to
 * offer: the FluidEQ Engine's attach then failed with "there is no output
 * with the id…". These pin the order the answers are read in.
 */

import type { IAudioDevice } from 'common/constants';
import {
  isOutputOff,
  outputEngineState,
} from 'renderer/utils/outputEngineState';

const speakers: IAudioDevice = {
  id: 'speakers',
  name: 'Speakers',
  guid: '{SPEAKERS}',
  isDefault: true,
  isActive: true,
  isEqualizerApoAttached: false,
  isFluidEngineAttached: true,
  canHostEffects: true,
};

const remoteAudio: IAudioDevice = {
  ...speakers,
  id: 'remote',
  name: 'Remote Audio',
  isEqualizerApoAttached: false,
  isFluidEngineAttached: false,
  canHostEffects: false,
};

describe('outputEngineState', () => {
  it('reads only the engine in use', () => {
    expect(outputEngineState(speakers, 'fluid')).toBe('processed');
    expect(outputEngineState(speakers, 'apo')).toBe('engine-missing');
  });

  it('puts an output Windows runs no effects on ahead of either flag', () => {
    expect(outputEngineState(remoteAudio, 'fluid')).toBe('no-effects');
    expect(outputEngineState(remoteAudio, 'apo')).toBe('no-effects');
    // Even a flag that somehow says attached cannot make it processable.
    expect(
      outputEngineState(
        { ...remoteAudio, isFluidEngineAttached: true },
        'fluid',
      ),
    ).toBe('no-effects');
  });

  it('says nothing on a guess', () => {
    expect(
      outputEngineState({ ...speakers, isFluidEngineAttached: null }, 'fluid'),
    ).toBe('unknown');
    expect(outputEngineState(remoteAudio, null)).toBe('unknown');
    expect(outputEngineState(undefined, 'fluid')).toBe('unknown');
  });

  it('treats an unreadable effects answer as no answer, not as "cannot"', () => {
    const unread = {
      ...speakers,
      isFluidEngineAttached: false,
      canHostEffects: null,
    };
    expect(outputEngineState(unread, 'fluid')).toBe('engine-missing');
    const { canHostEffects: _omitted, ...older } = unread;
    expect(outputEngineState(older, 'fluid')).toBe('engine-missing');
  });
});

describe('isOutputOff', () => {
  it('is off whenever the output is not being processed, and only then', () => {
    expect(isOutputOff('engine-missing')).toBe(true);
    expect(isOutputOff('no-effects')).toBe(true);
    expect(isOutputOff('processed')).toBe(false);
    expect(isOutputOff('unknown')).toBe(false);
  });
});
