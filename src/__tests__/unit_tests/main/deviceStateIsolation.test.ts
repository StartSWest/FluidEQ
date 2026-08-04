/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  deviceProfilesToString,
  getStateForAudioDevice,
} from '../../../main/deviceProfiles';
import {
  FilterTypeEnum,
  IDeviceProfileSettings,
  getDefaultState,
} from '../../../common/constants';

const GUID = '{2de2e800-7980-4b45-a318-34276fe3d3b4}';

/**
 * One device's settings must never follow the user onto another.
 *
 * getStateForAudioDevice is applied over the live state with Object.assign, so
 * any key it omits leaves the previous device's value untouched. Combined with
 * auto-save that was not a display glitch: the leaked value got written into
 * the next device's profile, which is how a single preamp and a single driver
 * correction ended up stamped across every output in the config.
 */
describe('per-device state isolation', () => {
  let presetsDir: string;

  beforeEach(() => {
    presetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-isolation-'));
    // A fully-loaded profile: every optional layer present.
    fs.writeFileSync(
      path.join(presetsDir, 'loaded'),
      JSON.stringify({
        preAmp: -6,
        isFlat: false,
        eqFormat: 'parametric',
        filters: {
          a: {
            id: 'a',
            frequency: 100,
            gain: 4,
            quality: 1,
            type: FilterTypeEnum.PK,
          },
        },
        voicing: { profileId: 'music', intensity: 1 },
        driver: { profileId: 'balanced-armature-iem', intensity: 1 },
        smartEq: {
          filters: {
            'smart-1000': {
              id: 'smart-1000',
              frequency: 1000,
              gain: 3,
              quality: 1.4,
              type: FilterTypeEnum.PK,
            },
          },
        },
        convolution: { name: 'Some HRTF', filters: {} },
        headset: 'HD 600',
        headsetTarget: 'Harman 2018',
        headsetSource: 'squiglink-gadgetrytech-headphones-headsets',
      }),
    );
    // A bare profile: none of the optional layers.
    fs.writeFileSync(
      path.join(presetsDir, 'bare'),
      JSON.stringify({
        preAmp: 0,
        filters: {
          b: {
            id: 'b',
            frequency: 1000,
            gain: 0,
            quality: 1,
            type: FilterTypeEnum.PK,
          },
        },
      }),
    );
    // Hand-set preamp: the one profile that has opted out of auto normalize.
    fs.writeFileSync(
      path.join(presetsDir, 'manual'),
      JSON.stringify({
        preAmp: -3,
        isAutoPreAmpOn: false,
        filters: {
          c: {
            id: 'c',
            frequency: 2000,
            gain: 2,
            quality: 1,
            type: FilterTypeEnum.PK,
          },
        },
      }),
    );
  });

  afterEach(() => {
    fs.rmSync(presetsDir, { recursive: true, force: true });
  });

  const settings: IDeviceProfileSettings = {
    version: 1,
    assignments: {
      full: {
        deviceId: 'full',
        deviceName: 'Loaded',
        deviceGuid: '{FULL}',
        presetName: 'loaded',
      },
      bare: {
        deviceId: 'bare',
        deviceName: 'Bare',
        deviceGuid: GUID,
        presetName: 'bare',
      },
      manual: {
        deviceId: 'manual',
        deviceName: 'Manual',
        deviceGuid: '{MANUAL}',
        presetName: 'manual',
      },
    },
  };

  /**
   * What main does on an output switch, minus the electron.
   *
   * applyDeviceState keeps exactly three things: whether the engine is on,
   * whether the graph is showing, and what the filesystem is like. Everything
   * else was chosen for a particular pair of headphones and travels with them.
   */
  const switchTo = (live: ReturnType<typeof getDefaultState>, id: string) => {
    const { isEnabled, isGraphViewOn, isCaseSensitiveFs, ...deviceState } =
      getStateForAudioDevice(settings, id, presetsDir);
    Object.assign(live, deviceState);
  };

  it('states every optional field so an assign can clear it', () => {
    const bare = getStateForAudioDevice(settings, 'bare', presetsDir);

    // Present as own keys, holding undefined — absence is what caused the leak.
    [
      'voicing',
      'driver',
      'smartEq',
      'convolution',
      'graphicEq',
      'eqFormat',
      'headset',
      'headsetTarget',
      'headsetSource',
    ].forEach((key) => {
      expect(Object.prototype.hasOwnProperty.call(bare, key)).toBe(true);
      expect(bare[key as keyof typeof bare]).toBeUndefined();
    });
  });

  it('clears the previous device layers when the next one has none', () => {
    // Simulate the real flow: adopt the loaded device, then the bare one.
    const live = getDefaultState();
    Object.assign(live, getStateForAudioDevice(settings, 'full', presetsDir));

    expect(live.voicing?.profileId).toBe('music');
    expect(live.driver?.profileId).toBe('balanced-armature-iem');
    expect(live.preAmp).toBe(-6);

    Object.assign(live, getStateForAudioDevice(settings, 'bare', presetsDir));

    expect(live.voicing).toBeUndefined();
    expect(live.driver).toBeUndefined();
    expect(live.smartEq).toBeUndefined();
    expect(live.convolution).toBeUndefined();
    expect(live.preAmp).toBe(0);
  });

  it('carries every tuned layer across an output switch', () => {
    // The whole point of the feature: what you set up on one pair of
    // headphones comes back when you plug them in again, and does not follow
    // you to the speakers in the meantime.
    const live = getDefaultState();

    switchTo(live, 'full');
    expect(live.voicing?.profileId).toBe('music');
    expect(live.driver?.profileId).toBe('balanced-armature-iem');
    expect(live.convolution?.name).toBe('Some HRTF');
    expect(live.filters.a.gain).toBe(4);

    switchTo(live, 'bare');
    expect(live.voicing).toBeUndefined();
    expect(live.driver).toBeUndefined();
    expect(live.convolution).toBeUndefined();
    expect(live.filters.a).toBeUndefined();

    // And back again, unchanged.
    switchTo(live, 'full');
    expect(live.voicing?.profileId).toBe('music');
    expect(live.driver?.profileId).toBe('balanced-armature-iem');
    expect(live.convolution?.name).toBe('Some HRTF');
  });

  it('carries the applied reference, source included, across an output switch', () => {
    // The AutoEQ panel puts its three pickers back from these, so the source
    // has to make the trip with the model and the measurement. Restoring by
    // model name alone lands on whichever database sorts first, which is how a
    // Squiglink selection came back showing the AutoEq copy of the same model.
    const live = getDefaultState();

    switchTo(live, 'full');
    expect(live.headset).toBe('HD 600');
    expect(live.headsetTarget).toBe('Harman 2018');
    expect(live.headsetSource).toBe(
      'squiglink-gadgetrytech-headphones-headsets',
    );

    switchTo(live, 'bare');
    expect(live.headset).toBeUndefined();
    expect(live.headsetSource).toBeUndefined();

    switchTo(live, 'full');
    expect(live.headsetSource).toBe(
      'squiglink-gadgetrytech-headphones-headsets',
    );
  });

  it('makes the auto preamp preference part of the profile', () => {
    // Otherwise a hand-set preamp on one output silently turns normalisation
    // off for every other one, and the next auto-save writes that in.
    const live = getDefaultState();

    switchTo(live, 'manual');
    expect(live.isAutoPreAmpOn).toBe(false);
    expect(live.preAmp).toBe(-3);

    // A profile predating the flag means automatic, not "whatever the last
    // device was set to".
    switchTo(live, 'bare');
    expect(live.isAutoPreAmpOn).toBe(true);
  });

  it('falls back cleanly for a device with no profile at all', () => {
    const none = getStateForAudioDevice(settings, 'unknown', presetsDir);

    expect(none.voicing).toBeUndefined();
    expect(none.driver).toBeUndefined();
    expect(none.preAmp).toBe(getDefaultState().preAmp);
  });

  it('writes each device only what its own profile carries', () => {
    const config = deviceProfilesToString(settings, presetsDir).replace(
      /\r/g,
      '',
    );
    const blockFor = (guid: string) => {
      const start = config.indexOf(`Device: ${guid}`);
      const next = config.indexOf('# ', start);
      return config.slice(start, next === -1 ? undefined : next);
    };

    // The loaded device gets its bands plus both layers.
    const loaded = blockFor('{FULL}');
    expect(loaded).toContain('Fc 100 Hz Gain 4 dB');
    expect(loaded).toContain('Fc 3000 Hz');

    // The bare one gets none of it — no leaked layers, no leaked preamp.
    const bare = blockFor(GUID);
    expect(bare).not.toContain('Fc 3000 Hz');
    expect(bare).not.toContain('Fc 105 Hz');
    expect(bare).toContain('Preamp: 0 dB');
  });
});
