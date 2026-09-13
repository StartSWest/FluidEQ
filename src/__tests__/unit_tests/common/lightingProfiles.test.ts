import { readLightingSettings } from 'common/lighting/lightingModel';
import {
  DEFAULT_DEVICE_TUNING,
  deviceTuning,
  lightingProfile,
  readLightingProfiles,
} from 'common/lighting/lightingProfiles';

it('round-trips separate visualizers and inherits controls outside a device override', () => {
  const settings = readLightingSettings({
    profiles: {
      flower: {
        tuning: { ...DEFAULT_DEVICE_TUNING, brightness: 0.8 },
        devices: {
          'chroma:keyboard': {
            effect: 'spectrum',
            sceneScale: 1.36,
            sceneOffsetX: -0.12,
            sceneOffsetY: 0.08,
          },
        },
      },
      city: {
        tuning: { ...DEFAULT_DEVICE_TUNING, effect: 'flow' },
        idle: 'breathe',
      },
    },
  });
  const restored = readLightingSettings(JSON.parse(JSON.stringify(settings)));
  const flower = lightingProfile(restored.profiles, 'flower');
  expect(deviceTuning(flower, 'chroma:keyboard')).toMatchObject({
    effect: 'spectrum',
    brightness: 0.8,
    sceneScale: 1.36,
    sceneOffsetX: -0.12,
    sceneOffsetY: 0.08,
  });
  expect(deviceTuning(flower, 'chroma:mouse')).toMatchObject({
    effect: 'scene',
    brightness: 0.8,
  });
  expect(lightingProfile(restored.profiles, 'city')).toMatchObject({
    tuning: { effect: 'flow' },
    idle: 'breathe',
  });
  expect(readLightingSettings({ brightness: 0.4 }, restored).profiles).toEqual(
    restored.profiles,
  );
  expect(lightingProfile(restored.profiles, 'new').tuning.effect).toBe('scene');
});

it('clamps saved controls and keeps malformed or prototype keys out', () => {
  const profiles = readLightingProfiles(
    JSON.parse(
      '{"__proto__":{},"flower":{"tuning":{"effect":"bad","brightness":8,"speed":-1},"devices":{"constructor":{},"mouse":{"brightness":-3}},"idle":"invalid","idleBrightness":99}}',
    ),
  );
  expect(Object.keys(profiles)).toEqual(['flower']);
  expect(profiles.flower).toMatchObject({
    tuning: { effect: 'scene', brightness: 1, speed: 0.1 },
    idle: 'flow',
    idleBrightness: 0.8,
  });
  expect(profiles.flower.devices).toEqual({ mouse: { brightness: 0 } });
});

it('bounds scene alignment and leaves older profiles centred at their original size', () => {
  const profiles = readLightingProfiles({
    flower: { tuning: { sceneScale: 10, sceneOffsetX: -8, sceneOffsetY: 4 } },
    old: {},
  });
  expect(profiles.flower.tuning).toMatchObject({
    sceneScale: 2,
    sceneOffsetX: -0.5,
    sceneOffsetY: 0.5,
  });
  expect(profiles.old.tuning).toMatchObject({
    sceneScale: 1,
    sceneOffsetX: 0,
    sceneOffsetY: 0,
  });
});
