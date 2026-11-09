import { useEffect, useRef, useState } from 'react';
import { frameCell } from 'common/studioAnimation';
import type { IViewedAnimation } from './useStudioAnimations';

/** How strongly the frame before shows under the onion, tinted the accent's
 * teal so it reads apart from the frame on any creature's colours. */
const ONION_ALPHA = 0.5;

interface IAnimationFrameProps {
  viewed: IViewedAnimation;
  frame: number;
  /** Also draws the frame before, faded, under this one. */
  onion?: boolean;
  className?: string;
  label?: string;
}

/**
 * One frame of an animation, drawn from its sheet's bitmap: as large as the
 * element allows at the frame's own shape, standing on the element's bottom
 * edge, at the screen's own pixels. Drawn when the frame changes and when
 * the element is resized, never on a clock of its own.
 */
export default function AnimationFrame({
  viewed,
  frame,
  onion = false,
  className,
  label,
}: IAnimationFrameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setSize((now) =>
        now.width === box.width && now.height === box.height
          ? now
          : { width: box.width, height: box.height },
      );
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const { bitmap, animation } = viewed;
    const context = canvas?.getContext('2d');
    // A bitmap let go for a newer read draws nothing: it is replaced at once.
    if (!canvas || !context || !bitmap || bitmap.width === 0) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(size.width * ratio));
    const height = Math.max(1, Math.round(size.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.clearRect(0, 0, width, height);
    const cell = frameCell(animation, bitmap.width, bitmap.height, frame);
    const scale = Math.min(width / cell.width, height / cell.height);
    const drawnWidth = cell.width * scale;
    const drawnHeight = cell.height * scale;
    const left = (width - drawnWidth) / 2;
    const top = height - drawnHeight;
    context.imageSmoothingQuality = 'high';
    const draw = (index: number) => {
      const at = frameCell(animation, bitmap.width, bitmap.height, index);
      context.drawImage(
        bitmap,
        at.x,
        at.y,
        at.width,
        at.height,
        left,
        top,
        drawnWidth,
        drawnHeight,
      );
    };
    if (onion && animation.count > 1) {
      context.globalAlpha = ONION_ALPHA;
      context.filter =
        'sepia(1) hue-rotate(150deg) saturate(3) brightness(0.8)';
      draw(frame - 1);
      context.globalAlpha = 1;
      context.filter = 'none';
    }
    draw(frame);
  }, [viewed, frame, onion, size]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
