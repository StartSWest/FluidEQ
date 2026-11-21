/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * A link opened from fluideq.com puts up "Add this preset?" and nothing
 * else: no preset is saved or played until Add is pressed, Not now leaves
 * everything as it was, and a second link replaces the question rather than
 * stacking a second one behind it.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import PresetLinkReceiver from 'renderer/eq/ownPresets/share/PresetLinkReceiver';
import ProfileTestProvider from '../../utils/profileTestProvider';

const mockAdd = jest.fn(() => Promise.resolve({ id: 'user:1' }));

jest.mock('renderer/eq/ownPresets/share/useAddSharedPreset', () => ({
  __esModule: true,
  default: () => mockAdd,
}));

// The read itself is held by sharedPresetShortLinkRead.test.ts; here the
// preset a link names is the one its id says, as if fetched.
jest.mock('renderer/eq/ownPresets/share/useSharedPreset', () => ({
  __esModule: true,
  default: (text: string) => {
    const id = /\/p\/([0-9A-Za-z]{8})$/.exec(text)?.[1];
    return id
      ? {
          ok: true,
          preset: {
            name: `Preset ${id}`,
            settings: jest.requireActual('common/dsp/chainDefaults')
              .DSP_DEFAULTS,
          },
          source: { id, author: id === 'Zz9Yy8Xx' ? null : 'Night Owl' },
        }
      : undefined;
  },
}));

let arrived: () => void = () => undefined;
const waiting: string[] = [];

beforeEach(() => {
  mockAdd.mockClear();
  waiting.length = 0;
  Object.assign(window, {
    electron: {
      ipcRenderer: {
        takePresetLink: () => Promise.resolve(waiting.shift()),
        onPresetLink: (listener: () => void) => {
          arrived = listener;
          return () => undefined;
        },
      },
    },
  });
});

const openReceiver = async () => {
  render(
    <ProfileTestProvider>
      <PresetLinkReceiver />
    </ProfileTestProvider>,
  );
  await act(async () => undefined);
};

const linkArrives = async (id: string) => {
  waiting.push(id);
  await act(async () => {
    arrived();
  });
};

describe('a preset link from a page', () => {
  it('asks first, with the preset and who shared it, and adds nothing on its own', async () => {
    waiting.push('Ab3dE6gH');
    await openReceiver();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Add this preset?')).toBeTruthy();
    expect(screen.getByText('Preset Ab3dE6gH')).toBeTruthy();
    expect(screen.getByText('Shared by Night Owl')).toBeTruthy();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('leaves everything as it was on Not now', async () => {
    waiting.push('Ab3dE6gH');
    await openReceiver();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('adds the preset only on the press of Add', async () => {
    waiting.push('Ab3dE6gH');
    await openReceiver();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Add to my presets' }),
      );
    });
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Preset Ab3dE6gH' }),
    );
  });

  it('replaces the question with a second link, never stacks two', async () => {
    waiting.push('Ab3dE6gH');
    await openReceiver();
    await linkArrives('Zz9Yy8Xx');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByText('Preset Zz9Yy8Xx')).toBeTruthy();
    expect(screen.queryByText('Preset Ab3dE6gH')).toBeNull();
    expect(screen.getByText('Shared by a FluidEQ member')).toBeTruthy();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('asks nothing when main holds no link', async () => {
    await openReceiver();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
