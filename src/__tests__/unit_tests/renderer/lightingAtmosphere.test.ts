import { DEFAULT_LIGHTING_PROFILE } from 'common/lighting/lightingProfiles';
import { SILENT_RHYTHM } from 'common/sceneRhythm';
import { createLightingAtmosphere } from 'renderer/lighting/lightingAtmosphere';
import type { IHeardFrame } from 'renderer/lighting/lightingListener';

const heard = (silent: boolean): IHeardFrame => ({
  silent,
  frame: {
    timeSeconds: 0,
    deltaMs: 33,
    level: silent ? 0 : 0.7,
    beat: 0,
    bands: silent ? [0, 0, 0] : [0.8, 0.6, 0.4],
    musicAccent: [0, 0],
    musicRun: [0, 0],
    rhythm: SILENT_RHYTHM,
    accent: [1, 0, 1],
    fade: 1,
    spectrum: new Uint8Array(256),
    waveform: new Uint8Array(256),
  },
});

it('eases into a moving, nonzero idle scene and returns promptly to music', () => {
  const advance = createLightingAtmosphere();
  let active = advance(heard(false), DEFAULT_LIGHTING_PROFILE);
  for (let i = 0; i < 120; i += 1) {
    active = advance(heard(false), DEFAULT_LIGHTING_PROFILE);
  }
  const firstSilent = advance(heard(true), DEFAULT_LIGHTING_PROFILE);
  expect(firstSilent.activity).toBeGreaterThan(0.95);
  expect(firstSilent.timeSeconds).toBeGreaterThan(active.timeSeconds);
  let idle = firstSilent;
  for (let i = 0; i < 240; i += 1) {
    idle = advance(heard(true), DEFAULT_LIGHTING_PROFILE);
  }
  expect(idle.activity).toBeLessThan(0.01);
  expect(idle.level).toBeGreaterThan(0.07);
  const flowing = advance(heard(true), DEFAULT_LIGHTING_PROFILE);
  expect(flowing.timeSeconds).toBeGreaterThan(idle.timeSeconds);
  let resumed = flowing;
  for (let i = 0; i < 25; i += 1) {
    resumed = advance(heard(false), DEFAULT_LIGHTING_PROFILE);
  }
  expect(resumed.activity).toBeGreaterThan(0.95);
});

it('respects idle motion speed and holds time when Hold colour is selected', () => {
  const slow = createLightingAtmosphere();
  const fast = createLightingAtmosphere();
  const hold = createLightingAtmosphere();
  let slower = 0;
  let faster = 0;
  let held = 0;
  for (let i = 0; i < 120; i += 1) {
    slower = slow(heard(true), {
      ...DEFAULT_LIGHTING_PROFILE,
      idleSpeed: 0.1,
    }).timeSeconds;
    faster = fast(heard(true), {
      ...DEFAULT_LIGHTING_PROFILE,
      idleSpeed: 0.8,
    }).timeSeconds;
    held = hold(heard(true), {
      ...DEFAULT_LIGHTING_PROFILE,
      idle: 'hold',
    }).timeSeconds;
  }
  expect(faster).toBeCloseTo(slower * 8);
  expect(held).toBe(0);
});
