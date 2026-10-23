/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  getDefaultState,
  type IDeviceProfileSettings,
} from '../../../common/constants';
import { clampDspSettings, DSP_DEFAULTS } from '../../../common/dsp/chain';
import { flushPendingWrites } from '../../../main/asyncWriter';
import { fetchPreset, savePreset } from '../../../main/flush';
import { getStateForAudioDevice } from '../../../main/deviceProfiles';
import createMainSession from '../../../main/mainSession';
import { createOutputSoundStore } from '../../../main/outputSoundStore';
import { createProfileStore } from '../../../main/profileStore';
import {
  forgetProfileOutputSound,
  readProfileOutputSound,
  rememberProfileOutputSound,
} from '../../../main/outputSoundPersistence';

jest.mock('electron', () => ({ app: { getPath: () => '' } }));
jest.mock('../../../main/registry', () => ({
  getConfigPath: async () => '',
  isEqualizerAPOInstalled: async () => true,
}));

const ownRack = (targetLufs: number, enabled = true) =>
  clampDspSettings({
    ...DSP_DEFAULTS,
    enabled,
    normalizer: { ...DSP_DEFAULTS.normalizer, targetLufs },
  });
const SHARED = 'Same name';

describe('output sound persistence', () => {
  let root: string;
  let state: ReturnType<typeof getDefaultState>;
  let session: ReturnType<typeof createMainSession>;
  let profiles: ReturnType<typeof createProfileStore>;
  let sounds: ReturnType<typeof createOutputSoundStore>;
  let settings: IDeviceProfileSettings;
  const read = (deviceId: string) =>
    fetchPreset(SHARED, profiles.presetDirForDevice(deviceId));

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-output-sound-'));
    state = getDefaultState();
    session = {
      ...createMainSession(),
      activeAudioDeviceId: 'main',
      outputEditGeneration: 4,
    };
    settings = {
      version: 1,
      assignments: Object.fromEntries(
        ['main', 'second'].map((deviceId) => [
          deviceId,
          {
            deviceId,
            deviceName: deviceId,
            deviceGuid: deviceId,
            presetName: SHARED,
          },
        ]),
      ),
    };
    profiles = createProfileStore({
      state,
      session,
      deviceProfileSettings: settings,
      userDataDir: root,
    });
    sounds = createOutputSoundStore(
      state,
      session,
      settings,
      profiles.presetDirForDevice,
      root,
    );
    await Promise.all(
      ['main', 'second'].map((deviceId, index) =>
        savePreset(
          SHARED,
          {
            preAmp: -index,
            filters: {},
            dsp: ownRack(-14 - index * 6, index === 0),
            isAutoPreAmpOn: index === 0,
          },
          profiles.presetDirForDevice(deviceId),
        ),
      ),
    );
  });

  afterEach(async () => {
    await flushPendingWrites();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("saves one output's rack and normalizer while preserving the other output with the same profile name", async () => {
    const next = ownRack(-18);
    await sounds.saveDsp({ deviceId: 'main', generation: 4, settings: next });
    expect(read('main').dsp).toEqual(next);
    expect(read('main').isAutoPreAmpOn).toBe(true);
    expect(read('second').dsp).toEqual(ownRack(-20, false));
    expect(read('second').isAutoPreAmpOn).toBe(false);

    session.activeAudioDeviceId = 'second';
    session.outputEditGeneration = 5;
    await sounds.saveDsp({
      deviceId: 'second',
      generation: 5,
      settings: ownRack(-24),
    });
    expect(read('second').dsp).toEqual(ownRack(-24));
    expect(read('main').dsp).toEqual(next);
    expect(session.outputDspOverrides?.get('main')).toEqual(next);
    expect(session.outputDspOverrides?.get('second')).toEqual(ownRack(-24));
  });

  it.each([
    { deviceId: 'second', generation: 4 },
    { deviceId: 'main', generation: 3 },
  ])(
    'ignores an obsolete rack edit %j without running migration or touching either profile',
    async (owner) => {
      await sounds.saveDsp({
        ...owner,
        settings: ownRack(-24),
        legacySettings: ownRack(-30),
      });
      expect(read('main').dsp).toEqual(ownRack(-14));
      expect(read('second').dsp).toEqual(ownRack(-20, false));
      expect(session.outputDspOverrides).toBeUndefined();
      expect(
        fs.existsSync(path.join(root, 'output-dsp-profiles-v1.json')),
      ).toBe(false);

      await sounds.saveDsp({
        deviceId: 'main',
        generation: 4,
        settings: ownRack(-18),
      });
      expect(read('main').dsp).toEqual(ownRack(-18));
    },
  );

  it("keeps a temporary audible rack separate from its output's saved rack", async () => {
    const audible = ownRack(-12);
    const owned = ownRack(-22);
    await sounds.saveDsp({
      deviceId: 'main',
      generation: 4,
      settings: audible,
      savedSettings: owned,
    });
    expect(session.outputDspOverrides?.get('main')).toEqual(audible);
    expect(read('main').dsp).toEqual(owned);
    expect(read('second').dsp).toEqual(ownRack(-20, false));
  });

  it("restores each editor's saved rack, normalizer switch and own measured headroom", () => {
    const open = (deviceId: string) => {
      session.activeAudioDeviceId = deviceId;
      profiles.applyDeviceState(
        getStateForAudioDevice(settings, deviceId, profiles.presetDirForDevice),
      );
    };
    open('main');
    state.smartHeadroomTrimDb = -1.5;
    expect(state.dsp).toEqual(ownRack(-14));
    expect(state.isAutoPreAmpOn).toBe(true);
    open('second');
    expect(state.dsp).toEqual(ownRack(-20, false));
    expect(state.isAutoPreAmpOn).toBe(false);
    expect(state.smartHeadroomTrimDb).toBeUndefined();
    state.smartHeadroomTrimDb = -4;
    open('main');
    expect(state.smartHeadroomTrimDb).toBe(-1.5);
    expect(state.dsp).toEqual(ownRack(-14));
    expect(state.isAutoPreAmpOn).toBe(true);
    open('second');
    expect(state.smartHeadroomTrimDb).toBe(-4);
  });

  it('captures the destination and sound before an editor switch while disk writes finish', async () => {
    const next = ownRack(-18);
    const saving = sounds.persist({ dsp: next, eqCuts: { low: 12, high: 24 } });
    session.activeAudioDeviceId = 'second';
    session.outputEditGeneration = 5;
    next.normalizer.targetLufs = -30;
    state.dsp = ownRack(-26);
    await saving;
    expect(read('main').dsp).toEqual(ownRack(-18));
    expect(read('main').eqCuts).toEqual({ low: 12, high: 24 });
    expect(read('second').dsp).toEqual(ownRack(-20, false));
    expect(read('second').eqCuts).toBeUndefined();
  });

  it('keeps live isolate state per file and clears it only for a cold profile read', () => {
    const live = ownRack(-18);
    live.eq.isolate = true;
    const contents = JSON.stringify({ dsp: live });
    const mainPath = path.join(profiles.presetDirForDevice('main'), SHARED);
    const secondPath = path.join(profiles.presetDirForDevice('second'), SHARED);
    rememberProfileOutputSound(mainPath, contents, { dsp: live });

    const mainSound = readProfileOutputSound(mainPath, contents, { dsp: live });
    const secondSound = readProfileOutputSound(secondPath, contents, {
      dsp: live,
    });
    expect(mainSound.dsp?.eq.isolate).toBe(true);
    expect(secondSound.dsp?.eq.isolate).toBe(false);
    if (!mainSound.dsp) {
      throw new Error('Expected the saved rack');
    }
    mainSound.dsp.eq.isolate = false;
    expect(
      readProfileOutputSound(mainPath, contents, { dsp: live }).dsp?.eq.isolate,
    ).toBe(true);
    forgetProfileOutputSound(mainPath);
    expect(
      readProfileOutputSound(mainPath, contents, { dsp: live }).dsp?.eq.isolate,
    ).toBe(false);
    forgetProfileOutputSound(secondPath);
  });
});
