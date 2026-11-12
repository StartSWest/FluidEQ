import type { TStudioAgentShape } from '../../common/studioAgent';
import { LOOK_SCHEMA, readLookRequest, type ILookRequest } from './lookRequest';
import type { IMcpTool, IMcpToolResult } from './mcpProtocol';

/**
 * `look_at_views`: the scene at the three places a listener meets it, in one
 * answer - the graph, the graph of an ultra-wide monitor, and the Compact
 * player's whole column (Ivan, 2026-11-11: "the agent needs to be able to
 * look at standard, ultra wide and mobile to check the 3 views always").
 *
 * Each was a look of its own, and a chat that had to ask three times asked
 * once: a scene came back right on the stage and cut in half on an
 * ultra-wide graph, or with a black slab under the player. One call that
 * answers all three is cheap enough to make after every change that can be
 * seen, which is what the brief now asks.
 *
 * It is `look_at_scene` asked three times and nothing else: the same
 * moment, sliders and camera in each, the same refusals in the same words.
 */

/** The three views, in the order they are answered. */
export const VIEW_SHAPES: readonly {
  shape: TStudioAgentShape;
  words: string;
}[] = [
  {
    shape: 'graph',
    words:
      "STANDARD - the EQ graph, the Studio stage's own shape. The subject whole, the picture composed.",
  },
  {
    shape: 'ultra-wide-window',
    words:
      "ULTRA WIDE - the whole window of an ultra-wide monitor, as the scene covers it behind the app. The graph, about 5.5:1, is the band from 4% to 90% across and 12% to 50% down: inside it nothing important lost off the ends, nothing stretched. Round it, to the window's foot, the scene carries on: no picture that just stops, nothing black or flat where the faders stand.",
  },
  {
    shape: 'compact-player-column',
    words:
      "MOBILE - the Compact player's whole column. The panel near the top holds the picture, its focus whole; everything under it is the scene running on past the panel's foot: nothing black, no hard line where the panel ends.",
  },
];

/**
 * The three views led by the one the member has on the stage (Ivan,
 * 2026-11-12: "it must always look first at the image the user is
 * viewing"), said to be theirs; in their own order when the stage shows
 * none of them.
 */
export const viewsInOrder = (
  now: TStudioAgentShape | undefined,
): typeof VIEW_SHAPES => {
  const theirs = VIEW_SHAPES.find(({ shape }) => shape === now);
  if (!theirs) {
    return VIEW_SHAPES;
  }
  return [
    { ...theirs, words: `${MEMBERS_VIEW} ${theirs.words}` },
    ...VIEW_SHAPES.filter((view) => view !== theirs),
  ];
};

const MEMBERS_VIEW = 'THE VIEW THE MEMBER HAS ON THEIR STAGE NOW, first:';

/** How a turn names the view on the member's stage, for "look at this". */
const STAGE_NAMES: Record<TStudioAgentShape, string> = {
  graph: 'STANDARD (the EQ graph)',
  'ultra-wide-graph': 'ULTRA WIDE (the graph on an ultra-wide monitor)',
  'ultra-wide-window':
    'ULTRA WIDE (the whole ultra-wide window, the graph framed in it)',
  'compact-player': "the Compact player's picture",
  'compact-player-column': "MOBILE (the Compact player's whole column)",
  'full-screen': 'FULL SCREEN',
};

/**
 * Said to the chat with each of the member's messages, after their words:
 * which view their stage shows, so "look, I'm looking at this" names one
 * without the AI having to ask. English: it is read by a model.
 */
export const stageViewLine = (shape: TStudioAgentShape): string =>
  `(FluidEQ, not the member: their stage shows the scene as ${STAGE_NAMES[shape]} now. "This", "here" and "what I see" mean that view; look at it first.)`;

export const VIEWS_SCHEMA = {
  ...LOOK_SCHEMA,
  properties: Object.fromEntries(
    Object.entries(LOOK_SCHEMA.properties).filter(([key]) => key !== 'shape'),
  ),
};

export interface IViewsToolDeps<TOutcome> {
  look(request: ILookRequest): Promise<TOutcome>;
  /** A look that drew, said as `look_at_scene` says it; undefined if it failed. */
  describe(
    request: ILookRequest,
    outcome: TOutcome,
  ): IMcpToolResult | undefined;
  /** A look that failed, in the same words. */
  explain(outcome: TOutcome): IMcpToolResult;
  /** The view on the member's stage, drawn first. */
  shapeNow?: () => TStudioAgentShape;
}

const failure = (words: string): IMcpToolResult => ({
  content: [{ type: 'text', text: words }],
  isError: true,
});

export const createViewsTool = <TOutcome>({
  look,
  describe,
  explain,
  shapeNow,
}: IViewsToolDeps<TOutcome>): IMcpTool => ({
  name: 'look_at_views',
  title: 'Look at all three views',
  description:
    "Draws the member's scene at the three places a listener meets it and returns the three pictures in one answer: STANDARD (the EQ graph), ULTRA WIDE (the graph on an ultra-wide monitor) and MOBILE (the Compact player's whole column, the scene running on under its panel), the view the member has on their stage first. Call it after every change that can be seen, before you tell the member anything is done: a scene is finished only when all three are right. It takes every argument look_at_scene takes except shape - the same moment, sliders, camera and sound in each view - and changes nothing. For one view alone, or full screen, use look_at_scene.",
  inputSchema: VIEWS_SCHEMA,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  call: async (args) => {
    if (Object.prototype.hasOwnProperty.call(args, 'shape')) {
      return failure(
        'look_at_views draws all three views and takes no shape. For one view, use look_at_scene.',
      );
    }
    const request = readLookRequest(args);
    if (typeof request === 'string') {
      return failure(request);
    }
    // One after another: the scene's worker draws one picture at a time,
    // and a scene that cannot be drawn at all is said once.
    const content: IMcpToolResult['content'] = [];
    let refused: IMcpToolResult | undefined;
    await viewsInOrder(shapeNow?.()).reduce(
      async (before, { shape, words }) => {
        await before;
        if (refused) {
          return;
        }
        const asked = { ...request, shape };
        const outcome = await look(asked);
        const drawn = describe(asked, outcome);
        if (!drawn) {
          refused = explain(outcome);
          return;
        }
        content.push({ type: 'text', text: words }, ...drawn.content);
      },
      Promise.resolve(),
    );
    return (
      refused ?? {
        content: [
          ...content,
          {
            type: 'text',
            text: 'Judge each of the three before you answer the member. If one is wrong, fix it, save, and look at all three again: a fix for one view is the commonest way to break another.',
          },
        ],
      }
    );
  },
});
