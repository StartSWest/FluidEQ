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

// Ivan, 2026-11-14, on the coin at button size: "we need to make an icon for
// those cases that looks exactly the same but clean". The glyph is the same
// coin drawn for 13-24px: an outline round the whole silhouette, the edge,
// the rim, the field and a bold wave, and none of the large coin's fine
// work (its band's second gradient, its highlight).
it('draws the credit glyph as the small clean coin, in its own paints', () => {
  const { container } = render(<Glyph name="credit" className="x" />);
  const svg = container.querySelector('svg');
  expect(svg).toHaveClass('x');
  expect(svg).toHaveAttribute('viewBox', '0 0 20 20');
  // A parent's stroke on its glyphs never reaches the coin's discs.
  expect(svg?.getAttribute('style')).toContain('stroke: none');
  const wave = container.querySelector(`path[d="${BRAND_MARK.path}"]`);
  // Inline, so a button that inks its glyphs in one colour cannot flatten it,
  // and bold: 1.35 units once scaled, a pixel at 15px.
  expect(wave?.getAttribute('style')).toContain('stroke');
  const width = Number(
    /stroke-width:\s*([\d.]+)/.exec(wave?.getAttribute('style') ?? '')?.[1],
  );
  expect(width * 0.235).toBeCloseTo(1.35, 2);
  // Outline (two discs), edge, rim, field.
  expect(container.querySelectorAll('circle')).toHaveLength(5);
  expect(container.querySelectorAll('linearGradient')).toHaveLength(1);
  expect(container.querySelector('ellipse')).toBeNull();
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
  // The piles are the large coin, which Ivan kept ("this is good"): its
  // highlight is there, where the small glyph has none.
  container.querySelectorAll('.store-pack__coin').forEach((coin) => {
    expect(coin.querySelector('ellipse')).not.toBeNull();
    expect(coin.querySelectorAll('linearGradient')).toHaveLength(2);
  });
});
