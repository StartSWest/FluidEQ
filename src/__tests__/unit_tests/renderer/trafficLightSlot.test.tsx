/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import type { ComponentType } from 'react';
import { TRAFFIC_LIGHTS_CHANNEL } from 'common/windowMode';
import TrafficLightSlot from 'renderer/components/TrafficLightSlot';

/** Where the slot and the strip it stands in say they are. */
let slotBox = { left: 30, top: 17, height: 64 };
let stripBottom = 86;

const sendMessage = jest.fn();
let observed: (() => void) | undefined;
let nativeWindowChanged: (() => void) | undefined;

/** A ResizeObserver whose callback the test calls itself. */
const fakeResizeObserver = jest.fn((callback: () => void) => {
  observed = callback;
  return { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() };
});

const box = (left: number, top: number, height: number) =>
  ({
    left,
    top,
    height,
    width: 54,
    right: left + 54,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => undefined,
  }) as DOMRect;

/**
 * The slot on a system. The module remembers what it last sent for the whole
 * window, so each test below places its slot somewhere no other test does.
 */
const loadSlot = (platform: string): ComponentType => {
  window.electron = {
    platform,
    ipcRenderer: {
      sendMessage,
      on: jest.fn((_channel: string, listener: () => void) => {
        nativeWindowChanged = listener;
        return () => {
          nativeWindowChanged = undefined;
        };
      }),
    },
  } as unknown as typeof window.electron;
  return TrafficLightSlot;
};

const Strip = ({ Slot }: { Slot: ComponentType }) => (
  <header data-window-strip>
    <Slot />
  </header>
);

beforeEach(() => {
  jest.clearAllMocks();
  observed = undefined;
  nativeWindowChanged = undefined;
  slotBox = { left: 30, top: 17, height: 64 };
  stripBottom = 86;
  window.ResizeObserver =
    fakeResizeObserver as unknown as typeof window.ResizeObserver;
  jest
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function measured(this: Element) {
      if (this.classList.contains('traffic-light-slot')) {
        return box(slotBox.left, slotBox.top, slotBox.height);
      }
      return box(0, 0, stripBottom);
    });
});

afterEach(() => jest.restoreAllMocks());

describe("the traffic lights' place in a strip", () => {
  it('is nothing at all on Windows', () => {
    const Slot = loadSlot('win32');
    const { container } = render(<Strip Slot={Slot} />);
    expect(container.querySelector('.traffic-light-slot')).toBeNull();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("tells main a Mac's buttons' left edge, centre line and the strip's foot", () => {
    const Slot = loadSlot('darwin');
    const { container } = render(<Strip Slot={Slot} />);
    const slot = container.querySelector<HTMLElement>('.traffic-light-slot');
    expect(slot).not.toBeNull();
    expect(slot).toHaveAttribute('aria-hidden');
    expect(sendMessage).toHaveBeenCalledWith(
      TRAFFIC_LIGHTS_CHANNEL,
      [30, 49, 86],
    );
    // The margin its width is taken from, in the same pixels.
    expect(slot?.style.getPropertyValue('--traffic-lights-x')).toBe('30px');
  });

  it('says it again only when the numbers or the zoom move', () => {
    slotBox = { left: 31, top: 18, height: 64 };
    stripBottom = 87;
    const Slot = loadSlot('darwin');
    render(<Strip Slot={Slot} />);
    expect(sendMessage).toHaveBeenCalledTimes(1);

    act(() => observed?.());
    expect(sendMessage).toHaveBeenCalledTimes(1);

    // A shorter window's smaller bar.
    slotBox = { left: 19, top: 11, height: 50 };
    stripBottom = 64;
    act(() => observed?.());
    expect(sendMessage).toHaveBeenLastCalledWith(
      TRAFFIC_LIGHTS_CHANNEL,
      [19, 36, 64],
    );

    // Same CSS pixels at another zoom are other points on the screen.
    const ratio = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: ratio * 1.25,
    });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(sendMessage).toHaveBeenCalledTimes(3);
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: ratio,
    });
  });

  it('says nothing while its strip is not on screen', () => {
    slotBox = { left: 0, top: 0, height: 0 };
    const Slot = loadSlot('darwin');
    render(<Strip Slot={Slot} />);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('repositions after native show and completed layout even when the page box has not moved', () => {
    slotBox = { left: 32, top: 18, height: 64 };
    const Slot = loadSlot('darwin');
    render(<Strip Slot={Slot} />);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    act(() => nativeWindowChanged?.());
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenLastCalledWith(
      TRAFFIC_LIGHTS_CHANNEL,
      [32, 50, 86],
    );
  });

  it('follows changed native overlay geometry without feeding unchanged answers back forever', () => {
    const original = Object.getOwnPropertyDescriptor(
      navigator,
      'windowControlsOverlay',
    );
    let area = box(80, 0, 56);
    const overlay = Object.assign(new EventTarget(), {
      getTitlebarAreaRect: () => area,
    });
    Object.defineProperty(navigator, 'windowControlsOverlay', {
      configurable: true,
      value: overlay,
    });
    try {
      slotBox = { left: 33, top: 18, height: 64 };
      const Slot = loadSlot('darwin');
      const view = render(<Strip Slot={Slot} />);
      expect(sendMessage).toHaveBeenCalledTimes(1);
      act(() => overlay.dispatchEvent(new Event('geometrychange')));
      expect(sendMessage).toHaveBeenCalledTimes(2);
      act(() => overlay.dispatchEvent(new Event('geometrychange')));
      expect(sendMessage).toHaveBeenCalledTimes(2);
      area = box(0, 0, 0);
      act(() => overlay.dispatchEvent(new Event('geometrychange')));
      expect(sendMessage).toHaveBeenCalledTimes(2);
      area = box(80, 0, 28);
      act(() => overlay.dispatchEvent(new Event('geometrychange')));
      expect(sendMessage).toHaveBeenCalledTimes(3);
      view.unmount();
      area = box(80, 0, 56);
      act(() => overlay.dispatchEvent(new Event('geometrychange')));
      expect(sendMessage).toHaveBeenCalledTimes(3);
    } finally {
      if (original) {
        Object.defineProperty(navigator, 'windowControlsOverlay', original);
      } else {
        Reflect.deleteProperty(navigator, 'windowControlsOverlay');
      }
    }
  });
});
