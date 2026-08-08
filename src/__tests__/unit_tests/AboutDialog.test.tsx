/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import {
  AUTHOR_NAME,
  BUNDLED_ENGINE,
  COPYRIGHT,
  LICENSE,
  PRODUCT_NAME,
  UPSTREAM,
} from 'common/branding';
import AboutDialog from '../../renderer/components/AboutDialog';

/**
 * The four disclosures, and that they are actually on screen.
 *
 * This is the panel that discharges obligations rather than the one that makes
 * a sound, so what matters is presence: an attribution nobody can reach is the
 * same as no attribution. Asserted against the branding module rather than
 * against literal strings, so a rebrand carries the test with it instead of
 * failing on the name.
 *
 * Read off `textContent` rather than through `getByText`, because every one of
 * these sentences interpolates a constant and so arrives as several text nodes
 * that no single-node matcher can span.
 */
describe('AboutDialog', () => {
  const openAndRead = () => {
    render(<AboutDialog onClose={() => undefined} />);
    return screen.getByRole('dialog').textContent ?? '';
  };

  it('names the product and its licence, and links to the full text', () => {
    const text = openAndRead();
    expect(screen.getByRole('dialog')).toHaveAccessibleName(PRODUCT_NAME);
    expect(text).toContain(LICENSE.name);
    expect(
      screen.getByRole('link', { name: /full licence text/i }),
    ).toHaveAttribute('href', LICENSE.url);
  });

  it('credits the upstream project and links to it', () => {
    const text = openAndRead();
    expect(text).toContain(UPSTREAM.copyright);
    expect(text).toContain(COPYRIGHT);
    expect(
      screen.getByRole('link', { name: new RegExp(UPSTREAM.name) }),
    ).toHaveAttribute('href', UPSTREAM.url);
  });

  it('states the trademark reservation as a section 7(e) term', () => {
    const text = openAndRead();
    expect(text).toContain(`marks of ${AUTHOR_NAME}`);
    expect(text).toContain('section 7(e)');
  });

  it('discloses that the audio engine is a separate bundled program', () => {
    // The one conclusion a user must not draw is that Equalizer APO is this
    // app's own work, so all three are asserted: whose it is, under what
    // licence, and that nothing of it is compiled in.
    const text = openAndRead();
    expect(text).toContain(BUNDLED_ENGINE.author);
    expect(text).toContain(BUNDLED_ENGINE.license);
    expect(text).toContain('separate programs');
  });
});
