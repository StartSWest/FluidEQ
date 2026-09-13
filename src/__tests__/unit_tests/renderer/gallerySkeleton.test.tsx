/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The gallery's placeholder cards: as many as the view holds, faded in, and
 * faded out over the cards that replace them.
 *
 * Six stood at the top of an empty page and vanished a moment before the
 * cards rose. How many fit is measured from the grid, which jsdom does not lay
 * out, so the geometry is given here; the fades are in the stylesheet.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import GallerySkeleton from 'renderer/plus/GallerySkeleton';
import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

const box = (top: number, bottom: number) =>
  ({
    top,
    bottom,
    left: 0,
    right: 900,
    width: 900,
    height: bottom - top,
  }) as DOMRect;

describe('how many placeholders there are', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fills the view to the scroller’s foot: its columns, times the rows down to it', () => {
    // Five columns of 160px-tall cards with a 12px gap, starting 200px down a
    // scroller whose content ends at 800px: 600px holds four rows, the last
    // one cut at the foot.
    jest
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockReturnValue(160);
    jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function measure(this: HTMLElement) {
        return this.classList.contains('gallery-visualizers')
          ? box(0, 816)
          : box(200, 800);
      });
    const real = window.getComputedStyle;
    jest.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = real(element);
      if (element.classList.contains('gallery-grid--skeleton')) {
        return {
          ...style,
          gridTemplateColumns: '170px 170px 170px 170px 170px',
          rowGap: '12px',
        } as CSSStyleDeclaration;
      }
      if (element.classList.contains('gallery-visualizers')) {
        return { ...style, paddingBottom: '16px' } as CSSStyleDeclaration;
      }
      return style;
    });

    render(
      <div className="gallery-visualizers">
        <GallerySkeleton
          ref={createRef<HTMLDivElement>()}
          closing={false}
          onAnimationEnd={jest.fn()}
        />
      </div>,
    );

    const grid = screen.getByRole('status');
    expect(grid.children).toHaveLength(20);
    // Read inline: getComputedStyle is standing in for the layout here.
    expect(grid.style.maxHeight).toBe('600px');
  });

  it('is out of the accessibility tree while leaving', () => {
    render(
      <GallerySkeleton
        ref={createRef<HTMLDivElement>()}
        closing
        onAnimationEnd={jest.fn()}
      />,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('how the placeholders come and go', () => {
  const rules = styleRules(compileStylesheet('Gallery.scss'));
  const declared = (selector: string, property: string) =>
    rules
      .filter(
        (rule) =>
          rule.selectors.includes(selector) &&
          rule.declarations.has(property) &&
          rule.within.length === 0,
      )
      .map((rule) => rule.declarations.get(property))
      .pop();

  it('fades them all in together, as one, instead of card by card', () => {
    expect(declared('.gallery-grid--skeleton', 'animation')).toMatch(
      /^fade-in /,
    );
    expect(declared('.gallery-card--skeleton', 'animation')).toBe('none');
  });

  it('lays the leaving ones over the arriving cards and fades them once the cards begin', () => {
    const leaving = '.gallery-grid--skeleton[data-closing]';
    expect(declared(leaving, 'position')).toBe('absolute');
    // name, duration, easing, then the delay the cards wait before rising.
    expect(declared(leaving, 'animation')).toMatch(
      /^gallery-skeleton-out \S+ ease-in-out 120ms forwards$/,
    );
    expect(declared('.gallery-list-body', 'position')).toBe('relative');
  });
});
