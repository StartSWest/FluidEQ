/**
 * @jest-environment node
 */
import type { ILookRequest } from '../../../main/studioAgent/lookRequest';
import { createViewsTool } from '../../../main/studioAgent/viewsTool';

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
