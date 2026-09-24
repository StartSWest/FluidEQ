/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A preset's curve is the machine's choice, not the output's.
 *
 * The rack is one choice for the whole machine and a preset is the rack and
 * its curve together, so switching output used to bring back whatever preset
 * curve the new output's profile had been saved with — the picker still said
 * one preset while the chip beside it said another (Ivan, 2026-09-24: "we
 * dont save presets on the output switch we replay current preset always").
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  FilterTypeEnum,
  IDeviceProfileSettings,
  IVoicingSettings,
} from '../../../common/constants';
import {
  getDefaultDeviceProfileSettings,
  getStateForAudioDevice,
} from '../../../main/deviceProfiles';

const popRock: IVoicingSettings = { profileId: 'dsp:pop-rock', intensity: 1 };
const punchy: IVoicingSettings = { profileId: 'dsp:punchy', intensity: 1 };
/** Somebody's own voicing, tuned on one output: that output's, always. */
const warmHeadphones: IVoicingSettings = {
  profileId: 'warm-headphones',
  intensity: 0.8,
};

let presetsDir: string;
let settings: IDeviceProfileSettings;

/** The headset's saved profile, carrying `voicing`. */
const saveHeadsetProfile = (voicing: IVoicingSettings | undefined) => {
  fs.writeFileSync(
    path.join(presetsDir, 'Headset'),
    JSON.stringify({
      preAmp: -3,
      filters: {
        bass: {
          id: 'bass',
          frequency: 80,
          gain: 2,
          quality: 1,
          type: FilterTypeEnum.PK,
        },
      },
      ...(voicing ? { voicing } : {}),
    }),
  );
};

const switchToHeadset = (playing: IVoicingSettings | undefined) =>
  getStateForAudioDevice(settings, 'headset', () => presetsDir, {
    voicing: playing,
  });

beforeEach(() => {
  presetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-preset-follow-'));
  settings = getDefaultDeviceProfileSettings();
  settings.assignments.headset = {
    deviceId: 'headset',
    deviceName: 'Bluetooth headset',
    deviceGuid: '{CCCC}',
    presetName: 'Headset',
  };
});

afterEach(() => {
  fs.rmSync(presetsDir, { recursive: true, force: true });
});

describe('switching output while a preset plays', () => {
  it('keeps the preset that is playing, not the one the output was saved with', () => {
    saveHeadsetProfile(punchy);
    expect(switchToHeadset(popRock).voicing).toEqual(popRock);
  });

  it('keeps the preset playing onto an output saved with none', () => {
    saveHeadsetProfile(undefined);
    expect(switchToHeadset(popRock).voicing).toEqual(popRock);
  });

  it('does not bring a saved preset back over one cleared by its chip', () => {
    saveHeadsetProfile(punchy);
    expect(switchToHeadset(undefined).voicing).toBeUndefined();
  });

  it('keeps the rest of the output’s own profile', () => {
    // The preset is the only thing that crosses: the bands and the preamp
    // are the headset's, as they always were.
    saveHeadsetProfile(punchy);
    const state = switchToHeadset(popRock);
    expect(state.preAmp).toBe(-3);
    expect(state.filters.bass.gain).toBe(2);
  });
});

describe('a voicing of somebody’s own', () => {
  /*
   * The positive control for everything above: a voicing that is not a
   * preset's curve still belongs to the output it was tuned on, so the rule
   * cannot have been met by keeping whatever plays, whatever it is.
   */
  it('comes from the output’s profile, as it always did', () => {
    saveHeadsetProfile(warmHeadphones);
    expect(switchToHeadset(undefined).voicing).toEqual(warmHeadphones);
  });

  it('is replaced by a preset that is playing', () => {
    // One tonal layer at a time: a preset put on replaced the voicing, and
    // switching output must not undo that choice.
    saveHeadsetProfile(warmHeadphones);
    expect(switchToHeadset(popRock).voicing).toEqual(popRock);
  });
});

describe('the launch', () => {
  // Nothing is playing yet, so the profile is where the curve comes back
  // from — or a restart would lose the preset.
  it('restores the output’s saved preset', () => {
    saveHeadsetProfile(punchy);
    expect(
      getStateForAudioDevice(settings, 'headset', () => presetsDir).voicing,
    ).toEqual(punchy);
  });
});
