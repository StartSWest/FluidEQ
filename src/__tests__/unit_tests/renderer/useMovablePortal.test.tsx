/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One subtree shown in whichever place takes it (`useMovablePortal`): it
 * moves without mounting again, and what was scrolled inside it is where it
 * was in the next place - kept where it stood, at its end when it was at
 * its end, and at its end when it fitted whole. Each rule beside its
 * control.
 *
 * jsdom lays nothing out, so each place says how tall the talk is in it,
 * and a scroller moved to another place starts at its top, as a browser's
 * does: an element taken out of the document forgets how far it was
 * scrolled.
 */

import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import useMovablePortal from '../../../renderer/utils/useMovablePortal';

const mounted = jest.fn();

type TPlace = 'here' | 'there';
interface ILayout {
  height: number;
  client: number;
}
/** How the scroller lays out in each place. */
const layout: Record<TPlace, ILayout> = {
  here: { height: 0, client: 0 },
  there: { height: 0, client: 0 },
};
/** Where each scroller is scrolled, and in which place. */
const scrolls = new WeakMap<Element, { top: number; place?: TPlace }>();
/** Every scroll written, by the test id of what it was written to. */
const written: string[] = [];

const placeOf = (element: Element): TPlace | undefined => {
  const slot = element.closest('[data-place]');
  return slot ? (slot.getAttribute('data-place') as TPlace) : undefined;
};
const scrolling = (element: Element) =>
  element.getAttribute('data-testid') === 'thread';
const laidOut = (element: Element): ILayout => {
  const place = placeOf(element);
  return place && scrolling(element) ? layout[place] : { height: 0, client: 0 };
};

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
    configurable: true,
    get(this: HTMLElement) {
      const kept = scrolls.get(this);
      return kept && kept.place === placeOf(this) ? kept.top : 0;
    },
    set(this: HTMLElement, value: number) {
      written.push(this.dataset.testid ?? '');
      const { height, client } = laidOut(this);
      scrolls.set(this, {
        top: Math.max(0, Math.min(value, height - client)),
        place: placeOf(this),
      });
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return laidOut(this).height;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return laidOut(this).client;
    },
  });
});

beforeEach(() => {
  mounted.mockClear();
  written.length = 0;
});

function Talk() {
  useEffect(() => {
    mounted();
  }, []);
  return (
    <>
      <div data-testid="thread" style={{ overflowY: 'auto' }}>
        talk
      </div>
      <div data-testid="still">a line</div>
    </>
  );
}

let swap: () => void = () => undefined;

function Places() {
  const [first, setFirst] = useState(true);
  swap = () => setFirst((was) => !was);
  const talk = useMovablePortal(<Talk />, 'host');
  return (
    <>
      {/* Keyed: two places, never one element React reuses for both. */}
      {first ? (
        <div key="here" data-place="here" ref={talk.place} />
      ) : (
        <div key="there" data-place="there" ref={talk.place} />
      )}
      {talk.portal}
    </>
  );
}

const thread = () => screen.getByTestId('thread');
const scrollTo = (top: number) => {
  thread().scrollTop = top;
};
const move = () => act(() => swap());

describe('a subtree moved between places', () => {
  it('moves without mounting again', () => {
    render(<Places />);
    expect(placeOf(thread())).toBe('here');
    move();
    expect(placeOf(thread())).toBe('there');
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it('keeps a scroll part-way down where it stood', () => {
    layout.here = { height: 300, client: 100 };
    layout.there = { height: 300, client: 100 };
    render(<Places />);
    scrollTo(40);
    move();
    expect(thread().scrollTop).toBe(40);
  });

  it('keeps a talk at its end at the end of the next place, however tall', () => {
    layout.here = { height: 300, client: 100 };
    // Narrower there, so taller.
    layout.there = { height: 420, client: 100 };
    render(<Places />);
    scrollTo(200);
    move();
    expect(thread().scrollTop).toBe(320);
  });

  it('brings a talk that fitted whole back at its end, not its first line', () => {
    layout.here = { height: 100, client: 100 };
    layout.there = { height: 300, client: 100 };
    render(<Places />);
    move();
    expect(thread().scrollTop).toBe(200);
  });

  it('control: a talk at its first line with more under it stays there', () => {
    layout.here = { height: 300, client: 100 };
    layout.there = { height: 300, client: 100 };
    render(<Places />);
    move();
    expect(thread().scrollTop).toBe(0);
  });

  it('control: what does not scroll is not scrolled, beside what does', () => {
    layout.here = { height: 100, client: 100 };
    layout.there = { height: 300, client: 100 };
    render(<Places />);
    move();
    expect(written).toContain('thread');
    expect(written).not.toContain('still');
  });
});
