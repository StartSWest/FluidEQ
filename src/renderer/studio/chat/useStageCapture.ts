/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import type { IScenePack } from 'common/scenePacks';
import type { ISceneWave } from 'common/sceneWave';
import { drawForAgent } from '../studioAgentDraw';

/**
 * A picture of the scene on the stage, for "Attach the stage": drawn off
 * screen by the same still worker the member's AI looks through
 * (`studioAgentDraw.ts`), at the wave the stage shows it in, on FluidEQ's own
 * test music so the picture has the scene moving. Absent while nothing plays.
 */
const useStageCapture = (
  pack: IScenePack | undefined,
  wave: ISceneWave,
): (() => Promise<Uint8Array | undefined>) | undefined =>
  useMemo(
    () =>
      pack
        ? async () => {
            const answer = await drawForAgent({
              id: 0,
              pack,
              shape: 'wide',
              sound: 'music',
              wave,
            });
            return answer.ok ? answer.image : undefined;
          }
        : undefined,
    [pack, wave],
  );

export default useStageCapture;
