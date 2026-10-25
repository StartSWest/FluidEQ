/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { ISceneStore } from 'common/sceneStore';
import CreditsCard from '../../../renderer/account/CreditsCard';

let mockStore: ISceneStore | undefined;

jest.mock('../../../renderer/plus/sceneStore', () => ({
  useSceneStore: () => ({ owner: 'me', loading: false, store: mockStore }),
}));
// The packs are the dialog's, which these cases never open.
jest.mock('../../../renderer/plus/PackPurchase', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

const storeWith = (over: Partial<ISceneStore> = {}): ISceneStore => ({
  balance: 2,
  starterClaimed: true,
  owned: ['premium:alpine'],
  packs: [{ id: 'pack-5', credits: 5, priceCents: 499 }],
  ...over,
});

describe('the credits card', () => {
  it('draws nothing until the server has said, rather than a balance of zero', () => {
    mockStore = undefined;
    const { container } = render(<CreditsCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the balance and the scenes owned', () => {
    mockStore = storeWith();
    render(<CreditsCard />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('store.credits.owned:1')).toBeInTheDocument();
  });

  it('says when half a credit from the account’s scenes waits, and only then', () => {
    mockStore = storeWith({ halfCredit: true });
    const { rerender } = render(<CreditsCard />);
    expect(screen.getByText('store.credits.half')).toBeInTheDocument();
    // The control: the same card with nothing waiting.
    mockStore = storeWith();
    rerender(<CreditsCard />);
    expect(screen.queryByText('store.credits.half')).not.toBeInTheDocument();
  });

  it('offers the free credits first, and wears the loud style only with none to spend', () => {
    mockStore = storeWith({ balance: 0, starterClaimed: false });
    const { rerender } = render(<CreditsCard />);
    const free = screen.getByRole('button', { name: 'store.credits.getFree' });
    expect(free).toHaveClass('button', 'small');
    expect(free).not.toHaveClass('subtle');
    mockStore = storeWith({ balance: 3 });
    rerender(<CreditsCard />);
    expect(
      screen.getByRole('button', { name: 'store.credits.buy' }),
    ).toHaveClass('subtle');
  });
});
