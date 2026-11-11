/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { ISceneEditThing, TTriple } from 'common/sceneEdit';
import { useTranslation } from '../../utils/I18nContext';
import {
  alongAxis,
  inPlane,
  ringAngle,
  snapTo,
  turnBetween,
  type TPoint,
} from './editMath';
import { emptyMove, type IStageEditStore } from './stageEditStore';
import { useStageEditState } from './useStageEdit';
import '../../styles/StudioEdit.scss';

/**
 * What Edit mode draws over the scene and takes from the hand: a frame round
 * each picked thing, the handles of the tool in use on the last one picked,
 * and, on a painted scene, the numbered marks.
 *
 * It lies exactly over the scene's canvas, moved and magnified with it, so a
 * share of the canvas (`common/sceneEdit.ts`) is the same share of this.
 */

interface IStudioEditOverlayProps {
  store: IStageEditStore;
  /** Whether the scene has things to pick: a 3D world. */
  is3d: boolean;
  width: number;
  height: number;
  style?: CSSProperties;
}

/** How long a handle is on screen, whatever the thing's size or distance. */
const REACH = 64;
const RING = 58;
/** Travel under this is a click, not a drag. */
const CLICK_TRAVEL = 4;
const AXES = ['x', 'y', 'z'] as const;
const QUARTER = 0.25;
const FIFTEEN_DEGREES = Math.PI / 12;
const TENTH = 0.1;

type TGrip =
  | { kind: 'axis'; axis: number }
  | { kind: 'plane' }
  | { kind: 'ring'; axis: number }
  | { kind: 'side'; axis: number }
  | { kind: 'whole' };

interface IDrag {
  grip: TGrip;
  thing: ISceneEditThing;
  from: TPoint;
  /** A ring's last angle and the turn so far. */
  angle?: number;
  turned: number;
}

interface ISweep {
  from: TPoint;
  last: TPoint;
  slide: boolean;
  add: boolean;
  moved: boolean;
}

const size = (v: TPoint) => Math.hypot(v[0], v[1]);
const scaledTo = (v: TPoint, length: number): TPoint => {
  const now = size(v);
  return now > 1e-6 ? [(v[0] / now) * length, (v[1] / now) * length] : [0, 0];
};
const triple = (axis: number, value: number, rest: number): TTriple =>
  [0, 1, 2].map((at) => (at === axis ? value : rest)) as unknown as TTriple;

export default function StudioEditOverlay({
  store,
  is3d,
  width,
  height,
  style,
}: IStudioEditOverlayProps) {
  const { t } = useTranslation();
  const state = useStageEditState(store);
  const rootRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<IDrag | undefined>(undefined);
  const sweepRef = useRef<ISweep | undefined>(undefined);
  const boxRef = useRef<SVGRectElement>(null);

  // The wheel brings the Studio's camera nearer. Taken here, before the
  // stage's own listeners, and only while that camera is the one in use.
  const { freeView } = state;
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !freeView) {
      return undefined;
    }
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      store.zoomView(Math.exp(event.deltaY * 0.0015));
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
  }, [freeView, store]);

  const px = (v: TPoint): TPoint => [v[0] * width, v[1] * height];
  const at = (event: ReactPointerEvent): TPoint => {
    const box = rootRef.current?.getBoundingClientRect();
    return box ? [event.clientX - box.left, event.clientY - box.top] : [0, 0];
  };

  const thing = state.things[state.things.length - 1];
  const pivot: TPoint = thing ? px(thing.pivot) : [0, 0];
  const axes = thing ? thing.axes.map(px) : [];
  const own = thing ? thing.ownAxes.map(px) : [];

  const grab = (grip: TGrip) => (event: ReactPointerEvent) => {
    if (!thing || event.button !== 0) {
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const from = at(event);
    dragRef.current = {
      grip,
      thing,
      from,
      turned: 0,
      ...(grip.kind === 'ring'
        ? {
            angle: ringAngle(
              [from[0] - pivot[0], from[1] - pivot[1]],
              axes[(grip.axis + 1) % 3],
              axes[(grip.axis + 2) % 3],
            ),
          }
        : {}),
    };
  };

  const dragTo = (event: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const now = at(event);
    const by: TPoint = [now[0] - drag.from[0], now[1] - drag.from[1]];
    const held = drag.thing;
    const heldAxes = held.axes.map(px);
    const move = emptyMove(held.path);
    const snap = (value: number, step: number) =>
      state.snap ? snapTo(value, step) : value;
    const { grip } = drag;
    if (grip.kind === 'axis') {
      store.drag({
        ...move,
        position: triple(
          grip.axis,
          snap(alongAxis(by, heldAxes[grip.axis]), QUARTER),
          0,
        ),
      });
    } else if (grip.kind === 'plane') {
      // Across the two axes seen most open from here.
      const pairs = [
        [0, 1],
        [0, 2],
        [1, 2],
      ] as const;
      const open = (pair: readonly [number, number]) =>
        Math.abs(
          heldAxes[pair[0]][0] * heldAxes[pair[1]][1] -
            heldAxes[pair[0]][1] * heldAxes[pair[1]][0],
        );
      const pair = pairs.reduce((best, next) =>
        open(next) > open(best) ? next : best,
      );
      const parts = inPlane(by, heldAxes[pair[0]], heldAxes[pair[1]]);
      if (parts) {
        const position = [0, 0, 0];
        position[pair[0]] = snap(parts[0], QUARTER);
        position[pair[1]] = snap(parts[1], QUARTER);
        store.drag({ ...move, position: position as unknown as TTriple });
      }
    } else if (grip.kind === 'ring') {
      const held2: TPoint = px(held.pivot);
      const angle = ringAngle(
        [now[0] - held2[0], now[1] - held2[1]],
        heldAxes[(grip.axis + 1) % 3],
        heldAxes[(grip.axis + 2) % 3],
      );
      if (angle !== undefined && drag.angle !== undefined) {
        drag.turned += turnBetween(drag.angle, angle);
        drag.angle = angle;
        store.drag({
          ...move,
          rotation: triple(grip.axis, snap(drag.turned, FIFTEEN_DEGREES), 0),
        });
      }
    } else if (grip.kind === 'side') {
      const along = scaledTo(px(held.ownAxes[grip.axis]), 1);
      const pulled = (by[0] * along[0] + by[1] * along[1]) / REACH;
      store.drag({
        ...move,
        scale: triple(grip.axis, Math.max(0.05, snap(1 + pulled, TENTH)), 1),
      });
    } else {
      const factor = Math.max(0.05, snap(1 + (by[0] - by[1]) / 120, TENTH));
      store.drag({ ...move, scale: [factor, factor, factor] });
    }
  };

  const letGo = () => {
    if (dragRef.current) {
      dragRef.current = undefined;
      store.drop();
    }
  };

  const share = (point: TPoint): TPoint => [
    Math.min(1, Math.max(0, point[0] / Math.max(width, 1))),
    Math.min(1, Math.max(0, point[1] / Math.max(height, 1))),
  ];

  const onDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button > 2) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const from = at(event);
    sweepRef.current = {
      from,
      last: from,
      slide: event.shiftKey || event.button !== 0,
      add: event.shiftKey || event.ctrlKey || event.metaKey,
      moved: false,
    };
  };

  const onMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current) {
      dragTo(event);
      return;
    }
    const sweep = sweepRef.current;
    if (!sweep) {
      return;
    }
    const now = at(event);
    if (size([now[0] - sweep.from[0], now[1] - sweep.from[1]]) > CLICK_TRAVEL) {
      sweep.moved = true;
    }
    const by: TPoint = [now[0] - sweep.last[0], now[1] - sweep.last[1]];
    sweep.last = now;
    if (!sweep.moved) {
      return;
    }
    if (!is3d) {
      // A painted scene: the box being drawn, shown as it grows.
      const box = boxRef.current;
      if (box && state.markTool === 'box') {
        box.setAttribute('x', String(Math.min(sweep.from[0], now[0])));
        box.setAttribute('y', String(Math.min(sweep.from[1], now[1])));
        box.setAttribute('width', String(Math.abs(now[0] - sweep.from[0])));
        box.setAttribute('height', String(Math.abs(now[1] - sweep.from[1])));
        box.removeAttribute('visibility');
      }
    } else if (state.freeView) {
      if (sweep.slide) {
        store.slideView(
          by[0] / Math.max(height, 1),
          by[1] / Math.max(height, 1),
        );
      } else {
        store.turnView(by[0] * 0.008, by[1] * 0.008);
      }
    }
  };

  const onUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current) {
      letGo();
      return;
    }
    const sweep = sweepRef.current;
    sweepRef.current = undefined;
    boxRef.current?.setAttribute('visibility', 'hidden');
    if (!sweep) {
      return;
    }
    const end = share(at(event));
    const start = share(sweep.from);
    if (!is3d) {
      if (sweep.moved && state.markTool === 'box') {
        store.addMark({
          kind: 'box',
          x0: Math.min(start[0], end[0]),
          y0: Math.min(start[1], end[1]),
          x1: Math.max(start[0], end[0]),
          y1: Math.max(start[1], end[1]),
        });
      } else if (!sweep.moved) {
        store.addMark({ kind: 'pin', x: end[0], y: end[1] });
      }
    } else if (!sweep.moved && event.button === 0) {
      store.pickAt(end[0], end[1], sweep.add);
    }
  };

  const ringPath = (axis: number): string => {
    const a = axes[(axis + 1) % 3];
    const b = axes[(axis + 2) % 3];
    const fit = RING / Math.max(size(a), size(b), 1e-6);
    const points: string[] = [];
    for (let step = 0; step <= 48; step += 1) {
      const angle = (step / 48) * 2 * Math.PI;
      const x =
        pivot[0] + fit * (a[0] * Math.cos(angle) + b[0] * Math.sin(angle));
      const y =
        pivot[1] + fit * (a[1] * Math.cos(angle) + b[1] * Math.sin(angle));
      points.push(`${step === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return points.join('');
  };

  const handles = () => {
    if (!thing?.inView) {
      return null;
    }
    if (state.tool === 'turn') {
      return AXES.map((name, axis) => (
        <g
          key={name}
          className={`studio-edit__grip studio-edit__grip--${name}`}
          onPointerDown={grab({ kind: 'ring', axis })}
        >
          <path className="studio-edit__reach" d={ringPath(axis)} />
          <path className="studio-edit__ring" d={ringPath(axis)} />
        </g>
      ));
    }
    const lines = state.tool === 'move' ? axes : own;
    return (
      <>
        {AXES.map((name, axis) => {
          const tip = scaledTo(lines[axis], REACH);
          // Seen end on, an axis has no length to pull along.
          if (size(lines[axis]) < 1e-4) {
            return null;
          }
          const end: TPoint = [pivot[0] + tip[0], pivot[1] + tip[1]];
          const turn = (Math.atan2(tip[1], tip[0]) * 180) / Math.PI;
          return (
            <g
              key={name}
              className={`studio-edit__grip studio-edit__grip--${name}`}
              onPointerDown={grab(
                state.tool === 'move'
                  ? { kind: 'axis', axis }
                  : { kind: 'side', axis },
              )}
            >
              <line
                className="studio-edit__reach"
                x1={pivot[0]}
                y1={pivot[1]}
                x2={end[0]}
                y2={end[1]}
              />
              <line
                className="studio-edit__arm"
                x1={pivot[0]}
                y1={pivot[1]}
                x2={end[0]}
                y2={end[1]}
              />
              {state.tool === 'move' ? (
                <path
                  className="studio-edit__tip"
                  d="M0 -6L13 0L0 6Z"
                  transform={`translate(${end[0]} ${end[1]}) rotate(${turn})`}
                />
              ) : (
                <rect
                  className="studio-edit__tip"
                  x={-5.5}
                  y={-5.5}
                  width={11}
                  height={11}
                  transform={`translate(${end[0]} ${end[1]}) rotate(${turn})`}
                />
              )}
            </g>
          );
        })}
        <rect
          className="studio-edit__centre"
          x={pivot[0] - 7}
          y={pivot[1] - 7}
          width={14}
          height={14}
          rx={state.tool === 'move' ? 7 : 2}
          onPointerDown={grab(
            state.tool === 'move' ? { kind: 'plane' } : { kind: 'whole' },
          )}
        />
      </>
    );
  };

  return (
    <svg
      ref={rootRef}
      className={`studio-edit__overlay${state.freeView ? ' is-free' : ''}${is3d ? '' : ' is-flat'}`}
      style={{ width, height, ...style }}
      viewBox={`0 0 ${Math.max(width, 1)} ${Math.max(height, 1)}`}
      role="application"
      aria-label={t('studio.edit.switch')}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(event) => event.preventDefault()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {is3d &&
        state.things.map(
          (picked) =>
            picked.inView && (
              <rect
                key={picked.path.join('.')}
                className={`studio-edit__frame${picked === thing ? ' is-last' : ''}`}
                x={picked.box[0] * width - 4}
                y={picked.box[1] * height - 4}
                width={(picked.box[2] - picked.box[0]) * width + 8}
                height={(picked.box[3] - picked.box[1]) * height + 8}
                rx={3}
              />
            ),
        )}
      {is3d && handles()}
      {!is3d &&
        state.marks.map((mark, index) => {
          const number = String(index + 1);
          const spot: TPoint =
            mark.kind === 'pin'
              ? [mark.x * width, mark.y * height]
              : [mark.x0 * width, mark.y0 * height];
          return (
            // eslint-disable-next-line react/no-array-index-key -- a mark is its number
            <g key={index} className="studio-edit__mark">
              {mark.kind === 'box' && (
                <rect
                  className="studio-edit__mark-box"
                  x={mark.x0 * width}
                  y={mark.y0 * height}
                  width={(mark.x1 - mark.x0) * width}
                  height={(mark.y1 - mark.y0) * height}
                />
              )}
              {mark.kind === 'pin' && (
                <circle
                  className="studio-edit__mark-dot"
                  cx={spot[0]}
                  cy={spot[1]}
                  r={4}
                />
              )}
              <circle
                className="studio-edit__mark-badge"
                cx={spot[0]}
                cy={spot[1] - (mark.kind === 'pin' ? 20 : 0)}
                r={11}
              />
              <text
                className="studio-edit__mark-number"
                x={spot[0]}
                y={spot[1] - (mark.kind === 'pin' ? 20 : 0)}
              >
                {number}
              </text>
            </g>
          );
        })}
      <rect
        ref={boxRef}
        className="studio-edit__mark-box"
        visibility="hidden"
      />
    </svg>
  );
}
