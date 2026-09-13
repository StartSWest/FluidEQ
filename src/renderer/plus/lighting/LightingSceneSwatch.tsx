/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import type { IDeskColourFeed } from './deskColours';

/** The current picture, not the pack's potentially unrelated cover palette. */
export default function LightingSceneSwatch({
  feed,
}: {
  feed?: IDeskColourFeed;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return undefined;
    }
    return feed?.subscribe(({ image }) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (image) {
        const size = Math.min(image.width, image.height);
        context.drawImage(
          image,
          (image.width - size) / 2,
          (image.height - size) / 2,
          size,
          size,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      }
    });
  }, [feed]);
  return (
    <canvas
      ref={ref}
      width={80}
      height={80}
      className="lighting-scene-bar__swatch"
      aria-hidden="true"
    />
  );
}
