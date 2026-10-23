/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A preset's curve belongs to the output together with its saved rack.
 *
 * The former global-preset contract copied the playing output's curve onto
 * every newly opened output. Independent output editors now restore their
 * own saved sound, including an explicit absence of a preset curve (Ivan,
 * 2026-10-03: "I want everything on each output even the DSP and Preset
 * curves") — and what plays on another output is not even asked.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  FilterTypeEnum,
  IDeviceProfileSettings,
  IVoicingSettings,
} from '../../../common/constants';
import { getStateForAudioDevice } from '../../../main/deviceProfiles';
import { getDefaultDeviceProfileSettings } from '../../../main/deviceProfileSettings';

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

const switchToHeadset = () =>
  getStateForAudioDevice(settings, 'headset', () => presetsDir);

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

describe('switching between independent output presets', () => {
  it('restores the selected output’s saved preset', () => {
    saveHeadsetProfile(punchy);
    expect(switchToHeadset().voicing).toEqual(punchy);
  });

  it('keeps an output saved with no preset free of another output’s curve', () => {
    saveHeadsetProfile(undefined);
    expect(switchToHeadset().voicing).toBeUndefined();
  });

  it('keeps the rest of the output’s own profile', () => {
    // Bands and preamp follow the same endpoint boundary as the preset curve.
    saveHeadsetProfile(punchy);
    const state = switchToHeadset();
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
    expect(switchToHeadset().voicing).toEqual(warmHeadphones);
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
