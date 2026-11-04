/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  translate,
  type TranslateVars,
  type TranslationKey,
} from '../../../common/i18n';
import { GENRE_NOTES } from '../../../common/dsp/genreNotes';
import genreRecordingUrl from '../../../common/dsp/genreRecordings';
import { GENRE_RACKS, genreChainId } from '../../../common/dsp/genres';
import GenreNotesDialog from '../../../renderer/dsp/GenreNotesDialog';

jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    t: (key: TranslationKey, vars?: TranslateVars) =>
      translate('en', key, vars),
  }),
}));

it.each(GENRE_RACKS)(
  '$id exposes every suggested song as an external YouTube link',
  (rack) => {
    const notes = GENRE_NOTES[rack.id];
    expect(notes.listen.length).toBeGreaterThan(0);
    render(
      <GenreNotesDialog chainId={genreChainId(rack)} onClose={jest.fn()} />,
    );

    expect(screen.getAllByRole('link')).toHaveLength(notes.listen.length);
    notes.listen.forEach((record) => {
      const link = screen.getByRole('link', { name: record });
      expect(link).toHaveAttribute(
        'href',
        expect.stringMatching(
          /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/,
        ),
      );
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAttribute('title', 'Open in browser · YouTube');
    });
  },
);

it('keeps a distinct recording for each distinct title throughout the catalogue', () => {
  const records = new Set(
    Object.values(GENRE_NOTES).flatMap((note) => note.listen),
  );
  expect(records.size).toBeGreaterThan(0);
  expect(new Set([...records].map(genreRecordingUrl)).size).toBe(records.size);
});

it('opens the original artists in the pictured Pop pills and includes both in keyboard navigation', async () => {
  const user = userEvent.setup();
  render(<GenreNotesDialog chainId="pop" onClose={jest.fn()} />);
  const blindingLights = screen.getByRole('link', {
    name: 'Blinding Lights — The Weeknd',
  });
  const levitating = screen.getByRole('link', {
    name: 'Levitating — Dua Lipa',
  });
  expect(blindingLights).toHaveAttribute(
    'href',
    'https://www.youtube.com/watch?v=4NRXx6U8ABQ',
  );
  expect(levitating).toHaveAttribute(
    'href',
    'https://www.youtube.com/watch?v=N000qglmmY0',
  );

  await user.tab();
  expect(blindingLights).toHaveFocus();
  await user.tab();
  expect(levitating).toHaveFocus();
});
