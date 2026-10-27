/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  cloneElement,
  type AnimationEvent,
  type ReactElement,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { prefersReducedMotion } from '../utils/bandReveal';
import isOwnAnimationEnd from '../utils/ownAnimationEnd';

interface IRowProps {
  className?: string;
}

interface IShownRow {
  key: string;
  row: ReactElement<IRowProps>;
  /** Whether it came in by a swap, and so wears the arriving class. */
  cameBySwap: boolean;
}

/** The leaving row's own animation, whose end takes it away. */
const LEAVE_ANIMATION = 'eq-row-leave';

/**
 * THE ROW UNDER THE BANDS CHANGES WITHOUT A CUT (Ivan, 2026-10-26: "make the
 * animation where user select a band and show the band knobs and it click out
 * and shows the tone knobs on the full app so it has a nice smooth
 * animation"): the band's editor and the Tone row, and one band's editor and
 * another's.
 *
 * The two rows stand in the same cell of the bands' grid (`> .eq-flat-editor`
 * in `_mainContentGrid.scss`) and are one height by construction, so while
 * one leaves and the other arrives they overlap there and nothing above or
 * below moves. The leaving row is the last of itself the page drew, held as
 * it was, inert and hidden from readers, faded out by its own animation; its
 * end takes it away. The arriving one's controls come in left to right.
 * Opacity and transform only, played by the compositor; a band being dragged
 * keeps its key, so a drag swaps nothing. Never more than two rows: a change
 * while one is leaving drops that one at once.
 *
 * `rowKey` names what the row is about — the Tone row, or the bands
 * selected — and only a change of it swaps.
 */
const EqRowSwap = ({
  rowKey,
  children,
}: {
  rowKey: string;
  children: ReactElement<IRowProps>;
}) => {
  // The row as the page last drew it, which is what leaves when the key
  // changes: written after each commit, so during the render that changes the
  // key it still holds the old row's last face.
  const drawn = useRef<IShownRow>({
    key: rowKey,
    row: children,
    cameBySwap: false,
  });
  const [shownKey, setShownKey] = useState(rowKey);
  const [leaving, setLeaving] = useState<IShownRow | null>(null);
  const [isArriving, setIsArriving] = useState(false);

  // What leaves is what was showing, as the last commit drew it. A row coming
  // back while it was still leaving is simply that row again: it has the key
  // it left with, and the order below keeps it where it stood.
  //
  // With Animations off it is today's cut, and nothing stands in for it: the
  // stylesheet's 1 ms stand-down still drew the old row over a blank new one
  // for a frame or two before the change.
  if (shownKey !== rowKey) {
    const isStill = prefersReducedMotion();
    setLeaving(isStill ? null : drawn.current);
    setShownKey(rowKey);
    setIsArriving(!isStill);
  }

  // THE LEAVING ROW IS THE ROW THAT WAS SHOWING, THE SAME ELEMENT ON THE
  // PAGE: it keeps its key, and the rows keep the order they came in, so
  // React neither builds it again nor moves it. Rebuilt under a key of its
  // own, the whole row was made afresh at the moment it had to start moving
  // (its dials, the filter list measuring every shape's name): the first
  // frame of the swap came 90 ms late in the harness, and the leaving row sat
  // at full strength over the arriving one meanwhile. And an element that is
  // moved starts its animations over.
  const order = useRef<string[]>([rowKey]);
  const present = leaving ? [leaving.key, rowKey] : [rowKey];
  const keys = [
    ...order.current.filter((key) => present.includes(key)),
    ...present.filter((key) => !order.current.includes(key)),
  ];

  useLayoutEffect(() => {
    drawn.current = { key: rowKey, row: children, cameBySwap: isArriving };
    order.current = keys;
  });

  const onLeft = (event: AnimationEvent<Element>) => {
    if (isOwnAnimationEnd(event, LEAVE_ANIMATION)) {
      setLeaving(null);
    }
  };

  const withClass = (row: ReactElement<IRowProps>, extra: string) =>
    `${row.props.className ?? ''} ${extra}`.trim();

  return (
    <>
      {keys.map((key) =>
        leaving && key === leaving.key
          ? cloneElement(leaving.row, {
              key,
              // A row that came in by a swap keeps that class as it goes:
              // replaced before its controls had all arrived (clicks in
              // quick succession), taking it away stopped their entrance,
              // they stood at full strength for a frame and faded again —
              // the swap seen twice. Kept, they carry on from where they
              // were while the row fades over them.
              className: withClass(
                leaving.row,
                leaving.cameBySwap ? 'is-arriving is-leaving' : 'is-leaving',
              ),
              inert: true,
              'aria-hidden': true,
              onAnimationEnd: onLeft,
            } as IRowProps)
          : cloneElement(children, {
              key,
              className: withClass(children, isArriving ? 'is-arriving' : ''),
            }),
      )}
    </>
  );
};

export default EqRowSwap;
