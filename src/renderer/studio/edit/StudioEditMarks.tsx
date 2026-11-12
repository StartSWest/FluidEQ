/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useTranslation } from '../../utils/I18nContext';
import type { TPoint } from './editMath';
import { BOX_GRIPS, gripAt, movedMark, type TMarkGrip } from './markMove';
import type { TEditMark } from './stageEditStore';

/**
 * A painted scene's numbered marks, each one taken by the hand (Ivan,
 * 2026-11-12: "these things I need to be able to move them and modify them
 * like resizing or moving the pins"): a pin or a box dragged anywhere by
 * itself or its number, a box pulled by any edge or corner, and the one
 * taken last carrying its grips and a button that takes it away. A press on
 * the scene beside them still makes a new mark (`StudioEditOverlay.tsx`).
 *
 * It draws inside the overlay's own SVG, in the scene's pixels; a mark is
 * kept as shares of the scene, so it lands on the same part of the picture
 * at any size the stage shows it.
 */

interface IStudioEditMarksProps {
  marks: readonly TEditMark[];
  width: number;
  height: number;
  /** Where a pointer is, in the scene's own pixels. */
  at: (event: ReactPointerEvent) => TPoint;
  onMarks: (marks: readonly TEditMark[]) => void;
  /** The mark the hand took last, by its place: it carries the grips. */
  picked: number | undefined;
  onPick: (index: number | undefined) => void;
}

interface IHold {
  index: number;
  grip: TMarkGrip;
  from: TPoint;
  mark: TEditMark;
}

/** How far a pin's number stands over its spot. */
const BADGE_RISE = 20;
const BADGE_RADIUS = 11;
/** How far a box's number stands out from its corner, on each axis. */
const BADGE_OUT = 15;
const REMOVE_RADIUS = 8;
/** Between a number's edge and its remove button's centre. */
const REMOVE_GAP = 10;
/** What the hand catches round a grip: far wider than what is drawn. */
const GRIP_REACH = 9;

export default function StudioEditMarks({
  marks,
  width,
  height,
  at,
  onMarks,
  picked,
  onPick,
}: IStudioEditMarksProps) {
  const { t } = useTranslation();
  const holdRef = useRef<IHold | undefined>(undefined);
  const shown =
    picked !== undefined && picked < marks.length ? picked : undefined;

  const remove = (index: number) => {
    holdRef.current = undefined;
    onPick(undefined);
    onMarks(marks.filter((_, at2) => at2 !== index));
  };

  // Delete takes the taken mark away, as it does a thing in a 3D scene;
  // typing in a field is left alone.
  useEffect(() => {
    if (shown === undefined) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      const { target } = event;
      if (
        (event.key !== 'Delete' && event.key !== 'Backspace') ||
        (target instanceof Element &&
          target.closest('input, textarea, select, [contenteditable="true"]'))
      ) {
        return;
      }
      event.preventDefault();
      remove(shown);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** The part of a mark under the press, by what it is drawn as. */
  const gripOf = (target: EventTarget): TMarkGrip | undefined => {
    const named =
      target instanceof Element
        ? target.closest('[data-grip]')?.getAttribute('data-grip')
        : undefined;
    return named === 'move' || BOX_GRIPS.some((grip) => grip === named)
      ? (named as TMarkGrip)
      : undefined;
  };

  const take = (index: number) => (event: ReactPointerEvent) => {
    const grip = gripOf(event.target);
    if (event.button !== 0 || !grip) {
      return;
    }
    // Not a new mark: the scene's press under it never hears of this one.
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onPick(index);
    holdRef.current = { index, grip, from: at(event), mark: marks[index] };
  };

  const drag = (event: ReactPointerEvent) => {
    const hold = holdRef.current;
    if (!hold) {
      return;
    }
    event.stopPropagation();
    const now = at(event);
    const next = movedMark(
      hold.mark,
      hold.grip,
      (now[0] - hold.from[0]) / Math.max(width, 1),
      (now[1] - hold.from[1]) / Math.max(height, 1),
    );
    onMarks(marks.map((mark, index) => (index === hold.index ? next : mark)));
  };

  const letGo = (event: ReactPointerEvent) => {
    if (holdRef.current) {
      event.stopPropagation();
      holdRef.current = undefined;
    }
  };

  return (
    <>
      {marks.map((mark, index) => {
        const number = String(index + 1);
        const isPicked = index === shown;
        const spot: TPoint =
          mark.kind === 'pin'
            ? [mark.x * width, mark.y * height]
            : [mark.x0 * width, mark.y0 * height];
        // A pin's number stands over its spot, its remove button beside it.
        // A box's stands just outside its left edge, under the corner: off
        // the corner's grip, and below the top edge, where a box against the
        // top of the stage had them under the stage's own controls (seen at
        // 1024 wide). Its remove button stands under the number; both stay
        // on the scene when the box is against its edge.
        const badge: TPoint =
          mark.kind === 'pin'
            ? [spot[0], spot[1] - BADGE_RISE]
            : [
                Math.max(BADGE_RADIUS + 1, spot[0] - BADGE_OUT),
                spot[1] + BADGE_OUT,
              ];
        const removeAt: TPoint =
          mark.kind === 'pin'
            ? [badge[0] + BADGE_RADIUS + REMOVE_GAP, badge[1]]
            : [badge[0], badge[1] + BADGE_RADIUS + REMOVE_GAP];
        return (
          <g
            // eslint-disable-next-line react/no-array-index-key -- a mark is its number
            key={index}
            className={`studio-edit__mark is-${mark.kind}${isPicked ? ' is-picked' : ''}`}
            onPointerDown={take(index)}
            onPointerMove={drag}
            onPointerUp={letGo}
            onPointerCancel={letGo}
          >
            {mark.kind === 'box' && (
              <rect
                className="studio-edit__mark-box"
                data-grip="move"
                x={mark.x0 * width}
                y={mark.y0 * height}
                width={(mark.x1 - mark.x0) * width}
                height={(mark.y1 - mark.y0) * height}
              />
            )}
            {mark.kind === 'pin' && (
              <>
                <line
                  className="studio-edit__mark-stem"
                  x1={spot[0]}
                  y1={spot[1]}
                  x2={badge[0]}
                  y2={badge[1]}
                />
                <circle
                  className="studio-edit__mark-dot"
                  cx={spot[0]}
                  cy={spot[1]}
                  r={4}
                />
              </>
            )}
            <g className="studio-edit__mark-handle" data-grip="move">
              {mark.kind === 'pin' && (
                <circle
                  className="studio-edit__mark-reach"
                  cx={spot[0]}
                  cy={spot[1]}
                  r={GRIP_REACH}
                />
              )}
              <circle
                className="studio-edit__mark-badge"
                cx={badge[0]}
                cy={badge[1]}
                r={BADGE_RADIUS}
              />
              <text
                className="studio-edit__mark-number"
                x={badge[0]}
                y={badge[1]}
              >
                {number}
              </text>
            </g>
            {isPicked &&
              mark.kind === 'box' &&
              BOX_GRIPS.map((grip) => {
                const [x, y] = gripAt(mark, grip);
                return (
                  <g
                    key={grip}
                    className={`studio-edit__mark-grip is-${grip}`}
                    data-grip={grip}
                  >
                    <circle
                      className="studio-edit__mark-reach"
                      cx={x * width}
                      cy={y * height}
                      r={GRIP_REACH}
                    />
                    <rect
                      className="studio-edit__mark-corner"
                      x={x * width - 4.5}
                      y={y * height - 4.5}
                      width={9}
                      height={9}
                      rx={2}
                    />
                  </g>
                );
              })}
            {isPicked && (
              <g
                className="studio-edit__mark-remove"
                role="button"
                tabIndex={-1}
                aria-label={t('studio.edit.flat.removeMark', { number })}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onPointerUp={(event) => {
                  event.stopPropagation();
                  remove(index);
                }}
              >
                <title>{t('studio.edit.flat.removeMark', { number })}</title>
                <circle cx={removeAt[0]} cy={removeAt[1]} r={REMOVE_RADIUS} />
                <path
                  d={`M${removeAt[0] - 3} ${removeAt[1] - 3}l6 6m0 -6l-6 6`}
                />
              </g>
            )}
          </g>
        );
      })}
    </>
  );
}
