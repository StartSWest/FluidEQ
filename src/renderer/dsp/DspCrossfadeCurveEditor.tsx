/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PointerEvent as ReactPointerEvent, useRef, useState } from 'react';
import {
  crossfadeHandleBounds,
  ICrossfadePoint,
  ICrossfadeShape,
} from '../../common/dsp/crossfadeShape';
import { useTranslation } from '../utils/I18nContext';

interface IDspCrossfadeCurveEditorProps {
  shape: ICrossfadeShape;
  isDisabled: boolean;
  onPatch: (next: ICrossfadeShape) => void;
  onCommit: () => void;
  plotX: (progress: number) => number;
  plotY: (gain: number) => number;
  /** The inverse of the two above, for turning a pointer back into a point. */
  fromClient: (
    clientX: number,
    clientY: number,
    bounds: DOMRect,
  ) => { at: number; gain: number };
}

type TSide = 'outgoing' | 'incoming';

interface IDragging {
  side: TSide;
  index: number;
  pointerId: number;
}

/**
 * The handles on the Custom curve.
 *
 * Split out of the card because it owns a drag: pointer capture, a live
 * uncommitted shape, and keyboard nudging are the whole of this file, and none
 * of it belongs in a component whose job is a dial and a segmented picker.
 */
const DspCrossfadeCurveEditor = ({
  shape,
  isDisabled,
  onPatch,
  onCommit,
  plotX,
  plotY,
  fromClient,
}: IDspCrossfadeCurveEditorProps) => {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState<IDragging | undefined>(undefined);
  const groupRef = useRef<SVGGElement | null>(null);

  const moved = (
    side: TSide,
    index: number,
    at: number,
    gain: number,
  ): ICrossfadeShape => {
    const points = side === 'incoming' ? shape.incoming : shape.outgoing;
    const limits = crossfadeHandleBounds(points, index);
    const next: ICrossfadePoint[] = points.map((point, position) =>
      position === index
        ? {
            at: Math.min(limits.max, Math.max(limits.min, at)),
            gain: Math.min(1, Math.max(0, gain)),
          }
        : point,
    );
    return side === 'incoming'
      ? { outgoing: shape.outgoing, incoming: next }
      : { outgoing: next, incoming: shape.incoming };
  };

  const onPointerDown = (
    event: ReactPointerEvent<SVGCircleElement>,
    side: TSide,
    index: number,
  ) => {
    if (isDisabled) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging({ side, index, pointerId: event.pointerId });
  };

  const onPointerMove = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (!dragging || event.pointerId !== dragging.pointerId) {
      return;
    }
    const bounds = groupRef.current?.ownerSVGElement?.getBoundingClientRect();
    if (!bounds) {
      return;
    }
    const point = fromClient(event.clientX, event.clientY, bounds);
    onPatch(moved(dragging.side, dragging.index, point.at, point.gain));
  };

  const onPointerUp = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (!dragging || event.pointerId !== dragging.pointerId) {
      return;
    }
    setDragging(undefined);
    // Committed on release rather than on every move: a commit is a write to
    // the store and a push to the host, and a drag produces one per frame.
    onCommit();
  };

  /**
   * Arrow keys move a handle by a hundredth, which is a pixel and a half on
   * this plot — the handles are the only control in the card that cannot be
   * reached any other way, so they answer to the keyboard too.
   */
  const onKeyDown = (
    event: React.KeyboardEvent<SVGCircleElement>,
    side: TSide,
    index: number,
    point: ICrossfadePoint,
  ) => {
    const step = event.shiftKey ? 0.05 : 0.01;
    const nudges: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const nudge = nudges[event.key];
    if (!nudge || isDisabled) {
      return;
    }
    event.preventDefault();
    onPatch(moved(side, index, point.at + nudge[0], point.gain + nudge[1]));
    onCommit();
  };

  const handles = (side: TSide) =>
    (side === 'incoming' ? shape.incoming : shape.outgoing).map(
      (point, index) => (
        <circle
          // The index is the identity here: handles are ordered by position and
          // a drag past a neighbour is prevented rather than allowed to swap.
          // eslint-disable-next-line react/no-array-index-key
          key={`${side}-${index}`}
          className={`dsp-crossfade-handle is-${side}${
            dragging?.side === side && dragging.index === index
              ? ' is-dragging'
              : ''
          }`}
          cx={plotX(point.at)}
          cy={plotY(point.gain)}
          r="5"
          role="slider"
          tabIndex={isDisabled ? -1 : 0}
          aria-label={t(
            side === 'incoming'
              ? 'dsp.crossfade.handleIncoming'
              : 'dsp.crossfade.handleOutgoing',
          )}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(point.gain * 100)}
          aria-disabled={isDisabled}
          onPointerDown={(event) => onPointerDown(event, side, index)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={(event) => onKeyDown(event, side, index, point)}
        />
      ),
    );

  return (
    <g ref={groupRef} className="dsp-crossfade-handles">
      {handles('outgoing')}
      {handles('incoming')}
    </g>
  );
};

export default DspCrossfadeCurveEditor;
