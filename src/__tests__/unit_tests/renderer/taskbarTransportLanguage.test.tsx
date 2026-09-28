/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The taskbar's buttons are greyed when the bars that drive them go away. The
 * greying was keyed on the language as well, so every switch of language
 * greyed them for a moment before the new state lit them again.
 */

import { render } from '@testing-library/react';
import { ITaskbarTransportState } from 'common/taskbarTransport';
import TaskbarTransport from '../../../renderer/audio/TaskbarTransport';
import { resetPlaybackOwner } from '../../../renderer/audio/playbackOwner';
import {
  resetTransportSource,
  setTransportSource,
} from '../../../renderer/audio/transportSource';

let mockLocale = 'en';
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({
    locale: mockLocale,
    setLocale: () => undefined,
    t: (key: string) => key,
  }),
}));

const originalElectron = window.electron;
let published: ITaskbarTransportState[];

beforeEach(() => {
  mockLocale = 'en';
  resetPlaybackOwner();
  resetTransportSource();
  published = [];
  window.electron = {
    platform: 'win32',
    ipcRenderer: {
      setTaskbarTransport: async (state: ITaskbarTransportState) => {
        published.push(state);
      },
      onTaskbarTransport: () => () => undefined,
    },
  } as unknown as typeof window.electron;
});

afterEach(() => {
  window.electron = originalElectron;
  resetPlaybackOwner();
  resetTransportSource();
});

it('keeps the buttons lit through a change of language, and greys them only on the way out', () => {
  setTransportSource({
    owner: 'library',
    title: 'Song',
    isPlaying: true,
    positionMs: 0,
    durationMs: 1000,
    toggle: () => undefined,
  });
  const view = render(<TaskbarTransport tabOwner="library" />);
  expect(published[published.length - 1]).toMatchObject({
    canToggle: true,
    locale: 'en',
  });

  published = [];
  mockLocale = 'es';
  view.rerender(<TaskbarTransport tabOwner="library" />);
  expect(published).toEqual([
    expect.objectContaining({ canToggle: true, locale: 'es' }),
  ]);

  view.unmount();
  expect(published[published.length - 1]).toMatchObject({
    canToggle: false,
    locale: 'es',
  });
});
