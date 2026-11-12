/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A painted scene's marks taken by the hand (Ivan, 2026-11-12: "these
 * things I need to be able to move them and modify them like resizing or
 * moving the pins"): a pin or a box dragged by itself or its number, a box
 * pulled by an edge or a corner, never out of the scene or inside out, and
 * the one taken last carrying its grips and a button that takes it away -
 * while a press on the scene beside them still makes a new mark.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import StudioEditMarks from '../../../renderer/studio/edit/StudioEditMarks';
import { LEAST_BOX, movedMark } from '../../../renderer/studio/edit/markMove';
import type { TEditMark } from '../../../renderer/studio/edit/stageEditStore';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values ? `${key} ${Object.values(values).join(' ')}` : key,
  }),
}));

const BOX: TEditMark = { kind: 'box', x0: 0.2, y0: 0.3, x1: 0.6, y1: 0.5 };
const near = (mark: TEditMark) =>
  JSON.parse(
    JSON.stringify(mark, (_key, value: unknown) =>
      typeof value === 'number' ? Math.round(value * 1000) / 1000 : value,
    ),
  ) as TEditMark;

describe('a mark moved by hand', () => {
  it('moves a pin, and keeps it on the scene', () => {
    expect(
      near(movedMark({ kind: 'pin', x: 0.5, y: 0.5 }, 'move', 0.1, -0.2)),
    ).toEqual({
      kind: 'pin',
      x: 0.6,
      y: 0.3,
    });
    expect(
      movedMark({ kind: 'pin', x: 0.9, y: 0.1 }, 'move', 0.5, -0.5),
    ).toEqual({
      kind: 'pin',
      x: 1,
      y: 0,
    });
  });

  it('moves a box whole, its size kept even against the scene’s edge', () => {
    expect(near(movedMark(BOX, 'move', 0.1, 0.1))).toEqual({
      kind: 'box',
      x0: 0.3,
      y0: 0.4,
      x1: 0.7,
      y1: 0.6,
    });
    expect(near(movedMark(BOX, 'move', 0.9, -0.9))).toEqual({
      kind: 'box',
      x0: 0.6,
      y0: 0,
      x1: 1,
      y1: 0.2,
    });
  });

  it('pulls one edge, or two at a corner, and leaves the others where they were', () => {
    expect(near(movedMark(BOX, 'e', 0.1, 0.3))).toEqual({
      ...BOX,
      x1: 0.7,
    });
    expect(near(movedMark(BOX, 'n', 0.3, -0.1))).toEqual({
      ...BOX,
      y0: 0.2,
    });
    expect(near(movedMark(BOX, 'sw', -0.1, 0.1))).toEqual({
      ...BOX,
      x0: 0.1,
      y1: 0.6,
    });
  });

  it('never turns a box inside out, nor pulls it past the scene', () => {
    const shrunk = movedMark(BOX, 'w', 0.9, 0);
    expect(shrunk.kind === 'box' && shrunk.x1 - shrunk.x0).toBeCloseTo(
      LEAST_BOX,
    );
    expect(near(movedMark(BOX, 'se', 2, 2))).toEqual({
      ...BOX,
      x1: 1,
      y1: 1,
    });
  });
});

/** The marks as the overlay holds them, in a scene drawn 1000 by 500. */
function Marks({ start }: { start: TEditMark[] }) {
  const [marks, setMarks] = useState<readonly TEditMark[]>(start);
  const [picked, setPicked] = useState<number | undefined>(undefined);
  return (
    <svg data-testid="scene" onPointerDown={() => setPicked(undefined)}>
      <StudioEditMarks
        marks={marks}
        width={1000}
        height={500}
        at={(event) => [event.clientX, event.clientY]}
        onMarks={setMarks}
        picked={picked}
        onPick={setPicked}
      />
      <text data-testid="kept">{JSON.stringify(marks)}</text>
    </svg>
  );
}

const kept = () =>
  (
    JSON.parse(screen.getByTestId('kept').textContent ?? '[]') as TEditMark[]
  ).map(near);

const grab = (target: Element, x: number, y: number) =>
  fireEvent.pointerDown(target, {
    button: 0,
    clientX: x,
    clientY: y,
    pointerId: 1,
  });
const pull = (target: Element, x: number, y: number) =>
  fireEvent.pointerMove(target, { clientX: x, clientY: y, pointerId: 1 });
const drop = (target: Element) => fireEvent.pointerUp(target, { pointerId: 1 });

/** jsdom has no PointerEvent: without one, a press carries no button or place. */
class TestPointerEvent extends MouseEvent {
  pointerId = 1;
}

beforeAll(() => {
  Object.assign(window, { PointerEvent: TestPointerEvent });
  // Nor pointer capture.
  Element.prototype.setPointerCapture = () => undefined;
});

describe('the marks on the stage', () => {
  it('drag a pin by its number to wherever the hand goes', () => {
    render(<Marks start={[{ kind: 'pin', x: 0.5, y: 0.5 }]} />);
    const number = screen.getByText('1');
    grab(number, 500, 230);
    pull(number, 600, 180);
    drop(number);
    expect(kept()).toEqual([{ kind: 'pin', x: 0.6, y: 0.4 }]);
  });

  it('show a box’s grips only once it is taken, and resize it by a corner', () => {
    const { container } = render(<Marks start={[BOX]} />);
    expect(container.querySelector('.studio-edit__mark-grip')).toBeNull();
    const box = container.querySelector('.studio-edit__mark-box');
    if (!box) {
      throw new Error('no box');
    }
    grab(box, 400, 200);
    drop(box);
    const grips = container.querySelectorAll('.studio-edit__mark-grip');
    expect(grips).toHaveLength(8);
    const corner = container.querySelector('.studio-edit__mark-grip.is-se');
    if (!corner) {
      throw new Error('no corner');
    }
    grab(corner, 600, 250);
    pull(corner, 700, 300);
    drop(corner);
    expect(kept()).toEqual([{ ...BOX, x1: 0.7, y1: 0.6 }]);
  });

  it('take the taken mark away on its button, and the others keep their places', () => {
    const { container } = render(
      <Marks start={[{ kind: 'pin', x: 0.1, y: 0.1 }, BOX]} />,
    );
    const second = screen.getByText('2');
    grab(second, 200, 150);
    drop(second);
    const remove = screen.getByRole('button', {
      name: 'studio.edit.flat.removeMark 2',
    });
    fireEvent.pointerDown(remove, { button: 0 });
    fireEvent.pointerUp(remove);
    expect(kept()).toEqual([{ kind: 'pin', x: 0.1, y: 0.1 }]);
    expect(container.querySelector('.studio-edit__mark-grip')).toBeNull();
  });

  it('take the taken mark away on Delete, and leave a field being typed in alone', () => {
    render(<Marks start={[{ kind: 'pin', x: 0.1, y: 0.1 }, BOX]} />);
    const first = screen.getByText('1');
    grab(first, 100, 30);
    drop(first);
    const field = document.createElement('input');
    document.body.append(field);
    fireEvent.keyDown(field, { key: 'Delete' });
    expect(kept()).toHaveLength(2);
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(kept()).toEqual([near(BOX)]);
    field.remove();
  });

  it('never let a press on a mark reach the scene, where it would make a new one', () => {
    const onScene = jest.fn();
    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- a stand-in for the overlay's own press
      <div onPointerDown={onScene}>
        <Marks start={[{ kind: 'pin', x: 0.5, y: 0.5 }]} />
      </div>,
    );
    grab(screen.getByText('1'), 500, 230);
    expect(onScene).not.toHaveBeenCalled();
    // The control: the scene beside the mark does hear its press.
    grab(screen.getByTestId('scene'), 10, 10);
    expect(onScene).toHaveBeenCalledTimes(1);
  });
});
