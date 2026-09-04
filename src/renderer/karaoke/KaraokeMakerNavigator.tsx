/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { IKaraokeMakerNote } from '../../common/karaoke/makerProject';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';
import { KaraokeTransportIcon } from './KaraokeTransport';

interface IKaraokeMakerNavigatorProps {
  durationMs: number;
  viewportStartMs: number;
  viewportDurationMs: number;
  playheadMs: number;
  waveform?: readonly number[];
  notes: readonly IKaraokeMakerNote[];
  minimumViewportMs: number;
  maximumViewportMs: number;
  follow: boolean;
  positionLabel: string;
  previousLabel: string;
  nextLabel: string;
  followLabel: string;
  resetZoomLabel: string;
  onMove: (startMs: number) => void;
  onResize: (startMs: number, durationMs: number) => void;
  onFollow: () => void;
  onResetZoom: () => void;
}

type TKaraokeMakerNavigatorDragMode = 'move' | 'resize-start' | 'resize-end';

interface IKaraokeMakerNavigatorDrag {
  mode: TKaraokeMakerNavigatorDragMode;
  originX: number;
  startMs: number;
  durationMs: number;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const formatClock = (valueMs: number): string => {
  const safe = Math.max(0, valueMs);
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const karaokeMakerViewportStart = (
  requestedStartMs: number,
  durationMs: number,
  viewportDurationMs: number,
): number =>
  clamp(requestedStartMs, 0, Math.max(0, durationMs - viewportDurationMs));

const karaokeMakerViewportGeometry = (
  width: number,
  durationMs: number,
  viewportStartMs: number,
  viewportDurationMs: number,
) => {
  const viewportWidth = Math.min(
    width,
    Math.max(24, (viewportDurationMs / durationMs) * width),
  );
  const viewportLeft = clamp(
    (viewportStartMs / durationMs) * width,
    0,
    Math.max(0, width - viewportWidth),
  );
  return { viewportLeft, viewportWidth };
};

export const karaokeMakerResizedViewport = (
  edge: 'start' | 'end',
  requestedEdgeMs: number,
  viewportStartMs: number,
  viewportDurationMs: number,
  durationMs: number,
  minimumViewportMs: number,
  maximumViewportMs: number,
): { startMs: number; durationMs: number } => {
  const safeDurationMs = Math.max(1, durationMs);
  const safeMinimumMs = clamp(minimumViewportMs, 1, safeDurationMs);
  const safeMaximumMs = clamp(maximumViewportMs, safeMinimumMs, safeDurationMs);
  const viewportEndMs = clamp(
    viewportStartMs + viewportDurationMs,
    safeMinimumMs,
    safeDurationMs,
  );

  if (edge === 'start') {
    const startMs = clamp(
      requestedEdgeMs,
      Math.max(0, viewportEndMs - safeMaximumMs),
      viewportEndMs - safeMinimumMs,
    );
    return { startMs, durationMs: viewportEndMs - startMs };
  }

  const endMs = clamp(
    requestedEdgeMs,
    viewportStartMs + safeMinimumMs,
    Math.min(safeDurationMs, viewportStartMs + safeMaximumMs),
  );
  return { startMs: viewportStartMs, durationMs: endMs - viewportStartMs };
};

const KaraokeMakerNavigator = ({
  durationMs,
  viewportStartMs,
  viewportDurationMs,
  playheadMs,
  waveform,
  notes,
  minimumViewportMs,
  maximumViewportMs,
  follow,
  positionLabel,
  previousLabel,
  nextLabel,
  followLabel,
  resetZoomLabel,
  onMove,
  onResize,
  onFollow,
  onResetZoom,
}: IKaraokeMakerNavigatorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<IKaraokeMakerNavigatorDrag | undefined>(undefined);
  const maximumStartMs = Math.max(0, durationMs - viewportDurationMs);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const width = Math.max(160, canvas.clientWidth);
    const height = Math.max(34, canvas.clientHeight);
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    if (
      canvas.width !== Math.round(width * ratio) ||
      canvas.height !== Math.round(height * ratio)
    ) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const background = context.createLinearGradient(0, 0, 0, height);
    // The plot colour, like the editor above it.
    background.addColorStop(0, 'rgb(26, 58, 78)');
    background.addColorStop(1, 'rgb(26, 58, 78)');
    context.fillStyle = background;
    context.roundRect(0.5, 0.5, width - 1, height - 1, 8);
    context.fill();

    context.strokeStyle = 'rgba(99, 168, 186, .1)';
    context.lineWidth = 1;
    for (let section = 1; section < 8; section += 1) {
      const x = (section / 8) * width;
      context.beginPath();
      context.moveTo(x, 4);
      context.lineTo(x, height - 4);
      context.stroke();
    }

    if (waveform?.length) {
      const middle = height * 0.47;
      const amplitude = height * 0.27;
      const waveformGradient = context.createLinearGradient(0, 0, width, 0);
      waveformGradient.addColorStop(0, 'rgba(49, 214, 203, .42)');
      waveformGradient.addColorStop(0.55, 'rgba(82, 233, 220, .65)');
      waveformGradient.addColorStop(1, 'rgba(111, 120, 232, .42)');
      context.strokeStyle = waveformGradient;
      context.lineWidth = 1;
      context.beginPath();
      for (let x = 0; x < width; x += 1) {
        const index = Math.min(
          waveform.length - 1,
          Math.floor((x / Math.max(1, width - 1)) * waveform.length),
        );
        const value = clamp(Math.abs(waveform[index] ?? 0), 0, 1);
        const y = middle - value * amplitude;
        if (x === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      for (let x = width - 1; x >= 0; x -= 1) {
        const index = Math.min(
          waveform.length - 1,
          Math.floor((x / Math.max(1, width - 1)) * waveform.length),
        );
        const value = clamp(Math.abs(waveform[index] ?? 0), 0, 1);
        context.lineTo(x, middle + value * amplitude);
      }
      context.closePath();
      context.globalAlpha = 0.34;
      context.fillStyle = waveformGradient;
      context.fill();
      context.globalAlpha = 1;
      context.stroke();
    }

    notes.forEach((note) => {
      const left = (note.startMs / durationMs) * width;
      const right = (note.endMs / durationMs) * width;
      context.fillStyle =
        note.kind === 'golden'
          ? 'rgba(255, 207, 87, .78)'
          : 'rgba(54, 225, 213, .68)';
      context.fillRect(left, height - 5, Math.max(1, right - left), 2);
    });

    const { viewportLeft, viewportWidth } = karaokeMakerViewportGeometry(
      width,
      durationMs,
      viewportStartMs,
      viewportDurationMs,
    );
    context.fillStyle = 'rgba(13, 32, 48, .46)';
    context.fillRect(0, 2, viewportLeft, height - 4);
    context.fillRect(
      viewportLeft + viewportWidth,
      2,
      Math.max(0, width - viewportLeft - viewportWidth),
      height - 4,
    );

    const viewportGradient = context.createLinearGradient(
      viewportLeft,
      0,
      viewportLeft + viewportWidth,
      0,
    );
    viewportGradient.addColorStop(0, 'rgba(26, 187, 186, .27)');
    viewportGradient.addColorStop(0.5, 'rgba(54, 232, 216, .18)');
    viewportGradient.addColorStop(1, 'rgba(82, 134, 226, .24)');
    context.fillStyle = viewportGradient;
    context.strokeStyle = 'rgba(132, 255, 245, .98)';
    context.lineWidth = 2;
    context.shadowColor = 'rgba(35, 225, 209, .52)';
    context.shadowBlur = 11;
    context.beginPath();
    context.roundRect(viewportLeft, 2, viewportWidth, height - 4, 6);
    context.fill();
    context.stroke();
    context.shadowBlur = 0;

    [viewportLeft, viewportLeft + viewportWidth].forEach((edgeX) => {
      context.fillStyle = '#bafff8';
      context.shadowColor = 'rgba(59, 238, 222, .7)';
      context.shadowBlur = 7;
      context.beginPath();
      context.roundRect(edgeX - 3, height / 2 - 10, 6, 20, 3);
      context.fill();
      context.fillStyle = 'rgba(0, 229, 207, .55)';
      context.fillRect(edgeX - 0.6, height / 2 - 5, 1.2, 10);
    });
    context.shadowBlur = 0;

    const playheadX = clamp((playheadMs / durationMs) * width, 0, width);
    context.strokeStyle = '#ff55bd';
    context.lineWidth = 1.3;
    context.shadowColor = 'rgba(255, 71, 184, .62)';
    context.shadowBlur = 6;
    context.beginPath();
    context.moveTo(playheadX, 3);
    context.lineTo(playheadX, height - 3);
    context.stroke();
    context.shadowBlur = 0;
  }, [
    durationMs,
    notes,
    playheadMs,
    viewportDurationMs,
    viewportStartMs,
    waveform,
  ]);

  useEffect(() => {
    draw();
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  const positionFromPointer = (
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): { x: number; width: number } => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp(event.clientX - bounds.left, 0, bounds.width),
      width: Math.max(1, bounds.width),
    };
  };

  const modeFromPointer = (
    x: number,
    width: number,
  ): TKaraokeMakerNavigatorDragMode => {
    const { viewportLeft, viewportWidth } = karaokeMakerViewportGeometry(
      width,
      durationMs,
      viewportStartMs,
      viewportDurationMs,
    );
    const leftDistance = Math.abs(x - viewportLeft);
    const rightDistance = Math.abs(x - viewportLeft - viewportWidth);
    const handleHitWidth = 10;
    if (Math.min(leftDistance, rightDistance) <= handleHitWidth) {
      return leftDistance <= rightDistance ? 'resize-start' : 'resize-end';
    }
    return 'move';
  };

  const updateCursor = (
    canvas: HTMLCanvasElement,
    mode: TKaraokeMakerNavigatorDragMode,
    dragging: boolean,
  ) => {
    if (mode === 'move') {
      canvas.style.cursor = dragging ? 'grabbing' : 'grab';
    } else {
      canvas.style.cursor = 'ew-resize';
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const { x, width } = positionFromPointer(event);
    const { viewportLeft, viewportWidth } = karaokeMakerViewportGeometry(
      width,
      durationMs,
      viewportStartMs,
      viewportDurationMs,
    );
    const pointerInside =
      x >= viewportLeft && x <= viewportLeft + viewportWidth;
    const mode = modeFromPointer(x, width);
    const nextStartMs =
      pointerInside || mode !== 'move'
        ? viewportStartMs
        : karaokeMakerViewportStart(
            (x / width) * durationMs - viewportDurationMs / 2,
            durationMs,
            viewportDurationMs,
          );
    dragRef.current = {
      mode,
      originX: x,
      startMs: nextStartMs,
      durationMs: viewportDurationMs,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    updateCursor(event.currentTarget, mode, true);
    if (!pointerInside && mode === 'move') {
      onMove(nextStartMs);
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const { x, width } = positionFromPointer(event);
    if (!drag) {
      updateCursor(event.currentTarget, modeFromPointer(x, width), false);
      return;
    }
    const deltaMs = ((x - drag.originX) / width) * durationMs;
    if (drag.mode === 'move') {
      onMove(
        karaokeMakerViewportStart(
          drag.startMs + deltaMs,
          durationMs,
          drag.durationMs,
        ),
      );
      return;
    }
    const resized = karaokeMakerResizedViewport(
      drag.mode === 'resize-start' ? 'start' : 'end',
      drag.mode === 'resize-start'
        ? drag.startMs + deltaMs
        : drag.startMs + drag.durationMs + deltaMs,
      drag.startMs,
      drag.durationMs,
      durationMs,
      minimumViewportMs,
      maximumViewportMs,
    );
    onResize(resized.startMs, resized.durationMs);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const { x, width } = positionFromPointer(event);
    dragRef.current = undefined;
    updateCursor(event.currentTarget, modeFromPointer(x, width), false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onPointerLeave = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) {
      event.currentTarget.style.cursor = 'grab';
    }
  };

  const resizeFromKeyboard = (scale: number) => {
    const nextDurationMs = clamp(
      viewportDurationMs * scale,
      minimumViewportMs,
      maximumViewportMs,
    );
    const centerMs = viewportStartMs + viewportDurationMs / 2;
    const startMs = karaokeMakerViewportStart(
      centerMs - nextDurationMs / 2,
      durationMs,
      nextDurationMs,
    );
    onResize(startMs, nextDurationMs);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      resizeFromKeyboard(0.8);
      return;
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      resizeFromKeyboard(1.25);
      return;
    }
    let requested = viewportStartMs;
    if (event.key === 'ArrowLeft') {
      requested -= viewportDurationMs * 0.1;
    } else if (event.key === 'ArrowRight') {
      requested += viewportDurationMs * 0.1;
    } else if (event.key === 'PageUp') {
      requested -= viewportDurationMs * 0.75;
    } else if (event.key === 'PageDown') {
      requested += viewportDurationMs * 0.75;
    } else if (event.key === 'Home') {
      requested = 0;
    } else if (event.key === 'End') {
      requested = maximumStartMs;
    } else {
      return;
    }
    event.preventDefault();
    onMove(
      karaokeMakerViewportStart(requested, durationMs, viewportDurationMs),
    );
  };

  return (
    <div className="karaoke-maker-nav">
      <div className="karaoke-maker-nav__summary">
        <span>{positionLabel}</span>
        <strong>
          {formatClock(viewportStartMs)}–
          {formatClock(
            Math.min(durationMs, viewportStartMs + viewportDurationMs),
          )}
        </strong>
      </div>
      <button
        type="button"
        className="karaoke-maker-nav__step"
        onClick={() => onMove(viewportStartMs - viewportDurationMs * 0.75)}
        disabled={viewportStartMs <= 0}
        aria-label={previousLabel}
        data-tooltip={previousLabel}
      >
        <KaraokeTransportIcon name="previous" />
      </button>
      <canvas
        ref={canvasRef}
        className="karaoke-maker-nav__overview"
        role="slider"
        tabIndex={0}
        aria-label={positionLabel}
        aria-valuemin={0}
        aria-valuemax={Math.round(maximumStartMs)}
        aria-valuenow={Math.round(viewportStartMs)}
        aria-valuetext={`${formatClock(viewportStartMs)}–${formatClock(
          Math.min(durationMs, viewportStartMs + viewportDurationMs),
        )}`}
        title={`${positionLabel} · ${resetZoomLabel}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
        onDoubleClick={onResetZoom}
      />
      <button
        type="button"
        className="karaoke-maker-nav__step"
        onClick={() => onMove(viewportStartMs + viewportDurationMs * 0.75)}
        disabled={viewportStartMs >= maximumStartMs}
        aria-label={nextLabel}
        data-tooltip={nextLabel}
      >
        <KaraokeTransportIcon name="next" />
      </button>
      <button
        type="button"
        className={`karaoke-maker-nav__follow${follow ? ' is-active' : ''}`}
        onClick={onFollow}
        aria-pressed={follow}
        data-tooltip={followLabel}
      >
        <KaraokeMakerToolIcon name="align" />
        <span>{followLabel}</span>
      </button>
    </div>
  );
};

export default KaraokeMakerNavigator;
