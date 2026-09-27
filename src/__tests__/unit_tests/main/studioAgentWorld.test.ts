/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IScenePack } from '../../../common/scenePacks';
import type { TStudioAgentDrawAnswer } from '../../../common/studioAgent';
import type { IWorldReport, TWorldNote } from '../../../common/worldNotes';
import { readDrawAnswer } from '../../../main/studioAgent/drawAnswer';
import { createStudioTools } from '../../../main/studioAgent/studioTools';

/**
 * What the member's AI is told about a scene's 3D world, which a picture
 * cannot say for itself: a sky drawn alone looks like a finished scene, and
 * an AI shown one kept editing the sky. The window's report is a stranger's,
 * read before any of it is passed on; what is passed on says whether the
 * world was drawn, and why a part of it was not.
 */

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);

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

const GOOD = {
  ok: true as const,
  image: JPEG,
  width: 1280,
  height: 720,
  drawMs: 12.5,
  renderWidth: 1920,
  renderHeight: 1080,
  spectrumRect: [0, 1, 0.27, 0.49] as const,
  moment: MOMENT,
};

const EVERY_NOTE: TWorldNote[] = [
  { code: 'engine-missing' },
  { code: 'engine-failed', detail: 'NetworkError' },
  { code: 'engine-unsupported' },
  { code: 'material', log: "ERROR: 0:3: 'uNope' : undeclared" },
  { code: 'model-refused', model: 'ship' },
  { code: 'model-unreadable', model: 'tree', detail: 'bad chunk' },
];

const worldRead = (world: unknown) => {
  const answer = readDrawAnswer({ ...GOOD, world }, { shape: 'wide' });
  return answer.ok ? answer.world : 'refused';
};

describe('the world’s report in the window’s answer', () => {
  it('passes on every kind of note, drawn or not', () => {
    expect(worldRead({ drawn: false, notes: EVERY_NOTE })).toEqual({
      drawn: false,
      notes: EVERY_NOTE,
    });
    expect(worldRead({ drawn: true, notes: [] })).toEqual({
      drawn: true,
      notes: [],
    });
  });

  it('drops a note it does not know, one missing its words, and anything a note carries besides', () => {
    expect(
      worldRead({
        drawn: false,
        notes: [
          { code: 'teapot' },
          'engine-missing',
          null,
          { code: 'material' },
          { code: 'model-refused', model: 7 },
          { code: 'model-unreadable', model: 'tree' },
          { code: 'engine-failed' },
          { code: 'engine-missing', script: 'alert(1)' },
        ],
      }),
    ).toEqual({ drawn: false, notes: [{ code: 'engine-missing' }] });
  });

  it.each([
    ['drawn is not a yes or no', { drawn: 'false', notes: [] }],
    ['drawn is a number', { drawn: 0, notes: [] }],
    ['notes are not a list', { drawn: false, notes: 'none' }],
    ['it is not a report', 'the world drew'],
  ])('carries no world when %s', (_what, world) => {
    expect(worldRead(world)).toBeUndefined();
  });

  it('cuts a note’s words to their bounds', () => {
    const long = 'a'.repeat(20000);
    const [failed, refused] = (
      worldRead({
        drawn: false,
        notes: [
          { code: 'engine-failed', detail: long },
          { code: 'model-refused', model: long },
        ],
      }) as IWorldReport
    ).notes;
    expect(failed).toEqual({
      code: 'engine-failed',
      detail: long.slice(0, 16 * 1024),
    });
    expect(refused).toEqual({
      code: 'model-refused',
      model: long.slice(0, 64),
    });
  });

  it('strips control characters from a note’s words but keeps line breaks and tabs', () => {
    expect(
      worldRead({
        drawn: false,
        notes: [
          {
            code: 'material',
            log: 'ERROR:\u0000 0:3\r\n\tline\u0007\u001b[31m\u007f',
          },
          { code: 'model-refused', model: 'sh\u0000ip' },
        ],
      }),
    ).toEqual({
      drawn: false,
      notes: [
        { code: 'material', log: 'ERROR: 0:3\n\tline[31m' },
        { code: 'model-refused', model: 'ship' },
      ],
    });
  });

  it('keeps the first 32 notes and no more', () => {
    const notes = Array.from({ length: 40 }, (_, i) => ({
      code: 'model-refused',
      model: `m${i}`,
    }));
    expect(worldRead({ drawn: false, notes })).toEqual({
      drawn: false,
      notes: notes.slice(0, 32),
    });
  });
});

const PACK = {
  schema: 1,
  id: 'lantern-lake',
  version: 2,
  contract: 8,
  names: { en: 'Lantern Lake' },
  fallbackStyle: 'bars',
  swatch: ['#000000', '#ffffff'],
  source: 'vec4 sceneColour(vec2 uv) { return vec4(uv, 0.0, 1.0); }',
  params: [],
} as unknown as IScenePack;

/** The words the AI is told about a picture whose world reported `world`. */
const toldAbout = async (world?: IWorldReport): Promise<string> => {
  const answer: Extract<TStudioAgentDrawAnswer, { ok: true }> = {
    ...GOOD,
    ...(world ? { world } : {}),
  };
  const [look] = createStudioTools({
    look: async () => ({
      ok: true,
      pack: PACK,
      wave: { height: 1, position: 0 },
      camera: { yaw: 0, pitch: 0, zoom: 1 },
      answer,
    }),
    hear: async () => 'no-window',
  });
  const [words] = (await look.call({})).content;
  return words.type === 'text' ? words.text : '';
};

describe('what the AI is told of the world', () => {
  it('says the world was NOT drawn, and why, in English with the model and the driver’s own words', async () => {
    const told = await toldAbout({ drawn: false, notes: EVERY_NOTE });
    const lines = told.split('\n');
    expect(lines[1]).toMatch(
      /^The 3D world was NOT drawn: this picture is the pack's shader alone/,
    );
    expect(lines.slice(2, 9)).toEqual([
      '- FluidEQ cannot run its 3D engine here, so the sky plays alone.',
      '- The 3D engine stopped with an error: NetworkError',
      '- This computer’s graphics cannot draw a 3D world into the scene.',
      '- A material’s GLSL did not compile. The graphics driver says:',
      "ERROR: 0:3: 'uNope' : undeclared",
      '- Model “ship” is not one FluidEQ can read, so it was left out.',
      '- Model “tree” could not be read: bad chunk',
    ]);
  });

  it('quotes a model’s id and an error as written, never as a replacement pattern', async () => {
    const told = await toldAbout({
      drawn: false,
      notes: [{ code: 'model-unreadable', model: "$&$'", detail: '$`$$' }],
    });
    expect(told).toContain("- Model “$&$'” could not be read: $`$$");
  });

  it('cuts the driver’s log it quotes to 4000 characters', async () => {
    const told = await toldAbout({
      drawn: false,
      notes: [{ code: 'material', log: `${'x'.repeat(5000)}END` }],
    });
    expect(told).toContain(`says:\n${'x'.repeat(4000)}\n`);
    expect(told).not.toContain('END');
  });

  it('says a part was left out when the world drew with notes, and never that it was not drawn', async () => {
    const told = await toldAbout({
      drawn: true,
      notes: [{ code: 'model-refused', model: 'ship' }],
    });
    const lines = told.split('\n');
    expect(lines.slice(1, 3)).toEqual([
      'Part of the 3D world was left out; the picture shows the rest of it:',
      '- Model “ship” is not one FluidEQ can read, so it was left out.',
    ]);
    expect(told).not.toContain('NOT drawn');
  });

  it('says nothing of the world when it drew whole, or when there is none', async () => {
    const whole = await toldAbout({ drawn: true, notes: [] });
    const none = await toldAbout();
    expect(whole).not.toMatch(/3D world/);
    expect(whole).toBe(none);
    expect(none.split('\n')[1]).toMatch(/^The member's wave/);
  });
});
