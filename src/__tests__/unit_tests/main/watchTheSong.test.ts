/**
 * @jest-environment node
 */

/**
 * watch_the_song (Ivan, 2026-11-11: "scenes that animate with music and use
 * all capabilities"): the scene at the moments a song is made of, and
 * whether the drop changes more of the picture than an ordinary moment of
 * the plain bar does. The verdict is the scene measured against itself, so
 * these pictures are made to differ by known amounts.
 */

import { STUDIO_AGENT_SILENCE_S } from '../../../common/studioAgent';
import type { ILookRequest } from '../../../main/studioAgent/lookRequest';
import type { IMcpToolResult } from '../../../main/studioAgent/mcpProtocol';
import {
  createSongTool,
  describeSong,
  SONG_SCHEMA,
  songMoments,
} from '../../../main/studioAgent/songTool';
import type { IPixels } from '../../../main/studioAgent/watchFrames';

const WIDTH = 96;
const HEIGHT = 48;

/** A dark picture with `lit` of its rows, from the top, bright. */
const picture = (lit: number): IPixels => {
  const data = new Uint8Array(WIDTH * HEIGHT * 4).fill(20);
  data.fill(240, 0, lit * WIDTH * 4);
  return { data, width: WIDTH, height: HEIGHT };
};

/** The six pictures a scene gives, by how many rows each has lit. */
type TRows = [number, number, number, number, number, number];

const toolFor = (rows: TRows, failAt?: number) => {
  const asked: ILookRequest[] = [];
  const tool = createSongTool<{ at: number } | { refused: string }>({
    look: async (request) => {
      asked.push(request);
      return asked.length - 1 === failAt
        ? { refused: 'The scene does not compile.' }
        : { at: asked.length - 1 };
    },
    shapeNow: () => 'graph',
    pictures: {
      // The picture's bytes are just which of the six it is.
      decode: (bytes) => picture(rows[bytes[0]]),
      encodePng: () => new Uint8Array([1, 2, 3]),
    },
    pictureOf: (outcome) =>
      'at' in outcome ? new Uint8Array([outcome.at]) : undefined,
    explain: (outcome) => ({
      content: [
        { type: 'text', text: 'refused' in outcome ? outcome.refused : '' },
      ],
      isError: true,
    }),
    titleOf: () => 'Lake (id lake, version 3)',
  });
  return { tool, asked };
};

const said = async (answer: Promise<IMcpToolResult>) =>
  (await answer).content
    .map((part) => ('text' in part ? part.text : ''))
    .join('');

describe('the six moments', () => {
  it('are silence at rest, two of a plain bar, the build, the drop and after', () => {
    const beat = 60 / 118;
    const moments = songMoments();
    expect(moments.map(({ sound }) => sound)).toEqual([
      'silence',
      'music',
      'music',
      'music',
      'music',
      'music',
    ]);
    expect(moments[0].seconds).toBe(STUDIO_AGENT_SILENCE_S);
    expect(moments[1].seconds).toBeCloseTo(2 * beat, 3);
    // The drop is beat 8 of the test song: one frame before it lands, one after.
    expect(moments[3].seconds).toBeLessThan(8 * beat);
    expect(moments[4].seconds).toBeGreaterThan(8 * beat);
    expect(moments[5].seconds).toBeCloseTo(14 * beat, 3);
  });

  it('put the plain bar’s two frames as far apart as the drop’s two', () => {
    const [, first, second, build, landed] = songMoments();
    expect(second.seconds - first.seconds).toBeCloseTo(
      landed.seconds - build.seconds,
      3,
    );
  });

  it('follow another tempo', () => {
    expect(songMoments(60)[1].seconds).toBe(2);
    expect(songMoments(60)[4].seconds).toBeCloseTo(8.1, 5);
  });
});

describe('the Song check', () => {
  it('says nothing answers the music when silence and the bar are one picture', () => {
    const lines = describeSong([0, 0, 0, 0, 0]);
    expect(lines.join('\n')).toContain('Song check: NOTHING ANSWERS THE MUSIC');
  });

  it('says the drop does not show when it changes no more than an ordinary moment', () => {
    expect(describeSong([0.2, 0.05, 0.03, 0.05, 0.04]).join('\n')).toContain(
      'Song check: THE DROP DOES NOT SHOW',
    );
    expect(describeSong([0.2, 0.05, 0.03, 0.04, 0.04]).join('\n')).toContain(
      'Song check: THE DROP DOES NOT SHOW',
    );
    // Nothing at all on the drop, in a scene whose bar holds still too.
    expect(describeSong([0.2, 0, 0, 0.001, 0]).join('\n')).toContain(
      'Song check: THE DROP DOES NOT SHOW',
    );
  });

  it('says the drop shows, and by how many times, when it changes more', () => {
    const text = describeSong([0.2, 0.05, 0.03, 0.15, 0.04]).join('\n');
    expect(text).toContain(
      'Song check: the drop shows - 3.0 times what an ordinary moment of the plain bar changes.',
    );
    expect(text).not.toContain('DOES NOT');
    expect(text).not.toContain('The build does not');
  });

  it('gives no ratio against a bar that holds still', () => {
    expect(describeSong([0.2, 0, 0.03, 0.15, 0.04]).join('\n')).toContain(
      'the plain bar holds still and the drop moves the picture',
    );
  });

  it('says when nothing gathers before a drop that shows', () => {
    expect(describeSong([0.2, 0.05, 0, 0.15, 0.04]).join('\n')).toContain(
      'The build does not: frame 4 is the plain bar again.',
    );
  });

  it('gives every change as a share of the light', () => {
    const lines = describeSong([0.2, 0.05, 0.03, 0.15, 0.04]);
    expect(lines[0]).toBe(
      'Silence to the plain bar: 20.0% of the light changed.',
    );
    expect(lines[3]).toContain('15.0%');
  });
});

describe('watch_the_song', () => {
  it('takes six looks of the same scene, changing only the sound and the moment', async () => {
    const { tool, asked } = toolFor([0, 4, 5, 6, 24, 5]);
    await tool.call({ shape: 'full-screen', sliders: { glow: 0.8 } });
    expect(asked).toHaveLength(6);
    expect(asked.map(({ sound, seconds }) => [sound, seconds])).toEqual(
      songMoments().map(({ sound, seconds }) => [sound, seconds]),
    );
    asked.forEach((request) => {
      expect(request.shape).toBe('full-screen');
      expect(request.sliders).toEqual({ glow: 0.8 });
    });
  });

  it('answers with the strip and a drop that shows, for a scene that opens on it', async () => {
    const { tool } = toolFor([0, 4, 5, 6, 24, 5]);
    const answer = await tool.call({});
    expect(answer.isError).toBeUndefined();
    expect(answer.content[1]).toMatchObject({
      type: 'image',
      mimeType: 'image/png',
    });
    const text = await said(Promise.resolve(answer));
    expect(text).toContain('Lake (id lake, version 3): six moments');
    expect(text).toContain('(graph)');
    expect(text).toContain('5. the drop, landed');
    expect(text).toContain('Song check: the drop shows');
  });

  it('finds a drop that does not show in a scene that only keeps time', async () => {
    // The bar moves by a row between its two frames; so does the drop.
    const { tool } = toolFor([0, 4, 5, 5, 6, 5]);
    expect(await said(tool.call({}))).toContain(
      'Song check: THE DROP DOES NOT SHOW',
    );
  });

  it('finds a scene the music does not reach', async () => {
    const { tool } = toolFor([5, 5, 5, 5, 5, 5]);
    expect(await said(tool.call({}))).toContain(
      'Song check: NOTHING ANSWERS THE MUSIC',
    );
  });

  it('chooses the sound and the moments itself', async () => {
    const { tool, asked } = toolFor([0, 4, 5, 6, 24, 5]);
    const refusals = await Promise.all(
      [{ sound: 'silence' }, { seconds: 3 }, { beats: 8 }].map((args) =>
        tool.call(args),
      ),
    );
    refusals.forEach((answer) => expect(answer.isError).toBe(true));
    expect(asked).toEqual([]);
    expect(Object.keys(SONG_SCHEMA.properties)).toEqual(
      expect.arrayContaining(['shape', 'sliders', 'camera', 'tempo']),
    );
    ['sound', 'seconds', 'beats'].forEach((key) =>
      expect(SONG_SCHEMA.properties).not.toHaveProperty(key),
    );
  });

  it('refuses what look_at_scene refuses, in its words, before any look', async () => {
    const { tool, asked } = toolFor([0, 4, 5, 6, 24, 5]);
    const answer = await tool.call({ shape: 'square' });
    expect(answer.isError).toBe(true);
    expect(asked).toEqual([]);
  });

  it('stops at the first look that fails and says why, as a look would', async () => {
    const { tool, asked } = toolFor([0, 4, 5, 6, 24, 5], 2);
    const answer = await tool.call({});
    expect(answer.isError).toBe(true);
    expect(await said(Promise.resolve(answer))).toBe(
      'The scene does not compile.',
    );
    expect(asked).toHaveLength(3);
  });

  it('changes nothing, and says so to the caller', () => {
    const { tool } = toolFor([0, 4, 5, 6, 24, 5]);
    expect(tool.name).toBe('watch_the_song');
    expect(tool.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    });
  });
});
