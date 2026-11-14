/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The coins that celebrate a paid pack (Ivan, 2026-11-13: "when they
 * purchase credits, show the nice coin animating on the screen with a
 * celebration and then disappear. If they get one coin in the package, show
 * one; if they get the 2-coin package, 2 coins show"). Held here: as many
 * coins as the pack's pile in Get credits, played only when main says a
 * payment was confirmed - never for a store that merely changed - and gone
 * afterwards, by finishing or by Esc, with nothing left listening.
 *
 * jsdom has no Web Animations, so `animate` is stood in for: every animation
 * the celebration starts is recorded, and finishes or cancels on command.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ICreditPack, ISceneStore } from 'common/sceneStore';
import CoinCelebration from 'renderer/plus/CoinCelebration';
import CreditPacks from 'renderer/plus/CreditPacks';
import packCoins from 'renderer/plus/packCoins';
import { resetSceneStore } from 'renderer/plus/sceneStore';
import { I18nProvider } from 'renderer/utils/I18nContext';

let mockReduced = false;

jest.mock('../../../renderer/utils/bandReveal', () => ({
  ...jest.requireActual('../../../renderer/utils/bandReveal'),
  prefersReducedMotion: () => mockReduced,
}));

jest.mock('../../../renderer/account/accountStore', () => ({
  getAccountSnapshot: () => ({
    status: 'signed-in',
    identity: { id: 'member', email: 'member@example.com' },
  }),
  useAccount: () => ({
    status: 'signed-in',
    identity: { id: 'member', email: 'member@example.com' },
  }),
  subscribeAccount: () => () => undefined,
}));

jest.mock('../../../renderer/account/entitlementStore', () => ({
  useEntitlement: () => ({ state: 'none' }),
  getEntitlementSnapshot: () => ({ state: 'none' }),
  subscribeEntitlement: () => () => undefined,
}));

const PACKS: ICreditPack[] = [
  { id: 'pack-5', credits: 5, priceCents: 500 },
  { id: 'pack-12', credits: 12, priceCents: 1000 },
  { id: 'pack-30', credits: 30, priceCents: 2200 },
];

const store = (balance: number): ISceneStore => ({
  balance,
  starterClaimed: true,
  owned: [],
  packs: PACKS,
});

interface IFakeAnimation {
  frames: Keyframe[];
  finish: () => void;
  cancel: jest.Mock;
  finished: Promise<void>;
}

let animations: IFakeAnimation[] = [];
let arrived: ((credits: number) => void) | undefined;
let storeChanged: ((next: ISceneStore | null) => void) | undefined;
let arrivalListeners = 0;

beforeEach(() => {
  resetSceneStore();
  mockReduced = false;
  animations = [];
  arrived = undefined;
  storeChanged = undefined;
  arrivalListeners = 0;
  window.electron = {
    ipcRenderer: {
      getSceneStore: async () => ({ ok: true, store: store(3) }),
      onSceneStoreChanged: (listener: (next: ISceneStore | null) => void) => {
        storeChanged = listener;
        return () => undefined;
      },
      onCreditsArrived: (listener: (credits: number) => void) => {
        arrived = listener;
        arrivalListeners += 1;
        return () => {
          arrivalListeners -= 1;
        };
      },
      onCheckoutReturned: () => () => undefined,
    },
  } as unknown as typeof window.electron;
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value(frames: Keyframe[]) {
      let settle: () => void = () => undefined;
      let fail: (error: Error) => void = () => undefined;
      const finished = new Promise<void>((resolve, reject) => {
        settle = resolve;
        fail = reject;
      });
      const animation: IFakeAnimation = {
        frames,
        finish: () => settle(),
        cancel: jest.fn(() => fail(new Error('AbortError'))),
        finished,
      };
      animations.push(animation);
      return animation;
    },
  });
});

const celebrate = async (credits: number) => {
  await act(async () => arrived?.(credits));
};

const coinsOnScreen = () =>
  document.querySelectorAll('.coin-celebration .credit-coin').length;

describe('how many coins', () => {
  it('counts each pack by its rank, one to three, the same as its pile in Get credits', () => {
    expect([5, 12, 30].map((credits) => packCoins(PACKS, credits))).toEqual([
      1, 2, 3,
    ]);
    render(
      <I18nProvider>
        <CreditPacks
          packs={PACKS}
          selected="pack-12"
          onSelect={jest.fn()}
          disabled={false}
          labelledBy="packs"
        />
      </I18nProvider>,
    );
    const piles = [...document.querySelectorAll('.store-pack__pile')].map(
      (pile) => pile.querySelectorAll('.store-pack__coin').length,
    );
    expect(piles).toEqual([1, 2, 3]);
  });

  it('counts credits that are no single pack as the biggest pack they cover', () => {
    expect(packCoins(PACKS, 24)).toBe(2);
    expect(packCoins(PACKS, 60)).toBe(3);
    expect(packCoins(PACKS, 2)).toBe(1);
    expect(packCoins([], 12)).toBe(1);
  });

  it('never shows more than three coins, however many packs are sold', () => {
    const more = [...PACKS, { id: 'pack-60', credits: 60, priceCents: 4000 }];
    expect(packCoins(more, 30)).toBe(3);
    expect(packCoins(more, 60)).toBe(3);
  });
});

describe('the celebration', () => {
  const mount = async () => {
    const view = render(
      <I18nProvider>
        <CoinCelebration />
      </I18nProvider>,
    );
    await act(async () => undefined);
    return view;
  };

  it('plays as many coins as the pack, with its line, and is gone once it has played', async () => {
    // The window's own listeners for the skip, counted in and out.
    const live = new Map<string, number>();
    const count = (type: string, by: number) =>
      live.set(type, (live.get(type) ?? 0) + by);
    const add = jest
      .spyOn(window, 'addEventListener')
      .mockImplementation(function counted(this: Window, type, ...rest) {
        count(type, 1);
        return EventTarget.prototype.addEventListener.call(this, type, ...rest);
      });
    const remove = jest
      .spyOn(window, 'removeEventListener')
      .mockImplementation(function counted(this: Window, type, ...rest) {
        count(type, -1);
        return EventTarget.prototype.removeEventListener.call(
          this,
          type,
          ...rest,
        );
      });
    await mount();
    expect(document.querySelector('.coin-celebration')).toBeNull();
    const before = { keydown: live.get('keydown') ?? 0 };

    await celebrate(12);
    expect(coinsOnScreen()).toBe(2);
    expect(screen.getByRole('status')).toHaveTextContent('+12 credits');
    expect(animations.length).toBeGreaterThan(0);
    expect(live.get('keydown')).toBe(before.keydown + 1);
    expect(live.get('pointerdown')).toBe(1);

    await act(async () =>
      animations.forEach((animation) => animation.finish()),
    );
    expect(document.querySelector('.coin-celebration')).toBeNull();
    // Nothing left listening for a skip once it has played.
    expect(live.get('keydown')).toBe(before.keydown);
    expect(live.get('pointerdown')).toBe(0);
    add.mockRestore();
    remove.mockRestore();
  });

  it('control: a store that changes - credits from anywhere - plays nothing', async () => {
    await mount();
    await act(async () => storeChanged?.(store(15)));
    expect(document.querySelector('.coin-celebration')).toBeNull();
    expect(animations).toHaveLength(0);
  });

  it('ends at Esc, every animation cancelled, without moving focus', async () => {
    await mount();
    const field = document.createElement('input');
    document.body.appendChild(field);
    field.focus();

    // A dialog under the coins, which closes on Esc.
    const dialogHeard = jest.fn();
    document.addEventListener('keydown', dialogHeard);

    await celebrate(30);
    expect(coinsOnScreen()).toBe(3);
    expect(document.activeElement).toBe(field);

    await act(async () => {
      fireEvent.keyDown(field, { key: 'Escape' });
    });
    expect(
      animations.every((animation) => animation.cancel.mock.calls.length > 0),
    ).toBe(true);
    expect(document.querySelector('.coin-celebration')).toBeNull();
    expect(document.activeElement).toBe(field);
    // The Esc was the coins'; the dialog never heard it.
    expect(dialogHeard).not.toHaveBeenCalled();

    // The control: with nothing celebrating, Esc reaches the dialog again.
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(dialogHeard).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', dialogHeard);
    field.remove();
  });

  it('plays two packs one after the other, never on top of each other', async () => {
    await mount();
    await celebrate(5);
    await celebrate(30);
    expect(document.querySelectorAll('.coin-celebration')).toHaveLength(1);
    expect(coinsOnScreen()).toBe(1);

    await act(async () =>
      animations.forEach((animation) => animation.finish()),
    );
    expect(coinsOnScreen()).toBe(3);
  });

  it('only fades with motion turned down: nothing moves', async () => {
    mockReduced = true;
    await mount();
    await celebrate(12);
    expect(animations.length).toBeGreaterThan(0);
    const moving = animations.filter((animation) =>
      animation.frames.some((frame) => frame.transform !== undefined),
    );
    expect(moving).toHaveLength(0);
  });

  it('stops listening for payments when it is taken away', async () => {
    const view = await mount();
    expect(arrivalListeners).toBe(1);
    view.unmount();
    expect(arrivalListeners).toBe(0);
  });
});
