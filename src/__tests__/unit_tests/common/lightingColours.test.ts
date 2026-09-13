import {
  createLampMemory,
  lightLamps,
  measureMood,
} from 'common/lighting/lampColour';
import type { ILamp, ILightingFrame } from 'common/lighting/lightingModel';
import {
  DEFAULT_DEVICE_TUNING,
  type IDeviceLightingTuning,
  type TLightingIdle,
} from 'common/lighting/lightingProfiles';

const picture = (): ILightingFrame => {
  const rgb = new Uint8Array(48 * 27 * 3);
  for (let y = 0; y < 27; y += 1) {
    for (let x = 0; x < 48; x += 1) {
      let colour = [12, 8, 20];
      if (x >= 16 && x < 32 && y >= 7 && y < 20) {
        colour = [190, 60, 145];
      }
      if (x >= 22 && x < 26 && y >= 11 && y < 16) {
        colour = [40, 200, 150];
      }
      rgb.set(colour, (y * 48 + x) * 3);
    }
  }
  return {
    width: 48,
    height: 27,
    rgb,
    level: 0.35,
    beat: 0,
    bass: 0.35,
    mid: 0.35,
    treble: 0.35,
    deltaMs: 33,
    timeSeconds: 3600,
    activity: 1,
  };
};
const lamps: ILamp[] = [
  { u: 0.1, v: 0.1, reach: 0.001 },
  { u: 0.4, v: 0.5, reach: 0.001 },
  { u: 0.5, v: 0.5, reach: 0.001 },
];
const render = (
  frame: ILightingFrame,
  tuning: Partial<IDeviceLightingTuning> = {},
  points = lamps,
  idle: TLightingIdle = 'flow',
) => {
  const rgb = new Uint8Array(points.length * 3);
  lightLamps(
    frame,
    measureMood(frame),
    points,
    {
      kind: 'keyboard',
      brightness: 1,
      pulse: 'full',
      tuning: { ...DEFAULT_DEVICE_TUNING, ...tuning },
      idle,
      idleBrightness: 0.38,
    },
    createLampMemory(points.length),
    rgb,
  );
  return [...rgb];
};

it('Scene keeps the background, petals and centre in their actual colours', () => {
  expect(render(picture())).toEqual([12, 8, 20, 190, 60, 145, 40, 200, 150]);
  expect(render({ ...picture(), level: 1, beat: 1, bass: 1 })).toEqual(
    render(picture()),
  );
});

it('Spectrum fills from the bottom while quiet upper lamps remain dim', () => {
  const frame = picture();
  frame.rgb.fill(200);
  const rgb = render(frame, { effect: 'spectrum' }, [
    { u: 0.5, v: 0.1, reach: 0.01 },
    { u: 0.5, v: 0.9, reach: 0.01 },
  ]);
  expect(rgb[3]).toBeGreaterThan(rgb[0] * 2);
});

it('boosts the foreground to full LED brightness without bleaching its hue or lifting shadows', () => {
  expect(render(picture(), { foregroundBrightness: 2 })).toEqual([
    12, 8, 20, 255, 81, 195, 51, 255, 191,
  ]);
});

it('raises background brightness without changing the bright foreground colours', () => {
  const normal = render(picture());
  const raised = render(picture(), { backgroundBrightness: 3 });
  expect(raised.slice(0, 3)).toEqual([36, 24, 60]);
  expect(raised.slice(3)).toEqual(normal.slice(3));
  expect(render(picture(), { backgroundBrightness: 0 }).slice(0, 3)).toEqual([
    0, 0, 0,
  ]);
});

it('a tiny idle contribution does not enable a full colour wave during playback', () => {
  const playing = render(picture(), { effect: 'spectrum' });
  const almostPlaying = render(
    { ...picture(), activity: 1 - 1e-10 },
    { effect: 'spectrum' },
  );
  expect(almostPlaying).toEqual(playing);
});

it('a long song can fade toward idle without rapidly cycling its palette', () => {
  const before = render({ ...picture(), activity: 0.5 }, { effect: 'pulse' });
  const after = render(
    { ...picture(), activity: 0.49, timeSeconds: 3600.01 },
    { effect: 'pulse' },
  );
  expect(
    Math.max(...before.map((value, index) => Math.abs(value - after[index]))),
  ).toBeLessThan(8);
});

it('Scene breathing changes idle brightness while keeping colour ratios', () => {
  const frame = { ...picture(), activity: 0 };
  const high = render(
    { ...frame, timeSeconds: Math.PI / 2 / 0.55 },
    {},
    lamps,
    'breathe',
  );
  const low = render(
    { ...frame, timeSeconds: (Math.PI * 1.5) / 0.55 },
    {},
    lamps,
    'breathe',
  );
  expect(high[7]).toBeGreaterThan(low[7] * 1.4);
  expect(low[7]).toBeGreaterThan(0);
  expect(render({ ...frame, timeSeconds: 0 }, {}, lamps, 'hold')).toEqual(
    render({ ...frame, timeSeconds: 100 }, {}, lamps, 'hold'),
  );
});
