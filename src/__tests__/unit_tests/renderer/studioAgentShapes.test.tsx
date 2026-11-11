/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The shapes the Studio's AI looks at a scene in are the stage's own (Ivan,
 * 2026-11-09: "make sure when I ask the agent it knows is that aspect ratio
 * not any other invented one"), and a look naming none is of the view the
 * stage shows.
 */
import { renderHook } from '@testing-library/react';
import { STUDIO_AGENT_SHAPES } from 'common/studioAgent';
import { GRAPH_STAGE_RATIO } from 'renderer/studio/useStudioStageRatio';
import {
  AGENT_SHAPE_OF_PREVIEW,
  ULTRA_WIDE_GRAPH_SHAPE,
  type TStagePreview,
} from 'renderer/studio/studioStageScreen';
import useStageViewForAgent from 'renderer/studio/useStageViewForAgent';

const ratio = (shape: keyof typeof STUDIO_AGENT_SHAPES) =>
  STUDIO_AGENT_SHAPES[shape].width / STUDIO_AGENT_SHAPES[shape].height;

describe("the AI's shapes", () => {
  it('are the stage previews, measured: the ultra-wide graph at 2956 by 534', () => {
    expect(STUDIO_AGENT_SHAPES['ultra-wide-graph']).toEqual({
      width: 2956,
      height: 534,
    });
    expect(ratio('ultra-wide-graph')).toBe(ULTRA_WIDE_GRAPH_SHAPE);
    expect(ratio('graph')).toBeCloseTo(GRAPH_STAGE_RATIO, 2);
    expect(STUDIO_AGENT_SHAPES['compact-player']).toEqual({
      width: 480,
      height: 309,
    });
    expect(ratio('full-screen')).toBeCloseTo(16 / 9, 5);
  });

  // Four screens, and the Compact player a second time with the whole
  // column its picture is the top of (`studioAgentColumn.test.ts`).
  it('are those four, the player with its column, and nothing thinner than the ultra-wide graph', () => {
    expect(Object.keys(STUDIO_AGENT_SHAPES).sort()).toEqual([
      'compact-player',
      'compact-player-column',
      'full-screen',
      'graph',
      'ultra-wide-graph',
    ]);
    (Object.keys(STUDIO_AGENT_SHAPES) as (keyof typeof STUDIO_AGENT_SHAPES)[])
      .map(ratio)
      .forEach((shape) =>
        expect(shape).toBeLessThanOrEqual(ULTRA_WIDE_GRAPH_SHAPE),
      );
  });

  it('name every view the stage has', () => {
    expect(AGENT_SHAPE_OF_PREVIEW).toEqual({
      stage: 'graph',
      ultraWide: 'ultra-wide-graph',
      player: 'compact-player',
    });
  });
});

describe('the stage telling main its view', () => {
  const told = jest.fn((_shape: string | null) => Promise.resolve());
  beforeEach(() => {
    told.mockClear();
    window.electron = {
      ipcRenderer: { studioAgentStageView: told },
    } as unknown as typeof window.electron;
  });

  it('says each view as it changes, and takes it back when the Studio closes', () => {
    const { rerender, unmount } = renderHook(
      ({ preview }: { preview: TStagePreview }) =>
        useStageViewForAgent(preview),
      { initialProps: { preview: 'stage' as TStagePreview } },
    );
    expect(told).toHaveBeenLastCalledWith('graph');
    rerender({ preview: 'ultraWide' });
    expect(told).toHaveBeenLastCalledWith('ultra-wide-graph');
    rerender({ preview: 'player' });
    expect(told).toHaveBeenLastCalledWith('compact-player');
    unmount();
    expect(told).toHaveBeenLastCalledWith(null);
  });
});
