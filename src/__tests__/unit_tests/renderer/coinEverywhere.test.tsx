/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { cleanup, render, screen } from '@testing-library/react';
import type { ISceneStore } from '../../../common/sceneStore';
import MenuIcon from '../../../renderer/icons/MenuIcon';
import BuySceneDialog from '../../../renderer/plus/BuySceneDialog';
import PackPurchase from '../../../renderer/plus/PackPurchase';
import { BRAND_MARK } from '../../../common/branding';

// Ivan, 2026-11-13: "make the 3d coin the coin icon for all coins in the
// app". The places the first pass left with the flat coin or a bare number:
// the notice that a credit came back, and the balance in the buy dialog.
// Then 2026-11-14: "show it on buttons that use the credit" — spending one
// and paying for more both lead with the coin.
const mockStore: ISceneStore = {
  balance: 4,
  starterClaimed: true,
  owned: [],
  packs: [{ id: 'p12', credits: 12, priceCents: 999 }],
};

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));
jest.mock('../../../renderer/plus/sceneStore', () => ({
  useSceneStore: () => ({ store: mockStore, loading: false }),
  buyScene: jest.fn(),
  checkoutCreditPack: jest.fn(),
  onCheckoutReturned: () => () => undefined,
  claimStarterCredits: jest.fn(),
}));
jest.mock('../../../renderer/plus/GalleryParts', () => ({
  ScenePicture: () => null,
}));

afterEach(cleanup);

const isCoin = (svg: Element | null) =>
  svg !== null &&
  svg.querySelector(`path[d="${BRAND_MARK.path}"]`) !== null &&
  svg.querySelectorAll('circle').length >= 4;

const renderBuy = () =>
  render(
    <BuySceneDialog
      scene={{
        lookId: 'look',
        authorId: 'ada',
        sceneId: 'scene',
        version: 1,
        updatedAt: '2026-11-13T00:00:00Z',
      }}
      name="Lake"
      onClose={jest.fn()}
    />,
  );

it('draws the menu glyph for a credit as the 3D coin', () => {
  const { container } = render(
    <MenuIcon name="credit" className="member-notice__mark" />,
  );
  const svg = container.querySelector('svg');
  expect(svg).toHaveClass('member-notice__mark');
  expect(isCoin(svg)).toBe(true);
});

it('leaves every other menu glyph a stroke', () => {
  const { container } = render(<MenuIcon name="trash" />);
  expect(isCoin(container.querySelector('svg'))).toBe(false);
  expect(container.querySelector('svg path')).toHaveAttribute('d');
});

it('puts the coin in front of the balance before and after a buy', () => {
  renderBuy();
  const balance = screen.getByText(/^store\.buy\.balance:/);
  expect(balance).toHaveClass('store-balance');
  expect(isCoin(balance.querySelector('svg'))).toBe(true);
});

it('leads the button that spends a credit with the coin', () => {
  renderBuy();
  const use = screen.getByRole('button', { name: /^store\.buy\.use:/ });
  expect(use).toHaveClass('coin-action');
  expect(isCoin(use.firstElementChild)).toBe(true);
});

it('leads the button that pays for a pack with the coin', () => {
  render(<PackPurchase store={mockStore} />);
  const pay = screen.getByRole('button', { name: /^store\.packs\.pay:/ });
  expect(pay).toHaveClass('coin-action');
  expect(isCoin(pay.firstElementChild)).toBe(true);
});

it('leads the claim of the free credits with the coin', () => {
  render(<PackPurchase store={{ ...mockStore, starterClaimed: false }} />);
  const claim = screen.getByRole('button', {
    name: /^store\.starter\.claim:/,
  });
  expect(claim).toHaveClass('coin-action');
  expect(isCoin(claim.firstElementChild)).toBe(true);
});
