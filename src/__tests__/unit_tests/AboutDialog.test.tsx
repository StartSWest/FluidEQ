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
  TRADEMARK,
  UPSTREAM,
} from 'common/branding';
import {
  DISCLAIMER_LANGUAGE_KEY,
  DISCLAIMER_PARAGRAPH_KEYS,
} from 'common/disclaimer';
import { LocaleCode, translate } from 'common/i18n';
import { I18nProvider } from 'renderer/utils/I18nContext';
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

  /** The same, with the app set to one of the other nine languages. */
  const openAndReadIn = (locale: LocaleCode) => {
    window.localStorage.setItem('fluideq.locale', locale);
    render(
      <I18nProvider>
        <AboutDialog onClose={() => undefined} />
      </I18nProvider>,
    );
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

  it('states the warranty and liability disclaimer in readable words', () => {
    // Sections 15 and 16 were already in LICENSE, in every file header and on
    // the installer's licence page, all three in the register of a licence
    // rather than of a sentence — which is a way of being present without
    // being read. Asserted paragraph by paragraph against the same keys the
    // first-run acknowledgement renders, so the text somebody agreed to and
    // the text they can come back and re-read cannot drift apart.
    const text = openAndRead();
    DISCLAIMER_PARAGRAPH_KEYS.forEach((key) => {
      expect(text).toContain(translate('en', key, { author: AUTHOR_NAME }));
    });
    expect(text).toContain(translate('en', DISCLAIMER_LANGUAGE_KEY));
  });

  it('shows the disclaimer in the language the app is running in', () => {
    // The one translated section in an otherwise untranslated panel. Somebody
    // who accepted this in Portuguese on first run must not come back to it
    // here and find only English — they would be right to wonder which of the
    // two they had agreed to.
    const text = openAndReadIn('pt');
    DISCLAIMER_PARAGRAPH_KEYS.forEach((key) => {
      expect(text).toContain(translate('pt', key, { author: AUTHOR_NAME }));
    });
  });

  it('leaves the rest of the panel in English, whatever the language', () => {
    // The other sections are identifiers — a licence name, an attribution, a
    // copyright line, a trademark reservation — and translating an identifier
    // changes what it names. Asserted here so that the exception made for the
    // disclaimer does not quietly spread to its neighbours.
    const text = openAndReadIn('ja');
    expect(text).toContain(LICENSE.name);
    expect(text).toContain(UPSTREAM.copyright);
    expect(text).toContain(COPYRIGHT);
    expect(text).toContain(TRADEMARK.notice);
    expect(text).toContain(BUNDLED_ENGINE.license);
  });
});
