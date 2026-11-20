/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * A scene that says which colours it lends the window - by naming them, or
 * by the palette it is drawn in - is never drawn to find out (Ivan,
 * 2026-11-14: "we want the agent to give those colours, but in case they
 * don't exist we need a deterministic algorithm"). Drawing it was a guess
 * made differently on every computer; what the scene says is the same on
 * all of them. Only a scene that says neither is still measured.
 */

import type { IScenePack } from 'common/scenePacks';
import { measureSceneSky } from 'renderer/graph/sceneSky';
import { memberPack } from '../../utils/memberSceneFixtures';

const mockSample = jest.fn();
const mockRemember = jest.fn();
let mockPack: IScenePack | undefined;

jest.mock('renderer/graph/sceneStillClient', () => ({
  sampleSceneInWorker: (...args: unknown[]) => mockSample(...args),
}));
jest.mock('renderer/utils/scenePacks', () => ({
  loadScenePack: async () => mockPack,
}));
jest.mock('renderer/utils/memberScenes', () => ({
  loadMemberScene: async () => mockPack,
}));
jest.mock('renderer/utils/sceneTintStore', () => ({
  rememberSceneSky: (...args: unknown[]) => mockRemember(...args),
  studioSkyKey: (project: string) => `studio:${project}`,
}));

const NAMED = { surface: '#1d2b4f', accent: '#5fd4ff', glow: '#7dffb0' };
let version = 0;
/** Each measurement keyed apart: the module remembers one per version. */
const nextVersion = () => {
  version += 1;
  return String(version);
};

beforeEach(() => {
  mockSample.mockReset().mockResolvedValue(undefined);
  mockRemember.mockReset();
});

// A pack read from disk carries the points beside the one set
// (`readScenePack`, `sceneWindowColourStopsOf`), and the colours a point
// names are what is taken for it: here the day's, the one set a scene has
// since 58d70ea7e, remembered under the day's key.
it('takes the colours a scene names, draws nothing, and remembers them', async () => {
  mockPack = memberPack({
    windowColours: NAMED,
    windowColourStops: { '100': NAMED },
  });
  const sky = await measureSceneSky(
    'premium:named',
    nextVersion(),
    undefined,
    '100',
  );
  expect(mockSample).not.toHaveBeenCalled();
  expect(sky).toMatchObject({ chroma: expect.any(Number) });
  expect(mockRemember).toHaveBeenCalledWith(
    'premium:named@100',
    String(version),
    sky,
  );
});

it('works them out from a palette, drawing nothing', async () => {
  mockPack = memberPack({
    palettes: [
      {
        id: 'colours',
        names: { en: 'Colours' },
        stops: ['#2a1650', '#3b1d70', '#4a2590', '#20d8ff'],
      },
    ],
  });
  const sky = await measureSceneSky('premium:palette', nextVersion());
  expect(mockSample).not.toHaveBeenCalled();
  expect(sky).toBeDefined();
});

it('control: draws a scene that says neither, as before', async () => {
  mockPack = memberPack();
  // A violet frame, so the drawing has something to measure.
  mockSample.mockResolvedValue(
    new Uint8Array(
      Array.from({ length: 256 }, (_, i) => [60, 30, 120, 255][i % 4]),
    ),
  );
  await measureSceneSky('premium:silent', nextVersion());
  expect(mockSample).toHaveBeenCalledTimes(1);
});

// A choice can swap the palette a scene is drawn in, so the colour is
// measured for the listener's choices and remembered under them: measured
// at the pack's own, the panes kept the default's colour while Colourful
// mode wore the chosen one.
it("draws a scene as the listener's choices leave it, and remembers it under them", async () => {
  mockPack = memberPack({
    params: [
      {
        id: 'mode',
        names: { en: 'Mode' },
        min: 0,
        max: 1,
        value: 1,
        options: [{ names: { en: 'Day' } }, { names: { en: 'Night' } }],
      },
      { id: 'glow', names: { en: 'Glow' }, min: 0, max: 1, value: 0.5 },
    ],
  });
  mockSample.mockResolvedValue(
    new Uint8Array(
      Array.from({ length: 256 }, (_, i) => [60, 30, 120, 255][i % 4]),
    ),
  );
  const at = nextVersion();
  await measureSceneSky('premium:choice', at, { mode: 0, glow: 0.9 });
  const [drawn] = mockSample.mock.calls[0] as [IScenePack];
  expect(drawn.params.find((param) => param.id === 'mode')?.value).toBe(0);
  // Only choices: a slider moved is not a new measurement.
  expect(drawn.params.find((param) => param.id === 'glow')?.value).toBe(0.5);
  expect(mockRemember).toHaveBeenCalledWith(
    'premium:choice',
    `${at}#mode=0`,
    expect.anything(),
  );
  // The other choice is measured apart; the same one again is not.
  await measureSceneSky('premium:choice', at, { mode: 1 });
  await measureSceneSky('premium:choice', at, { mode: 0, glow: 0.1 });
  expect(mockSample).toHaveBeenCalledTimes(2);
  expect(mockRemember).toHaveBeenLastCalledWith(
    'premium:choice',
    `${at}#mode=1`,
    expect.anything(),
  );
});
