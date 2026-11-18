/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * A Scenes place's name - the Studio's, Dynamic lighting's - is for screen
 * readers only (Ivan, 2026-11-17: "remove the Studio header and all that,
 * make it like the Gallery"): the rail beside the page names the place, and
 * a 30px title over it pushed the work down. What a place hangs at its top
 * still gets a row of its own. How the name is hidden is held on the
 * compiled stylesheet, which jsdom does not lay out.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import PlaceHead from 'renderer/community/PlaceHead';
import { compileStylesheet, styleRules } from '../../utils/stylesheetRules';

describe('a place’s head', () => {
  it('names the place and what it is for as one heading, and draws no row with nothing to hang', () => {
    const { container } = render(
      <PlaceHead title="Studio" description="Make your own scenes" />,
    );
    // Read by its text: jsdom's accessible name puts a space before the
    // inner span's period, which a browser's inline span does not.
    const name = screen.getByRole('heading', { level: 2 });
    expect(name).toHaveTextContent('Studio. Make your own scenes');
    expect(name).toHaveClass('place-head__name');
    expect(container.querySelector('.place-head')).toBeNull();
  });

  it('gives what a place hangs at its top a row of its own, with the place’s classes', () => {
    const { container } = render(
      <PlaceHead
        title="Dynamic lighting"
        description="Your lights follow the music"
        className="lighting-head"
      >
        <span>Connected</span>
      </PlaceHead>,
    );
    const row = container.querySelector('.place-head');
    expect(row).toHaveClass('lighting-head');
    expect(row).toHaveTextContent('Connected');
    // The row is not the name: the name stays a heading of its own.
    const name = screen.getByRole('heading', { level: 2 });
    expect(name).toHaveTextContent(
      'Dynamic lighting. Your lights follow the music',
    );
    expect(row).not.toContainElement(name);
  });

  it('keeps the name out of sight and in the reading order', () => {
    const name = styleRules(compileStylesheet('Community.scss')).find((rule) =>
      rule.selectors.includes('.place-head__name'),
    )?.declarations;
    expect(name?.get('position')).toBe('absolute');
    expect(name?.get('width')).toBe('1px');
    expect(name?.get('height')).toBe('1px');
    expect(name?.get('overflow')).toBe('hidden');
    expect(name?.get('clip-path')).toBe('inset(50%)');
    // Never `display: none`, which would take it from screen readers too.
    expect(name?.has('display')).toBe(false);
  });
});
