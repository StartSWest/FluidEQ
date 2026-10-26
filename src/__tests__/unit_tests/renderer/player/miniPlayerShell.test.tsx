/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window as a player: the one amp (Ivan, 2026-10-25: "an unified amp ui
 * so we only have one mode"), drawn beside the app rather than in it, its
 * stylesheet on the document's root, and the window's colours held as the
 * Backdrop for as long as it is up.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { act, useLayoutEffect } from 'react';
import MiniPlayer from 'renderer/player/MiniPlayer';
import {
  setSceneTintMode,
  useWindowTintMode,
} from 'renderer/utils/sceneTintStore';

/** What the amp found on the document's root when it first measured itself. */
const mockMeasured: (string | undefined)[] = [];

const MockAmp = () => {
  useLayoutEffect(() => {
    mockMeasured.push(document.documentElement.dataset.amp);
  }, []);
  return <button type="button">inside the amp</button>;
};

jest.mock('renderer/player/PlayerAmp', () => ({
  __esModule: true,
  default: () => <MockAmp />,
}));

afterEach(() => {
  mockMeasured.length = 0;
});

describe('the player window', () => {
  // The amp's stylesheet applies under that word alone, so an amp that
  // measured itself before it was said measured under the full app's.
  it('says it is the amp on the document’s root before the amp measures itself, and takes the word back', () => {
    const { unmount } = render(<MiniPlayer onOpenPage={() => undefined} />);
    expect(mockMeasured).toEqual(['']);
    expect(document.documentElement.dataset.amp).toBe('');
    unmount();
    expect(document.documentElement.dataset.amp).toBeUndefined();
  });

  it('holds the window’s colours as the Backdrop while it is up, and hands the app’s own back', () => {
    act(() => setSceneTintMode('tint'));
    const { result } = renderHook(() => useWindowTintMode());
    // The control: the full app wears the mode chosen for it.
    expect(result.current).toBe('tint');
    const { unmount } = render(<MiniPlayer onOpenPage={() => undefined} />);
    expect(result.current).toBe('cover');
    unmount();
    expect(result.current).toBe('tint');
  });

  // The app stays mounted behind the player and its shortcuts listen on the
  // whole window: Ctrl+A and Delete would take bands nobody can see.
  it('keeps what is typed in it from the app’s shortcuts, all but Escape and Tab', () => {
    const heard: string[] = [];
    const listen = (event: KeyboardEvent) => heard.push(event.key);
    window.addEventListener('keydown', listen);
    const { unmount } = render(<MiniPlayer onOpenPage={() => undefined} />);
    const inside = screen.getByRole('button', { name: 'inside the amp' });
    fireEvent.keyDown(inside, { key: 'Delete' });
    fireEvent.keyDown(inside, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(inside, { key: 'Escape' });
    fireEvent.keyDown(inside, { key: 'Tab' });
    expect(heard).toEqual(['Escape', 'Tab']);
    unmount();
    window.removeEventListener('keydown', listen);
  });
});
