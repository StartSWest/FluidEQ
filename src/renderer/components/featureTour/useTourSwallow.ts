/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';
import swallowSheet from '../../../../assets/studio/starter/art/swallow-flight.png';
import type { IViewedAnimation } from '../../studio/animations/useStudioAnimations';

/**
 * The swallow every new Studio project starts with (`starterScene.ts`), as
 * the Animations tab reads it: the same eight frames, four to a row, at the
 * speed the starter plays them, from the very file a new project receives,
 * so the tour and the starter cannot drift apart.
 */
const SWALLOW = {
  name: 'swallow-flight',
  sheet: 'art/swallow-flight.png',
  count: 8,
  columns: 4,
  fps: 10,
  loop: true,
  ground: 'sky',
} as const;

/** One frame of the sheet is 212 x 256: 848 x 512 in four columns, two rows. */
const FRAME_ASPECT = 212 / 256;

/**
 * The swallow decoded once into the bitmap the tab's frames are drawn from,
 * undefined until it is. Let go when the slide is.
 */
export default function useTourSwallow(): IViewedAnimation | undefined {
  const [viewed, setViewed] = useState<IViewedAnimation>();

  useEffect(() => {
    let live = true;
    let bitmap: ImageBitmap | undefined;
    const decode = async () => {
      const response = await fetch(swallowSheet);
      const decoded = await createImageBitmap(await response.blob());
      bitmap = decoded;
      if (!live) {
        decoded.close();
        return;
      }
      setViewed({ animation: SWALLOW, bitmap: decoded, aspect: FRAME_ASPECT });
    };
    decode().catch((error: unknown) => {
      // eslint-disable-next-line no-console -- the one trace of a sheet the slide could not draw; its words stay, only the picture is missing
      console.error('The tour could not decode the swallow sheet', error);
    });
    return () => {
      live = false;
      bitmap?.close();
    };
  }, []);

  return viewed;
}
