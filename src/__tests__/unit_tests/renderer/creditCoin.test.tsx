/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { cleanup, render } from '@testing-library/react';
import CreditCoin from '../../../renderer/plus/CreditCoin';
import { BRAND_MARK } from '../../../common/branding';

// The site's credit coin, in the app (Ivan, 2026-11-13): the count on a
// badge beside the coin, the app icon's wave on its face, the orbit only on
// the large one, and nothing a screen reader reads, since the copy beside
// it says everything.
afterEach(cleanup);

it('carries its count on a badge, and the wave on its face', () => {
  const { container } = render(<CreditCoin size="l" badge={3} />);
  const coin = container.querySelector('.credit-coin');
  expect(coin).toHaveAttribute('aria-hidden', 'true');
  expect(container.querySelector('.credit-coin__badge')).toHaveTextContent('3');
  expect(
    container.querySelector(`.credit-coin__wave[d="${BRAND_MARK.path}"]`),
  ).not.toBeNull();
  expect(container.querySelector('.credit-coin__orbit')).not.toBeNull();
});

it('is the coin alone at a card’s size', () => {
  const { container } = render(<CreditCoin size="m" badge={3} />);
  expect(container.querySelector('.credit-coin--m')).not.toBeNull();
  expect(container.querySelector('.credit-coin__orbit')).toBeNull();
  expect(container.querySelector('.credit-coin__spark')).toBeNull();
  expect(container.querySelector('.credit-coin__badge')).toHaveTextContent('3');
});
