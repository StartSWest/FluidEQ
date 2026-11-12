/**
 * @jest-environment node
 */
import type { ILookRequest } from '../../../main/studioAgent/lookRequest';
import type { TStudioAgentShape } from '../../../common/studioAgent';
import {
  createViewsTool,
  stageViewLine,
  viewsInOrder,
  VIEW_SHAPES,
} from '../../../main/studioAgent/viewsTool';

/**
 * look_at_views (Ivan, 2026-11-11: "the agent needs to be able to look at
 * standard, ultra wide and mobile to check the 3 views always"): one call,
 * three looks, one answer.
 */
describe('look_at_views', () => {
  type TOutcome = { ok: boolean; shape: string };

  const setUp = (failAt?: number) => {
    const asked: ILookRequest[] = [];
    const tool = createViewsTool<TOutcome>({
      look: async (request) => {
        asked.push(request);
        return { ok: asked.length !== failAt, shape: request.shape };
      },
      describe: (_request, outcome) =>
        outcome.ok
          ? {
              content: [
                { type: 'text', text: `drawn ${outcome.shape}` },
                { type: 'image', data: outcome.shape, mimeType: 'image/jpeg' },
              ],
            }
          : undefined,
      explain: () => ({
        content: [{ type: 'text', text: 'the shader does not compile' }],
        isError: true,
      }),
    });
    return { tool, asked };
  };

  it("draws the graph, the ultra-wide graph and the player's whole column, the same moment in each", async () => {
    const { tool, asked } = setUp();
    const result = await tool.call({ seconds: 3, sliders: { daylight: 0 } });
    expect(asked.map((request) => request.shape)).toEqual([
      'graph',
      'ultra-wide-graph',
      'compact-player-column',
    ]);
    expect(asked.every((request) => request.seconds === 3)).toBe(true);
    expect(asked.every((request) => request.sliders.daylight === 0)).toBe(true);
    expect(result.isError).toBeUndefined();
    const pictures = result.content.flatMap((part) =>
      part.type === 'image' ? [part.data] : [],
    );
    expect(pictures).toEqual([
      'graph',
      'ultra-wide-graph',
      'compact-player-column',
    ]);
    const words = result.content
      .flatMap((part) => (part.type === 'text' ? [part.text] : []))
      .join('\n');
    // Each picture under the name the member uses for it.
    expect(words.indexOf('STANDARD')).toBeLessThan(words.indexOf('ULTRA WIDE'));
    expect(words.indexOf('ULTRA WIDE')).toBeLessThan(words.indexOf('MOBILE'));
    expect(words).toContain('look at all three again');
  });

  it('says once why a scene cannot be drawn, and draws no more', async () => {
    const { tool, asked } = setUp(2);
    const result = await tool.call({});
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: 'the shader does not compile' },
    ]);
    expect(asked).toHaveLength(2);
  });

  it('takes no shape, and offers none', async () => {
    const { tool, asked } = setUp();
    const result = await tool.call({ shape: 'graph' });
    expect(result.isError).toBe(true);
    expect(asked).toHaveLength(0);
    expect(
      Object.keys((tool.inputSchema as { properties: object }).properties),
    ).not.toContain('shape');
    // The control: every other argument of a look is still offered.
    expect(
      Object.keys((tool.inputSchema as { properties: object }).properties),
    ).toEqual(
      expect.arrayContaining(['seconds', 'sliders', 'camera', 'sound']),
    );
  });
});

/**
 * The view on the member's stage comes first (Ivan, 2026-11-12: "it must
 * always look first at the image the user is viewing"), and every turn
 * names it, so "look, I'm looking at this" needs no question back.
 */
describe('the view the member is looking at', () => {
  const lookIn = async (now: TStudioAgentShape | undefined) => {
    const asked: string[] = [];
    const words: string[] = [];
    const tool = createViewsTool<{ shape: string }>({
      look: async (request) => {
        asked.push(request.shape);
        return { shape: request.shape };
      },
      describe: (_request, outcome) => ({
        content: [
          { type: 'image', data: outcome.shape, mimeType: 'image/jpeg' },
        ],
      }),
      explain: () => ({ content: [] }),
      ...(now ? { shapeNow: () => now } : {}),
    });
    const result = await tool.call({});
    result.content.forEach((part) => {
      if (part.type === 'text') {
        words.push(part.text);
      }
    });
    return { asked, words };
  };

  it('leads look_at_views, said to be theirs', async () => {
    const { asked, words } = await lookIn('ultra-wide-graph');
    expect(asked).toEqual([
      'ultra-wide-graph',
      'graph',
      'compact-player-column',
    ]);
    expect(words[0]).toMatch(/^THE VIEW THE MEMBER HAS ON THEIR STAGE NOW/);
    expect(words[0]).toContain('ULTRA WIDE');
    const mobile = await lookIn('compact-player-column');
    expect(mobile.asked[0]).toBe('compact-player-column');
  });

  it('leaves the usual order, and claims no view, when the stage shows none of the three', async () => {
    const { asked, words } = await lookIn(undefined);
    expect(asked).toEqual([
      'graph',
      'ultra-wide-graph',
      'compact-player-column',
    ]);
    expect(words.join('\n')).not.toContain('THE VIEW THE MEMBER HAS');
    expect(viewsInOrder('full-screen')).toBe(VIEW_SHAPES);
  });

  it('is named to the chat with the member’s words', () => {
    expect(stageViewLine('ultra-wide-graph')).toContain('ULTRA WIDE');
    expect(stageViewLine('compact-player-column')).toContain('MOBILE');
    expect(stageViewLine('graph')).toContain('STANDARD');
    expect(stageViewLine('graph')).toMatch(/not the member/);
  });
});
