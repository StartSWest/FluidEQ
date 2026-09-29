/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Bloom drew a second flower under its 3D one (Ivan, 2026-09-28: "it has a
 * flower under the main one"): a world pack's shader is the world's sky and
 * also the whole scene wherever the world is not drawn, so it paints the
 * subject too, and the sky cannot see the world over it. The `world` control
 * tells the shader which: held at 1 while the world is drawn, the pack's own
 * 0 where the shader plays alone whatever a listener saved, and never a
 * slider.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { SCENE_DAYLIGHT_PARAM } from '../../../common/sceneDaylight';
import type { IScenePack, IScenePackParam } from '../../../common/scenePacks';
import { NEUTRAL_RESPONSE } from '../../../common/sceneResponse';
import {
  SPECTRUM_TEXELS,
  WAVEFORM_TEXELS,
  uniformNameForParam,
} from '../../../common/sceneUniformContract';
import { worldVarUniform } from '../../../common/sceneWorld';
import {
  SCENE_WORLD_CONTROL,
  SCENE_WORLD_DRAWN,
  SCENE_WORLD_PARAM,
} from '../../../common/sceneWorldFront';
import normalizeSceneWorld from '../../../common/sceneWorldRead';
import SceneParamMenu from '../../../renderer/graph/SceneParamMenu';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import sceneSliderParams from '../../../renderer/graph/sceneSliders';
import { createSceneTuner } from '../../../renderer/graph/sceneTuner';
import { createWorldInputs } from '../../../renderer/graph/world/worldInputs';
import StudioSettings from '../../../renderer/studio/StudioSettings';
import { promptWithIdea } from '../../../renderer/studio/aiPrompt';
import { reportOwnParams } from '../../../renderer/utils/sceneParamStore';

const WORLD: IScenePackParam = {
  ...SCENE_WORLD_CONTROL,
  names: { ...SCENE_WORLD_CONTROL.names },
};
const PETALS: IScenePackParam = {
  id: 'petals',
  names: { en: 'Petals' },
  min: 0,
  max: 1,
  value: 0.5,
};
const DAYLIGHT: IScenePackParam = {
  id: SCENE_DAYLIGHT_PARAM,
  names: { en: 'Daylight' },
  min: 0,
  max: 1,
  value: 0,
};

const frame = (params: Record<string, number>): ISceneFrame => ({
  timeSeconds: 1,
  deltaMs: 16,
  level: 0.5,
  beat: 0,
  bands: [0.5, 0.5, 0.5],
  musicAccent: [0, 0],
  musicRun: [0, 0],
  accent: [0, 0, 0],
  fade: 1,
  spectrum: new Uint8Array(SPECTRUM_TEXELS),
  waveform: new Uint8Array(WAVEFORM_TEXELS),
  params,
});

const packOf = (params: IScenePackParam[]) =>
  ({
    schema: 1,
    id: 'bloom',
    version: 1,
    contract: 8,
    names: { en: 'Bloom' },
    fallbackStyle: 'skyline',
    swatch: [],
    source: '',
    params,
  }) as unknown as IScenePack;

describe('the 3D world in front of its shader', () => {
  it('is held at 1 while the world is drawn, for the sky and every formula', () => {
    const world = normalizeSceneWorld(
      {
        materials: { stone: { kind: 'physical', colour: '#808080' } },
        nodes: [
          {
            type: 'mesh',
            geometry: { kind: 'icosahedron', radius: 1 },
            material: 'stone',
          },
        ],
        vars: { seen: `p.${SCENE_WORLD_PARAM}` },
      },
      [PETALS.id, WORLD.id],
    );
    if (!world) {
      throw new Error('the world did not read');
    }
    const inputs = createWorldInputs(
      { ...packOf([PETALS, WORLD]), world } as IScenePack,
      null,
    );
    // The frame carries the pack's own 0, as the shader alone plays it.
    inputs.update(frame({ petals: 0.8, world: 0 }), 640, 360);
    expect(inputs.uniforms[uniformNameForParam(SCENE_WORLD_PARAM)].value).toBe(
      SCENE_WORLD_DRAWN,
    );
    expect(inputs.uniforms[worldVarUniform('seen')].value).toBe(
      SCENE_WORLD_DRAWN,
    );
    // Every other control still follows the frame.
    expect(inputs.uniforms[uniformNameForParam('petals')].value).toBe(0.8);
  });

  it('keeps its own value where the shader plays alone, whatever was saved', () => {
    const tuner = createSceneTuner();
    const pack = packOf([PETALS, WORLD]);
    // An older FluidEQ showed it as a slider, so a listener may have saved 1.
    const { params } = tuner.apply(
      frame({}),
      16,
      pack,
      { petals: PETALS.value, world: WORLD.value },
      { params: { petals: 0.9, world: 1 } },
    );
    expect(params[SCENE_WORLD_PARAM]).toBe(0);
    // The control beside it takes what was saved: only this one is held.
    expect(params.petals).toBe(0.9);
  });

  it('is never a slider, like the time of day and a range with no width', () => {
    const flat = { ...PETALS, id: 'flat', min: 0.3, max: 0.3, value: 0.3 };
    expect(sceneSliderParams([PETALS, WORLD, DAYLIGHT, flat])).toEqual([
      PETALS,
    ]);
  });

  it('gets no slider in the graph’s View menu', () => {
    reportOwnParams('bloom-front', [PETALS, WORLD]);
    render(<SceneParamMenu lookId="bloom-front" />);
    expect(screen.getAllByRole('slider')).toHaveLength(1);
    expect(screen.getByText('Petals')).toBeInTheDocument();
    expect(screen.queryByText('3D world in front')).not.toBeInTheDocument();
  });

  it('gets no slider in the Studio', () => {
    render(
      <StudioSettings
        params={[PETALS, WORLD]}
        values={{}}
        response={NEUTRAL_RESPONSE}
        saved={undefined}
        idle={false}
        canResetParams={false}
        canResetResponse={false}
        onParam={jest.fn()}
        onResponse={jest.fn()}
        onCommit={jest.fn()}
        onResetParams={jest.fn()}
        onResetResponse={jest.fn()}
      />,
    );
    expect(screen.getByText('Petals')).toBeInTheDocument();
    expect(screen.queryByText('3D world in front')).not.toBeInTheDocument();
  });

  it('is taught to a member’s AI exactly as the engine reads it', () => {
    const brief = promptWithIdea('a flower that opens with the chorus');
    expect(brief).toContain(JSON.stringify(SCENE_WORLD_CONTROL));
    expect(brief).toContain(`uParam_${SCENE_WORLD_PARAM} < 0.5`);
  });
});
