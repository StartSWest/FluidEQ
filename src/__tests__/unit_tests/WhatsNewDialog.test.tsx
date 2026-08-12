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

import { render, screen, waitFor } from '@testing-library/react';
import WhatsNewDialog from 'renderer/components/WhatsNewDialog';
import { I18nProvider } from 'renderer/utils/I18nContext';

const NOTES = [
  '## 1.2.0',
  '',
  'One sentence of a paragraph,',
  'wrapped by the editor at eighty columns,',
  'across three lines of the file.',
  '',
  'A second paragraph that must not join the first.',
  '',
  '### New',
  '',
  '- A bullet that also wraps',
  '  onto an indented line',
  '- A second bullet',
].join('\n');

/** What the main process was asked for, so the two entry points can be told apart. */
let requestedScope: string | undefined;

const showNotes = (markdown: string, scope: 'latest' | 'all' = 'latest') => {
  requestedScope = undefined;
  window.electron = {
    ipcRenderer: {
      getChangelog: (asked: string) => {
        requestedScope = asked;
        return Promise.resolve(markdown);
      },
    },
  } as unknown as typeof window.electron;
  return render(
    <I18nProvider>
      <WhatsNewDialog scope={scope} onClose={() => {}} />
    </I18nProvider>,
  );
};

describe('the release notes the dialog draws', () => {
  it('joins a wrapped paragraph into one flowing block', async () => {
    // The file is wrapped at eighty columns for reading in an editor. Drawing
    // each of those lines as its own paragraph made the dialog break its text
    // two thirds of the way across, whatever width it had been given.
    const { container } = showNotes(NOTES);
    // The loading placeholder is a paragraph too, so waiting for any `p` at all
    // would be satisfied before the notes have arrived.
    await waitFor(() => expect(container.querySelector('li')).toBeTruthy());

    const paragraphs = Array.from(container.querySelectorAll('p'));
    expect(paragraphs[0].textContent).toBe(
      'One sentence of a paragraph, wrapped by the editor at eighty columns, across three lines of the file.',
    );
  });

  it('keeps a blank line between two paragraphs meaning two paragraphs', async () => {
    const { container } = showNotes(NOTES);
    // The loading placeholder is a paragraph too, so waiting for any `p` at all
    // would be satisfied before the notes have arrived.
    await waitFor(() => expect(container.querySelector('li')).toBeTruthy());

    const paragraphs = Array.from(container.querySelectorAll('p'));
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[1].textContent).toBe(
      'A second paragraph that must not join the first.',
    );
  });

  it('still assembles a wrapped list item, and starts the list after the prose', async () => {
    const { container } = showNotes(NOTES);
    await waitFor(() => expect(container.querySelector('li')).toBeTruthy());

    const items = Array.from(container.querySelectorAll('li'));
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe(
      'A bullet that also wraps onto an indented line',
    );
  });

  it('draws the version heading and not the document title', async () => {
    await showNotes(NOTES);
    await waitFor(() => expect(screen.getByText('1.2.0')).toBeTruthy());
  });

  it('asks for one version when it opened itself after an update', async () => {
    const { container } = showNotes(NOTES, 'latest');
    await waitFor(() => expect(container.querySelector('li')).toBeTruthy());
    expect(requestedScope).toBe('latest');
  });

  it('asks for the whole history when somebody opened it deliberately', async () => {
    // Two entry points, two questions. Opened from a menu, the history is what
    // the reader came for; opened by itself, it is everything that is not new.
    const { container } = showNotes(NOTES, 'all');
    await waitFor(() => expect(container.querySelector('li')).toBeTruthy());
    expect(requestedScope).toBe('all');
  });
});
