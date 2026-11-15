/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  columnTemplate,
  fitColumns,
  formatOf,
} from 'renderer/library/libraryColumns';

describe('the details table columns', () => {
  const mockup = ['artist', 'album', 'format', 'plays', 'time'] as const;

  it('shows every chosen column where there is room for them', () => {
    expect(fitColumns(mockup, 1400)).toEqual(mockup);
    // Not measured yet: nothing is taken away on a guess.
    expect(fitColumns(mockup, 0)).toEqual(mockup);
  });

  it('lets the least needed step aside on a narrow table, Time never', () => {
    expect(fitColumns(mockup, 600)).toEqual(['artist', 'album', 'time']);
    expect(fitColumns(mockup, 300)).toEqual(['time']);
  });

  it('lays the template out as # | Title | chosen | chooser', () => {
    expect(columnTemplate(['time'])).toBe(
      '44px minmax(0, 2.5fr) minmax(60px, 0.8fr) 34px',
    );
  });

  it('names a file by its extension, in capitals', () => {
    expect(formatOf('D:\\Music\\a.flac')).toBe('FLAC');
    expect(formatOf('/home/me/b.Mp3')).toBe('MP3');
    expect(formatOf('C:\\Music\\no-extension')).toBe('');
  });
});
