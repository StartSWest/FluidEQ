/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo, useRef } from 'react';
import type { IScenePack } from 'common/scenePacks';
import type { ISceneWave } from 'common/sceneWave';
import { drawForAgent } from '../studioAgentDraw';

/**
 * A picture of the scene on the stage, for "Attach the stage".
 *
 * What the stage shows, as it shows it, while it plays (Ivan, 2026-11-08:
 * "zoom and pan the scene so I can take pictures of visible area"): the
 * stage fills `live` (`StudioStage`'s `captureRef`) with a picture of the
 * part on screen — zoomed, moved and turned as it is. Otherwise — the stage
 * stood down for the Publish dialog, or its scene not drawn yet — the
 * picture is drawn off screen by the same still worker the member's AI looks
 * through (`studioAgentDraw.ts`), at the wave the stage shows it in, on
 * FluidEQ's own test music so the picture has the scene moving. Absent while
 * nothing plays.
 */
const useStageCapture = (pack: IScenePack | undefined, wave: ISceneWave) => {
  const live = useRef<(() => Promise<Uint8Array | undefined>) | undefined>(
    undefined,
  );
  const capture = useMemo(
    () =>
      pack
        ? async () => {
            const shown = await live.current?.();
            if (shown) {
              return shown;
            }
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
  return { capture, live };
};

export default useStageCapture;
