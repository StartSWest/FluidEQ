/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { cleanup, render } from '@testing-library/react';
import Glyph from '../../../renderer/community/Glyph';
import CreditPacks from '../../../renderer/plus/CreditPacks';
import { BRAND_MARK } from '../../../common/branding';

// Ivan, 2026-11-13: "make the 3d coin the coin icon for all coins in the
// app", and "show the 3d coins also on each thing to buy". Every credit glyph
// is the coin (its edge, its face and the app icon's wave), painted in its
// own colours, and each pack is a pile of them that grows with the pack.
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: 'en',
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
  }),
}));

afterEach(cleanup);

it('draws the credit glyph as the 3D coin, in its own paints', () => {
  const { container } = render(<Glyph name="credit" className="x" />);
  const svg = container.querySelector('svg');
  expect(svg).toHaveClass('x');
  expect(svg).toHaveAttribute('viewBox', '0 0 20 20');
  const wave = container.querySelector(`path[d="${BRAND_MARK.path}"]`);
  expect(wave).not.toBeNull();
  // Inline, so a button that inks its glyphs in one colour cannot flatten it.
  expect(wave?.getAttribute('style')).toContain('stroke');
  expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(3);
  expect(container.querySelectorAll('linearGradient')).toHaveLength(2);
});

it('gives two coins gradients of their own, so one never paints the other', () => {
  const { container } = render(
    <>
      <Glyph name="credit" />
      <Glyph name="credit" />
    </>,
  );
  const ids = [...container.querySelectorAll('linearGradient')].map(
    (gradient) => gradient.id,
  );
  expect(new Set(ids).size).toBe(ids.length);
});

it('piles one, two and three coins as the packs grow, whatever their order', () => {
  const { container } = render(
    <CreditPacks
      packs={[
        { id: 'p30', credits: 30, priceCents: 1999 },
        { id: 'p5', credits: 5, priceCents: 499 },
        { id: 'p12', credits: 12, priceCents: 999 },
      ]}
      selected="p12"
      onSelect={jest.fn()}
      disabled={false}
      labelledBy="packs"
    />,
  );
  const piles = [...container.querySelectorAll('.store-pack__pile')].map(
    (pile) => pile.querySelectorAll('.store-pack__coin').length,
  );
  expect(piles).toEqual([3, 1, 2]);
});
