/**
 * @jest-environment node
 */
import fs from 'fs';
import path from 'path';
import { NIGHT_BACKGROUND_MOST } from '../../../common/sceneDaylight';
import type { IScenePack } from '../../../common/scenePacks';
import {
  STUDIO_AGENT_MOMENT_KEYS,
  type IStudioAgentMoment,
} from '../../../common/studioAgent';
import {
  createStudioTools,
  type TLookOutcome,
} from '../../../main/studioAgent/studioTools';
import { darkLevel, darknessLines } from '../../../main/studioAgent/darkLevel';

/**
 * How dark a look's picture is, as numbers (Ivan, 2026-11-11: "all scenes I
 * build always make night at 0 too light; it needs to be fully black look,
 * as dark as the night"): the measure, and what a look at Daylight 0 says of
 * it.
 */

type TColour = readonly [number, number, number];

/** A picture of `pixels` pixels: each colour filling its share, in order. */
const picture = (pixels: number, shares: readonly [number, TColour][]) => {
  const data = new Uint8Array(pixels * 4);
  let at = 0;
  shares.forEach(([share, colour]) => {
    const count = Math.round(pixels * share);
    for (let i = 0; i < count && at < pixels; i += 1, at += 1) {
      data.set([...colour, 255], at * 4);
    }
  });
  return { data, width: pixels, height: 1 };
};

const BLACK: TColour = [0, 0, 0];
const WHITE: TColour = [255, 255, 255];

describe('how dark a picture is', () => {
  it('is black at 0 and white at 100, with all of white lit', () => {
    expect(darkLevel(picture(100, [[1, BLACK]]))).toEqual({
      background: 0,
      lit: 0,
    });
    expect(darkLevel(picture(100, [[1, WHITE]]))).toEqual({
      background: 100,
      lit: 100,
    });
  });

  it('reads the background from the darkest 60%, whatever the rest is', () => {
    // A black night with a moon, lamps and their glow over four tenths of it.
    expect(
      darkLevel(
        picture(1000, [
          [0.6, BLACK],
          [0.4, WHITE],
        ]),
      ),
    ).toEqual({ background: 0, lit: 40 });
    // The control: one more tenth of light reaches into the darkest 60%.
    expect(
      darkLevel(
        picture(1000, [
          [0.5, BLACK],
          [0.5, WHITE],
        ]),
      ).background,
    ).toBeCloseTo(16.7, 1);
  });

  it('finds the darkest pixels wherever they are in the picture', () => {
    const sorted = picture(1000, [
      [0.6, [10, 10, 10]],
      [0.4, [200, 200, 200]],
    ]);
    const shuffled = picture(1000, [
      [0.2, [200, 200, 200]],
      [0.3, [10, 10, 10]],
      [0.2, [200, 200, 200]],
      [0.3, [10, 10, 10]],
    ]);
    expect(darkLevel(shuffled)).toEqual(darkLevel(sorted));
  });

  it('counts a blue wash as light: a pixel is as bright as its brightest channel', () => {
    // A "night" sky of deep blue: 7% by luminance, and plainly lit on screen.
    const blue = darkLevel(picture(100, [[1, [0, 0, 80]]]));
    expect(blue.background).toBeCloseTo(31.4, 1);
    // The same number whichever order the decoder hands the channels in.
    expect(darkLevel(picture(100, [[1, [80, 0, 0]]]))).toEqual(blue);
  });

  it('calls lit only what is 60% bright or more', () => {
    expect(darkLevel(picture(100, [[1, [152, 0, 0]]])).lit).toBe(0);
    expect(darkLevel(picture(100, [[1, [153, 0, 0]]])).lit).toBe(100);
  });

  it('answers for a picture with nothing in it', () => {
    expect(darkLevel({ data: new Uint8Array(0), width: 0, height: 0 })).toEqual(
      { background: 0, lit: 0 },
    );
  });
});

describe('what a look says of the night', () => {
  const dark = { background: NIGHT_BACKGROUND_MOST, lit: 3 };
  const light = { background: NIGHT_BACKGROUND_MOST + 0.1, lit: 3 };

  it('gives the numbers for any look, and no verdict away from Daylight 0', () => {
    [undefined, 50, 100, 1].forEach((daylight) => {
      const lines = darknessLines(light, { daylight, silent: true });
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain(`${light.background}%`);
      expect(lines[0]).toContain('3% of the picture is lit');
    });
  });

  it('passes a night at the limit, in silence at Daylight 0', () => {
    const lines = darknessLines(dark, { daylight: 0, silent: true });
    expect(lines[1]).toMatch(/^Night check \(daylight 0, silence\): PASSES/);
  });

  it('fails one a tenth over it, says by how much, and says what to look for', () => {
    const lines = darknessLines(light, { daylight: 0, silent: true });
    expect(lines[1]).toMatch(/^Night check \(daylight 0, silence\): TOO LIGHT/);
    expect(lines[1]).toContain(
      `at ${light.background}% and a night's is ${NIGHT_BACKGROUND_MOST}% or under`,
    );
    expect(lines[1]).toContain('ambient light term');
    expect(lines[1]).toContain('Do not tell the member the night is done');
  });

  it('gives no verdict under music, and asks for the look in silence', () => {
    const lines = darknessLines(light, { daylight: 0, silent: false });
    expect(lines[1]).toContain('checked in silence');
    expect(lines.join('\n')).not.toMatch(/PASSES|TOO LIGHT/);
  });
});

describe('a look at the scene', () => {
  const pack = {
    schema: 1,
    id: 'cat',
    version: 3,
    contract: 9,
    names: { en: 'Dancing Cat' },
    source: '',
    params: [
      { id: 'daylight', names: { en: 'Daylight' }, min: 0, max: 100, value: 0 },
    ],
  } as unknown as IScenePack;

  const outcome: TLookOutcome = {
    ok: true,
    pack,
    wave: { height: 1, position: 0 },
    camera: { yaw: 0, pitch: 0, zoom: 1 },
    answer: {
      ok: true,
      image: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
      width: 1280,
      height: 720,
      drawMs: 3,
      renderWidth: 1280,
      renderHeight: 720,
      spectrumRect: [0, 1, 0, 1],
      moment: Object.fromEntries(
        STUDIO_AGENT_MOMENT_KEYS.map((key) => [key, 0]),
      ) as unknown as IStudioAgentMoment,
    },
  };

  /** What the model is told of a look whose picture decodes to `decoded`. */
  const told = async (
    decoded: ReturnType<typeof picture> | undefined | 'no-decoder',
    args: Record<string, unknown>,
  ) => {
    const [look] = createStudioTools({
      look: async () => outcome,
      hear: async () => 'no-window',
      ...(decoded === 'no-decoder'
        ? {}
        : {
            pictures: {
              decode: () => decoded,
              encodePng: () => new Uint8Array(),
            },
          }),
    });
    const [words] = (await look.call(args)).content;
    return words.type === 'text' ? words.text : '';
  };

  const NIGHT = { sliders: { daylight: 0 }, sound: 'silence' };

  it('says a black night passes, from the pixels of its own picture', async () => {
    const words = await told(picture(100, [[1, [2, 2, 2]]]), NIGHT);
    expect(words).toContain(
      'its background (the darkest 60% of it) is at 0.8%',
    );
    expect(words).toMatch(/Night check \(daylight 0, silence\): PASSES/);
  });

  it('says a washed-out night is too light, and by how much', async () => {
    const words = await told(picture(100, [[1, [40, 40, 60]]]), NIGHT);
    expect(words).toMatch(/Night check \(daylight 0, silence\): TOO LIGHT/);
    expect(words).toContain('The background is at 23.5%');
  });

  it('gives the numbers alone by day, and when no time of day was asked for', async () => {
    const light = picture(100, [[1, [40, 40, 60]]]);
    const byDay = await told(light, {
      sliders: { daylight: 100 },
      sound: 'silence',
    });
    expect(byDay).toContain('How dark this picture is');
    expect(byDay).not.toContain('Night check');
    const asPlayed = await told(light, { sound: 'silence' });
    expect(asPlayed).toContain('How dark this picture is');
    expect(asPlayed).not.toContain('Night check');
  });

  it('gives no verdict on a night looked at with the music on', async () => {
    const words = await told(picture(100, [[1, [40, 40, 60]]]), {
      sliders: { daylight: 0 },
    });
    expect(words).toContain('the night is checked in silence');
    expect(words).not.toMatch(/PASSES|TOO LIGHT/);
  });

  it('checks the night in each of the three views', async () => {
    const tools = createStudioTools({
      look: async () => outcome,
      hear: async () => 'no-window',
      pictures: {
        decode: () => picture(100, [[1, [40, 40, 60]]]),
        encodePng: () => new Uint8Array(),
      },
    });
    const views = tools.find((tool) => tool.name === 'look_at_views');
    const result = await views?.call(NIGHT);
    const words = (result?.content ?? [])
      .flatMap((part) => (part.type === 'text' ? [part.text] : []))
      .join('\n');
    expect(
      words.match(/Night check \(daylight 0, silence\): TOO LIGHT/g),
    ).toHaveLength(3);
  });

  it('still answers where the picture cannot be read, without the numbers', async () => {
    const unread = await told(undefined, NIGHT);
    expect(unread).toMatch(/Dancing Cat/);
    expect(unread).not.toContain('How dark');
    expect(await told('no-decoder', NIGHT)).not.toContain('How dark');
  });
});

describe('the night line, wherever it is written', () => {
  const read = (file: string) =>
    fs.readFileSync(path.join(__dirname, '../../../..', file), 'utf8');

  it("is the same number in the skills as in FluidEQ's own check", () => {
    const night = read(
      'assets/studio/fluideq/skills/fluideq-night-and-day/SKILL.md',
    );
    expect(night).toContain(
      `**Night passes at ${NIGHT_BACKGROUND_MOST}% or under.**`,
    );
    expect(night).toContain(
      `the background must measure ${NIGHT_BACKGROUND_MOST}% or under`,
    );
    expect(
      read('assets/studio/fluideq/skills/fluideq-finish/SKILL.md'),
    ).toContain(`the background at ${NIGHT_BACKGROUND_MOST}% or under`);
  });
});
