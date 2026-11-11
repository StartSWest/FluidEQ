/**
 * @jest-environment node
 */
import { PLAYER_PICTURE_HEIGHT, PLAYER_WIDTH } from '../../../common/constants';
import {
  COMPACT_PLAYER_COLUMN,
  COMPACT_PLAYER_COLUMN_VIEW,
} from '../../../common/stageShapes';
import {
  STUDIO_AGENT_SHAPES,
  studioAgentViewOf,
} from '../../../common/studioAgent';
import {
  PICTURE_HEIGHT,
  PICTURE_PANEL_FOOT,
  PICTURE_WIDTH,
} from '../../../renderer/components/featureTour/playerPictureData';
import { handedRun } from '../../../renderer/graph/sceneShowcaseRun';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import { PLAYER_PANEL_VIEW } from '../../../renderer/studio/studioStageScreen';

/**
 * The Compact player's whole column, as the member's AI looks at it (Ivan,
 * 2026-11-11: "aware of the mobile UI to fill the black bottom"): the same
 * column, and the same panel on it, that the player and the Studio's own
 * preview draw a scene behind.
 */
describe("the Compact player's column the AI looks at", () => {
  it("is the player's own column, measured where the player keeps it", () => {
    expect(COMPACT_PLAYER_COLUMN).toEqual({
      width: PICTURE_WIDTH,
      height: PICTURE_HEIGHT,
      panelFoot: PICTURE_PANEL_FOOT,
    });
    expect(STUDIO_AGENT_SHAPES['compact-player-column']).toEqual({
      width: PLAYER_WIDTH,
      height: PICTURE_HEIGHT,
    });
  });

  it("frames the scene to the panel the Studio's player preview frames it to", () => {
    const view = studioAgentViewOf('compact-player-column');
    expect(view).toBe(COMPACT_PLAYER_COLUMN_VIEW);
    PLAYER_PANEL_VIEW.forEach((edge, index) =>
      expect(view?.[index]).toBeCloseTo(edge, 9),
    );
    // The panel is a third of the column, near its top: two thirds of the
    // picture are the scene running on under it.
    expect(view?.[3]).toBeCloseTo(PLAYER_PICTURE_HEIGHT / PICTURE_HEIGHT, 9);
    expect(view?.[1]).toBeGreaterThan(0.6);
  });

  it('leaves every other shape the panel alone', () => {
    (['graph', 'ultra-wide-graph', 'compact-player', 'full-screen'] as const)
      .map(studioAgentViewOf)
      .forEach((view) => expect(view).toBeUndefined());
  });

  it("reaches the scene's frames, so the scene is drawn past its panel", () => {
    const frames = [{ timeSeconds: 0 }, { timeSeconds: 0.1 }] as ISceneFrame[];
    const play = (view?: readonly [number, number, number, number]) => {
      let at = 0;
      const run = handedRun(
        () => () => {
          const frame = frames[at];
          at += 1;
          return frame;
        },
        { spectrumRect: [0, 1, 0, 1], ...(view ? { view } : {}) },
      );
      return run();
    };
    expect(play(COMPACT_PLAYER_COLUMN_VIEW)?.view).toBe(
      COMPACT_PLAYER_COLUMN_VIEW,
    );
    // The control: a picture that is its panel says nothing of a view.
    expect(play()?.view).toBeUndefined();
  });
});
