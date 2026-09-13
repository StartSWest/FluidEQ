/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { ILightingDevice } from 'common/lighting/lightingModel';
import type { IDeskColourFeed, IDeskColours } from './deskColours';
import { layoutDesk, PLACEHOLDER_DESK } from './deskLayout';
import { paintDesk } from './deskPainter';

interface ILightingStageProps {
  devices: readonly ILightingDevice[];
  feed: IDeskColourFeed | undefined;
  /** Over the desk's foot, when there is something to do before anything lights. */
  prompt?: ReactNode;
}

/**
 * The member's own desk, drawn from the devices that were found and lit with
 * the colours each one is being sent. Drawn when a frame arrives and when the
 * panel changes size — never on a loop of its own.
 */
export default function LightingStage({
  devices,
  feed,
  prompt,
}: ILightingStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const placed = useMemo(() => layoutDesk(devices), [devices]);
  const faint = useMemo(
    () => (devices.length === 0 ? layoutDesk(PLACEHOLDER_DESK) : []),
    [devices],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    let latest: IDeskColours = {
      frame: undefined,
      colours: new Map(),
    };
    const paint = () =>
      paintDesk(canvas, {
        placed,
        faint,
        colours: latest.colours,
        grid: latest.frame,
        image: latest.image,
      });
    const resize = new ResizeObserver(() => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      paint();
    });
    resize.observe(canvas);
    const stop = feed?.subscribe((colours) => {
      latest = colours;
      paint();
    });
    return () => {
      resize.disconnect();
      stop?.();
    };
  }, [feed, placed, faint]);

  return (
    <div className="lighting-stage">
      <canvas
        ref={canvasRef}
        className="lighting-stage__desk"
        aria-hidden="true"
      />
      {prompt && <div className="lighting-stage__prompt">{prompt}</div>}
    </div>
  );
}
