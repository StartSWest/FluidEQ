/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

jest.mock('electron', () => ({ ipcMain: { handle: jest.fn() } }));

/* eslint-disable import/first -- the electron mock must be installed first */
import os from 'os';
import path from 'path';
import type { IScenePack } from '../../../common/scenePacks';
import {
  findAgentProject,
  sameFolder,
} from '../../../main/studioAgent/agentProject';
import {
  readDrawAnswer,
  withSliders,
} from '../../../main/studioAgent/drawAnswer';
import { readLookRequest } from '../../../main/studioAgent/lookRequest';
import {
  createStudioTools,
  type TLookOutcome,
} from '../../../main/studioAgent/studioTools';

/**
 * What the member's AI may ask the Studio's agent door and what it is told:
 * every argument checked before anything is read, only the Studio's own
 * projects reachable, the window's answer checked as a stranger's, and the
 * member's own reasons — the same sentences the Studio shows — passed on.
 */

const pack = {
  schema: 1,
  id: 'gato-baila',
  version: 3,
  contract: 7,
  names: { en: 'Dancing Cat' },
  fallbackStyle: 'bars',
  swatch: ['#000000', '#ffffff'],
  source: 'vec4 sceneColour(vec2 uv) { return vec4(uv, 0.0, 1.0); }',
  params: [
    { id: 'dance', names: { en: 'Dance' }, min: 0, max: 1, value: 0.7 },
    { id: 'lights', names: { en: 'Lights' }, min: 0, max: 2, value: 1 },
  ],
} as unknown as IScenePack;

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);

describe('the arguments', () => {
  test('nothing asked is the wide picture under the test music', () => {
    expect(readLookRequest({})).toEqual({
      shape: 'wide',
      sound: 'music',
      sliders: {},
    });
  });

  test('every argument the schema names is read', () => {
    expect(
      readLookRequest({
        folder: 'D:\\Studio\\cat',
        shape: 'ribbon',
        sound: 'silence',
        seconds: 2.5,
        sliders: { dance: 1 },
        wave: { height: 0.25, position: 0.6 },
      }),
    ).toEqual({
      folder: 'D:\\Studio\\cat',
      shape: 'ribbon',
      sound: 'silence',
      seconds: 2.5,
      sliders: { dance: 1 },
      wave: { height: 0.25, position: 0.6 },
    });
  });

  test.each([
    [{ command: 'rm -rf' }, /no argument called/],
    [{ shape: 'huge' }, /shape must be/],
    [{ sound: 'loud' }, /sound must be/],
    [{ seconds: 0 }, /seconds must be/],
    [{ seconds: 60 }, /seconds must be/],
    [{ seconds: 'soon' }, /seconds must be/],
    [{ folder: '' }, /folder must be/],
    [{ folder: 'x'.repeat(2000) }, /folder must be/],
    [{ folder: 'C:\\a\0b' }, /folder must be/],
    [{ sliders: [1] }, /sliders must be/],
    [{ sliders: { __proto__x: 1 } }, /sliders must name/],
    [{ sliders: { dance: 'high' } }, /sliders must name/],
    [{ wave: { height: 0, position: 0 } }, /wave must be/],
    [{ wave: { height: 0.5, position: 0.5, extra: 1 } }, /wave must be/],
  ])('%j is refused with the reason', (args, reason) => {
    const read = readLookRequest(args as Record<string, unknown>);
    expect(typeof read).toBe('string');
    expect(read).toMatch(reason);
  });
});

/** The test music's first kick, as the scene heard it. */
const MOMENT = {
  beatPhase: 0.02,
  barPhase: 0.5,
  tempo: 118,
  confidence: 1,
  kick: 0.95,
  snare: 0,
  hat: 0.8,
  intensity: 0.85,
  build: 0,
  drop: 0,
  drops: 1,
  balance: 0.1,
  width: 0.4,
  level: 0.6,
  beat: 0.9,
  accent: 0,
  voiceOpen: 0,
  voicePitch: 0,
  voiceSure: 0,
};

describe('the window’s answer', () => {
  const wide = { shape: 'wide' as const };
  const good = {
    ok: true,
    image: JPEG,
    width: 1280,
    height: 720,
    drawMs: 12.5,
    renderWidth: 1920,
    renderHeight: 1080,
    spectrumRect: [0, 1, 0.27, 0.49],
    moment: MOMENT,
  };

  test('a JPEG of the asked size is passed on', () => {
    expect(readDrawAnswer(good, wide)).toEqual(good);
  });

  test.each([
    [
      'not a JPEG',
      { ...good, image: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2]) },
    ],
    ['a JPEG with no end', { ...good, image: JPEG.slice(0, -1) }],
    ['another size', { ...good, width: 720 }],
    ['a negative cost', { ...good, drawMs: -1 }],
    ['no image', { ...good, image: 'aGVsbG8=' }],
    ['a band that is not four numbers', { ...good, spectrumRect: [0, 1, 0] }],
    ['a band with no number in it', { ...good, spectrumRect: [0, 1, NaN, 1] }],
  ])('%s is nothing the AI is shown', (_label, answer) => {
    expect(readDrawAnswer(answer, wide)).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  test('the driver’s words are passed on without control characters', () => {
    expect(
      readDrawAnswer(
        {
          ok: false,
          reason: 'compile',
          log: "ERROR: 0:4: 'x' : undeclared\n\u0000\u0007",
        },
        wide,
      ),
    ).toEqual({
      ok: false,
      reason: 'compile',
      log: "ERROR: 0:4: 'x' : undeclared\n",
    });
  });

  test('a reason it does not know is unavailable', () => {
    expect(readDrawAnswer({ ok: false, reason: 'owned' }, wide)).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });
});

describe('sliders for one picture', () => {
  test('are kept inside each slider’s own range', () => {
    const tuned = withSliders(pack, { dance: 5, lights: -1 });
    expect('unknown' in tuned).toBe(false);
    expect((tuned as IScenePack).params.map((param) => param.value)).toEqual([
      1, 0,
    ]);
    // The scene read from the folder is not changed by a picture of it.
    expect(pack.params.map((param) => param.value)).toEqual([0.7, 1]);
  });

  test('name only sliders the scene has', () => {
    expect(withSliders(pack, { glow: 1 })).toEqual({ unknown: 'glow' });
  });
});

describe('which project', () => {
  const list = {
    active: 'a',
    projects: [
      { id: 'a', folder: path.join(os.tmpdir(), 'Studio', 'Cat'), openedAt: 1 },
      {
        id: 'b',
        folder: path.join(os.tmpdir(), 'Studio', 'Lake'),
        openedAt: 2,
      },
      {
        id: 'c',
        folder: path.join(os.tmpdir(), 'Studio', 'Crystal'),
        openedAt: 3,
        official: 'crystal',
      },
    ],
  };
  const usable = () => true;

  test('no folder is the open project', () => {
    expect(findAgentProject(list, undefined, usable)).toEqual({
      ok: true,
      id: 'a',
      folder: list.projects[0].folder,
    });
    expect(
      findAgentProject({ ...list, active: undefined }, undefined, usable),
    ).toEqual({ ok: false, reason: 'none-open' });
  });

  test('a folder is found however Windows spells it', () => {
    expect(sameFolder('C:\\Studio\\Cat', 'c:/studio/cat/', 'win32')).toBe(true);
    expect(sameFolder('C:\\Studio\\Cat', 'C:\\Studio\\Cats', 'win32')).toBe(
      false,
    );
    expect(
      findAgentProject(list, list.projects[1].folder.toUpperCase(), usable),
    ).toEqual(
      process.platform === 'win32'
        ? { ok: true, id: 'b', folder: list.projects[1].folder }
        : { ok: false, reason: 'not-a-project' },
    );
  });

  test('anything off the list, and FluidEQ’s own scenes, are not projects', () => {
    expect(findAgentProject(list, os.tmpdir(), usable)).toEqual({
      ok: false,
      reason: 'not-a-project',
    });
    expect(findAgentProject(list, list.projects[2].folder, usable)).toEqual({
      ok: false,
      reason: 'not-a-project',
    });
  });

  test('a project the member may not use now is locked', () => {
    expect(findAgentProject(list, undefined, () => false)).toEqual({
      ok: false,
      reason: 'locked',
    });
  });
});

describe('what the AI is told', () => {
  const call = async (outcome: TLookOutcome, args = {}) => {
    const [look] = createStudioTools({
      look: async () => outcome,
      hear: async () => 'no-window',
    });
    return look.call(args);
  };

  test('the picture comes with what it is of and what it cost', async () => {
    const result = await call({
      ok: true,
      pack,
      wave: { height: 1, position: 0 },
      camera: { yaw: 0, pitch: 0, zoom: 1 },
      answer: {
        ok: true,
        image: JPEG,
        width: 1280,
        height: 720,
        drawMs: 72,
        renderWidth: 1920,
        renderHeight: 1080,
        spectrumRect: [0, 1, 0.2745, 0.49],
        moment: MOMENT,
      },
    });
    expect(result.isError).toBeUndefined();
    const [words, picture] = result.content;
    expect(picture).toEqual({
      type: 'image',
      data: Buffer.from(JPEG).toString('base64'),
      mimeType: 'image/jpeg',
    });
    expect(words.type === 'text' && words.text).toMatch(
      /Dancing Cat .*version 3/,
    );
    expect(words.type === 'text' && words.text).toMatch(/72 ms .* HEAVY/);
    // The band the scene was handed, so the AI need not work it out.
    expect(words.type === 'text' && words.text).toMatch(
      /uSpectrumRect was \(0, 1, 0\.275, 0\.49\)/,
    );
    expect(words.type === 'text' && words.text).toMatch(
      /dance 0\.7 \(0 to 1\)/,
    );
  });

  test('a version that cannot play says why, in the Studio’s own words', async () => {
    const result = await call({
      ok: false,
      reason: 'problems',
      problems: [{ code: 'loop-bound', file: 'source', line: 12 }],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: expect.stringContaining(
        '- scene.frag, line 12: A loop runs more than 128 times.',
      ),
    });
  });

  test('bad arguments are an error the model can read, not a crash', async () => {
    const result = await call(
      { ok: false, reason: 'none-open' },
      { shape: 'x' },
    );
    expect(result).toEqual({
      content: [
        { type: 'text', text: expect.stringMatching(/^shape must be/) },
      ],
      isError: true,
    });
  });
});
